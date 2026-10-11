import { CODIGOS_EVENTOS } from "@reto18/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClienteSupabase } from "../supabase/supabase.module.js";
import {
  type ArchivoEntrada,
  ArchivosEventos,
  type CampoArchivo,
  detectarTipo,
  TIEMPO_LIMITE_STORAGE_MS,
  validarArchivo,
  DURACION_FIRMA_CONSTANCIA_SEGUNDOS,
} from "./archivos-eventos.js";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);
const PDF = Buffer.from("%PDF-1.7\n");
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const archivo = (buffer: Buffer, mimetype = "image/png"): ArchivoEntrada => ({ buffer, size: buffer.length, mimetype });

describe("detectarTipo y validarArchivo", () => {
  it.each([
    [PNG, "image/png"],
    [JPG, "image/jpeg"],
    [WEBP, "image/webp"],
    [PDF, "application/pdf"],
    [Buffer.from("hola"), null],
  ])("detecta el tipo por los primeros bytes (%#)", (buffer, tipo) => {
    expect(detectarTipo(buffer)).toBe(tipo);
  });

  it("acepta imágenes como foto y PDF o imagen como constancia", () => {
    expect(validarArchivo(archivo(PNG), "foto")).toBe("image/png");
    expect(validarArchivo(archivo(PDF, "application/pdf"), "constancia")).toBe("application/pdf");
    expect(validarArchivo(archivo(JPG), "constancia")).toBe("image/jpeg");
  });

  it.each<[string, ArchivoEntrada, CampoArchivo]>([
    ["una foto que es un PDF", archivo(PDF, "image/png"), "foto"],
    ["una foto que es texto con tipo de imagen", archivo(Buffer.from("no soy png"), "image/png"), "foto"],
    ["una constancia que no es PDF ni imagen", archivo(ZIP, "application/pdf"), "constancia"],
    ["un archivo de más de 5 MB", { buffer: PNG, size: 5 * 1024 * 1024 + 1, mimetype: "image/png" }, "foto"],
  ])("rechaza %s → ARCHIVO_NO_VALIDO", (_caso, entrada, campo) => {
    expect(() => validarArchivo(entrada, campo)).toThrow(
      expect.objectContaining({
        response: { codigo: CODIGOS_EVENTOS.ARCHIVO_NO_VALIDO, mensaje: expect.stringContaining(`${campo}:`) },
      }),
    );
  });
});

describe("firma privada de constancias", () => {
  const propietario = "13000000-0000-4000-8000-000000000001";
  const nombre = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf";
  const base = "http://127.0.0.1:54321/storage/v1/object/";
  const url = `${base}eventos-constancias/${propietario}/${nombre}`;
  function preparar(firma: () => Promise<unknown> = async () => ({ data: { signedUrl: "https://storage.test/firmada" }, error: null })) {
    const createSignedUrl = vi.fn(firma);
    const from = vi.fn((bucket: string) => ({
      getPublicUrl: (ruta: string) => ({ data: { publicUrl: `${base}public/${bucket}/${ruta}` } }),
      createSignedUrl,
    }));
    return { archivos: new ArchivosEventos({ storage: { from } } as unknown as ClienteSupabase), createSignedUrl, from };
  }
  afterEach(() => vi.useRealTimers());

  it("firma 300 segundos el objeto del propietario", async () => {
    const s = preparar();
    expect(await s.archivos.firmarConstancia(propietario, url)).toBe("https://storage.test/firmada");
    expect(s.from).toHaveBeenCalledWith("eventos-constancias");
    expect(s.createSignedUrl).toHaveBeenCalledWith(`${propietario}/${nombre}`, 300);
    expect(DURACION_FIRMA_CONSTANCIA_SEGUNDOS).toBe(300);
  });

  it.each([
    url.replace("127.0.0.1", "ajeno.test"), url.replace("eventos-constancias", "eventos-fotos"),
    url.replace(propietario, "otro"), `${url}?token=firma`, `${url}#fragmento`,
    url.replace(nombre, `../${nombre}`), url.replace(nombre, `%2e%2e/${nombre}`),
    url.replace(nombre, `${nombre}/extra`), "no-es-url", url.replace(nombre, ""),
  ])("rechaza una ruta ajena o inválida %# sin pedir firma", async (ruta) => {
    const s = preparar();
    await expect(s.archivos.firmarConstancia(propietario, ruta)).rejects.toMatchObject({
      status: 400, response: { codigo: "ARCHIVO_NO_VALIDO" },
    });
    expect(s.createSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    async () => ({ data: null, error: { message: "fallo" } }),
    async () => { throw new Error("red caída"); },
    async () => ({ data: null, error: null }),
  ])("traduce fallos de firma a 503 %#", async (firma) => {
    await expect(preparar(firma).archivos.firmarConstancia(propietario, url)).rejects.toMatchObject({
      status: 503, response: { codigo: "STORAGE_NO_DISPONIBLE" },
    });
  });

  it("limita la espera de firma y admite Storage no configurado", async () => {
    vi.useFakeTimers();
    const s = preparar(() => new Promise(() => {}));
    const comprobacion = expect(s.archivos.firmarConstancia(propietario, url)).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(TIEMPO_LIMITE_STORAGE_MS);
    await comprobacion;
    await expect(new ArchivosEventos(null).firmarConstancia(propietario, url)).rejects.toMatchObject({ status: 503 });
  });
});

describe("ArchivosEventos", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function storageSimulado(upload: () => Promise<{ data: unknown; error: unknown }>) {
    const remove = vi.fn(async (rutas: string[]) => ({ data: rutas.map(() => ({})), error: null }));
    const from = vi.fn((bucket: string) => ({
      upload: vi.fn(upload),
      remove,
      getPublicUrl: (ruta: string) => ({
        data: { publicUrl: `http://127.0.0.1:54321/storage/v1/object/public/${bucket}/${ruta}` },
      }),
    }));
    return { cliente: { storage: { from } } as unknown as ClienteSupabase, remove, from };
  }

  it("devuelve la URL pública de la foto y la del objeto de la constancia", async () => {
    const { cliente } = storageSimulado(async () => ({ data: {}, error: null }));
    const archivos = new ArchivosEventos(cliente);

    const foto = await archivos.subirFoto("org-1", archivo(PNG), "image/png");
    const constancia = await archivos.subirConstancia("org-1", archivo(PDF), "application/pdf");

    expect(foto.url).toMatch(/\/storage\/v1\/object\/public\/eventos-fotos\/org-1\/[0-9a-f-]+\.png$/);
    expect(constancia.url).toMatch(/\/storage\/v1\/object\/eventos-constancias\/org-1\/[0-9a-f-]+\.pdf$/);
  });

  it("Storage no responde en el tiempo límite → 503 STORAGE_NO_DISPONIBLE, y borra la subida tardía", async () => {
    vi.useFakeTimers();
    let terminar: (v: { data: unknown; error: null }) => void = () => {};
    const { cliente, remove } = storageSimulado(
      () => new Promise((resolver) => (terminar = resolver)),
    );

    const pendiente = new ArchivosEventos(cliente).subirFoto("org-1", archivo(PNG), "image/png");
    const comprobacion = expect(pendiente).rejects.toMatchObject({
      response: { codigo: CODIGOS_EVENTOS.STORAGE_NO_DISPONIBLE },
    });
    await vi.advanceTimersByTimeAsync(TIEMPO_LIMITE_STORAGE_MS);
    await comprobacion;
    expect(TIEMPO_LIMITE_STORAGE_MS).toBe(10_000);

    terminar({ data: {}, error: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(remove).toHaveBeenCalledOnce();
  });

  it("un error de Storage → 503 STORAGE_NO_DISPONIBLE", async () => {
    const { cliente } = storageSimulado(async () => ({ data: null, error: { message: "fetch failed" } }));

    await expect(new ArchivosEventos(cliente).subirFoto("org-1", archivo(PNG), "image/png")).rejects.toMatchObject({
      response: { codigo: CODIGOS_EVENTOS.STORAGE_NO_DISPONIBLE },
    });
  });

  it("borrar no lanza aunque Storage falle", async () => {
    const { cliente, remove } = storageSimulado(async () => ({ data: {}, error: null }));
    remove.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(
      new ArchivosEventos(cliente).borrar([{ bucket: "eventos-fotos", ruta: "a.png", url: "" }]),
    ).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(["a.png"]);
  });
});
