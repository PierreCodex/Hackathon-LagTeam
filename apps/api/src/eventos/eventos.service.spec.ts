import { CODIGO_BD_NO_DISPONIBLE, CODIGOS_EVENTOS } from "@reto18/shared";
import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { ClienteSupabase } from "../supabase/supabase.module.js";
import type { ArchivoEntrada, ArchivosEventos, ArchivoSubido } from "./archivos-eventos.js";
import { EventosService, PALETA_CATEGORIAS } from "./eventos.service.js";

const ORGANIZADOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EVENTO = "11111111-1111-4111-8111-111111111111";
const PNG: ArchivoEntrada = {
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  size: 8,
  mimetype: "image/png",
};
const PDF: ArchivoEntrada = { buffer: Buffer.from("%PDF-1.7"), size: 8, mimetype: "application/pdf" };

const datos = (cambio: Record<string, unknown> = {}) =>
  JSON.stringify({
    titulo: "Noche de marinera",
    categoria: "danza",
    descripcion: "Una noche de marinera norteña con parejas de Piura.",
    inicio: "2030-11-20T20:00:00-05:00",
    aforo: 100,
    hay_musica: false,
    sede: { tipo: "existente", sede_id: "13100000-0000-4000-8000-000000000001" },
    categorias: [{ nombre: "General", precio_centimos: 2000 }],
    ...cambio,
  });

type RespuestaRpc = {
  data: unknown;
  error: { code?: string; message: string; details?: string } | null;
  status?: number;
};

function simulado(rpc: RespuestaRpc | (() => Promise<RespuestaRpc>) = { data: EVENTO, error: null }) {
  const subidos: ArchivoSubido[] = [];
  const archivos = {
    subirFoto: vi.fn(async () => {
      const s = { bucket: "eventos-fotos", ruta: "org/f.png", url: "http://x/storage/v1/object/public/eventos-fotos/org/f.png" };
      subidos.push(s);
      return s;
    }),
    subirConstancia: vi.fn(async () => {
      const s = { bucket: "eventos-constancias", ruta: "org/c.pdf", url: "http://x/storage/v1/object/eventos-constancias/org/c.pdf" };
      subidos.push(s);
      return s;
    }),
    borrar: vi.fn(async () => {}),
  };
  const llamadaRpc = vi.fn();
  const fila = (tabla: string) =>
    tabla === "eventos_eventos"
      ? { data: { id: EVENTO }, error: null }
      : {
          data: [
            { id: "c2", nombre: "VIP" },
            { id: "c1", nombre: "General" },
          ],
          error: null,
        };
  const cliente = {
    rpc: (nombre: string, args: unknown) => {
      llamadaRpc(nombre, args);
      return { abortSignal: () => (typeof rpc === "function" ? rpc() : Promise.resolve(rpc)) };
    },
    from: (tabla: string) => {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        abortSignal: () => Object.assign(Promise.resolve(fila(tabla)), consulta),
        single: async () => fila(tabla),
      };
      return consulta;
    },
  } as unknown as ClienteSupabase;
  const servicio = new EventosService(cliente, archivos as unknown as ArchivosEventos);
  return { servicio, archivos, llamadaRpc, subidos };
}

describe("EventosService.crear", () => {
  it("sube la foto, llama a la RPC con el organizador del token y devuelve el evento", async () => {
    const s = simulado();

    const creado = await s.servicio.crear(ORGANIZADOR, datos({ categorias: [{ nombre: "General", precio_centimos: 2000 }, { nombre: "VIP", precio_centimos: 5000 }] }), { foto: [PNG] });

    expect(s.archivos.subirFoto).toHaveBeenCalledWith(ORGANIZADOR, PNG, "image/png");
    expect(s.archivos.subirConstancia).not.toHaveBeenCalled();
    expect(s.llamadaRpc).toHaveBeenCalledWith("eventos_crear_evento", {
      datos: expect.objectContaining({
        organizador_id: ORGANIZADOR,
        foto_url: s.subidos[0]!.url,
        constancia_apdayc_url: null,
        categorias: [
          { nombre: "General", precio_centimos: 2000, color: PALETA_CATEGORIAS[0] },
          { nombre: "VIP", precio_centimos: 5000, color: PALETA_CATEGORIAS[1] },
        ],
      }),
    });
    expect(creado.evento).toEqual({ id: EVENTO });
    expect(creado.categorias.map((c) => c.nombre)).toEqual(["General", "VIP"]);
    expect(s.archivos.borrar).not.toHaveBeenCalled();
  });

  it("con música sube también la constancia y guarda su URL", async () => {
    const s = simulado();

    await s.servicio.crear(ORGANIZADOR, datos({ hay_musica: true }), { foto: [PNG], constancia: [PDF] });

    expect(s.archivos.subirConstancia).toHaveBeenCalledWith(ORGANIZADOR, PDF, "application/pdf");
    expect(s.llamadaRpc).toHaveBeenCalledWith("eventos_crear_evento", {
      datos: expect.objectContaining({ hay_musica: true, constancia_apdayc_url: s.subidos[1]!.url }),
    });
  });

  it("música sin constancia → 400 MUSICA_SIN_CONSTANCIA sin subir nada", async () => {
    const s = simulado();

    await expect(s.servicio.crear(ORGANIZADOR, datos({ hay_musica: true }), { foto: [PNG] })).rejects.toMatchObject({
      status: 400,
      response: { codigo: CODIGOS_EVENTOS.MUSICA_SIN_CONSTANCIA },
    });
    expect(s.archivos.subirFoto).not.toHaveBeenCalled();
    expect(s.llamadaRpc).not.toHaveBeenCalled();
  });

  it.each([
    ["sin foto", {}],
    ["foto que no es imagen", { foto: [PDF] }],
  ])("%s → 400 ARCHIVO_NO_VALIDO sin subir nada", async (_caso, archivos) => {
    const s = simulado();

    await expect(s.servicio.crear(ORGANIZADOR, datos(), archivos)).rejects.toMatchObject({
      response: { codigo: CODIGOS_EVENTOS.ARCHIVO_NO_VALIDO },
    });
    expect(s.archivos.subirFoto).not.toHaveBeenCalled();
  });

  it("datos inválidos → 400 DATOS_INVALIDOS sin subir nada", async () => {
    const s = simulado();

    await expect(s.servicio.crear(ORGANIZADOR, datos({ categorias: [] }), { foto: [PNG] })).rejects.toMatchObject({
      response: { codigo: CODIGOS_EVENTOS.DATOS_INVALIDOS },
    });
    expect(s.archivos.subirFoto).not.toHaveBeenCalled();
  });

  it.each([
    ["SEDE_NO_EXISTE", 404],
    ["SEDE_AJENA", 403],
    ["AFORO_SUPERA_SEDE", 400],
  ])("la RPC rechaza con %s → %i y borra lo subido", async (codigo, estado) => {
    const s = simulado({ data: null, error: { code: "P0001", message: codigo, details: "detalle" } });

    await expect(s.servicio.crear(ORGANIZADOR, datos({ hay_musica: true }), { foto: [PNG], constancia: [PDF] })).rejects.toMatchObject({
      status: estado,
      response: { codigo },
    });
    expect(s.archivos.borrar).toHaveBeenCalledWith(s.subidos);
    expect(s.subidos).toHaveLength(2);
  });

  it("un error cualquiera de la BD → 500 y borra lo subido", async () => {
    const s = simulado({ data: null, error: { code: "23514", message: "violates check constraint" } });

    await expect(s.servicio.crear(ORGANIZADOR, datos(), { foto: [PNG] })).rejects.toMatchObject({ status: 500 });
    expect(s.archivos.borrar).toHaveBeenCalledWith(s.subidos);
  });

  it("la RPC lanza → borra lo subido", async () => {
    const s = simulado(() => Promise.reject(new Error("algo raro")));

    await expect(s.servicio.crear(ORGANIZADOR, datos(), { foto: [PNG] })).rejects.toThrow("algo raro");
    expect(s.archivos.borrar).toHaveBeenCalledWith(s.subidos);
  });

  it("tiempo límite de la RPC (resultado incierto) → 503 y no borra los archivos", async () => {
    const s = simulado({ data: null, error: { code: "", message: "TimeoutError: The operation timed out" }, status: 0 });

    await expect(s.servicio.crear(ORGANIZADOR, datos(), { foto: [PNG] })).rejects.toMatchObject({
      status: 503,
      response: { codigo: CODIGO_BD_NO_DISPONIBLE },
    });
    expect(s.archivos.borrar).not.toHaveBeenCalled();
  });

  it("error sin código pero con respuesta HTTP (p. ej. 502 de la pasarela) → borra lo subido", async () => {
    const s = simulado({ data: null, error: { code: "", message: "Bad Gateway" }, status: 502 });

    await expect(s.servicio.crear(ORGANIZADOR, datos(), { foto: [PNG] })).rejects.toMatchObject({ status: 500 });
    expect(s.archivos.borrar).toHaveBeenCalledWith(s.subidos);
  });

  it("las categorías sin color toman el primer color libre de la paleta", async () => {
    const s = simulado();

    await s.servicio.crear(
      ORGANIZADOR,
      datos({
        categorias: [
          { nombre: "General", precio_centimos: 2000 },
          { nombre: "VIP", precio_centimos: 5000, color: PALETA_CATEGORIAS[0] },
          { nombre: "Palco", precio_centimos: 8000 },
        ],
      }),
      { foto: [PNG] },
    );

    expect(s.llamadaRpc).toHaveBeenCalledWith("eventos_crear_evento", {
      datos: expect.objectContaining({
        categorias: [
          { nombre: "General", precio_centimos: 2000, color: PALETA_CATEGORIAS[1] },
          { nombre: "VIP", precio_centimos: 5000, color: PALETA_CATEGORIAS[0] },
          { nombre: "Palco", precio_centimos: 8000, color: PALETA_CATEGORIAS[2] },
        ],
      }),
    });
  });

  it("Storage no disponible al subir la constancia → 503 STORAGE_NO_DISPONIBLE y borra la foto", async () => {
    const s = simulado();
    s.archivos.subirConstancia.mockRejectedValueOnce(
      new ServiceUnavailableException({ codigo: CODIGOS_EVENTOS.STORAGE_NO_DISPONIBLE, mensaje: "x" }),
    );

    await expect(s.servicio.crear(ORGANIZADOR, datos({ hay_musica: true }), { foto: [PNG], constancia: [PDF] })).rejects.toMatchObject({
      status: 503,
      response: { codigo: CODIGOS_EVENTOS.STORAGE_NO_DISPONIBLE },
    });
    expect(s.archivos.borrar).toHaveBeenCalledWith([expect.objectContaining({ bucket: "eventos-fotos" })]);
    expect(s.llamadaRpc).not.toHaveBeenCalled();
  });

  it("sin Supabase configurado → 503 sin subir nada", async () => {
    const archivos = { subirFoto: vi.fn(), borrar: vi.fn() };
    const servicio = new EventosService(null, archivos as unknown as ArchivosEventos);

    await expect(servicio.crear(ORGANIZADOR, datos(), { foto: [PNG] })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(archivos.subirFoto).not.toHaveBeenCalled();
  });
});

describe("EventosService.listarSedes", () => {
  it("pasa el organizador y devuelve las sedes con su capacidad como número y si son propias", async () => {
    const llamada = vi.fn();
    const cliente = {
      rpc: (nombre: string, args: unknown) => {
        llamada(nombre, args);
        return {
          abortSignal: async () => ({
            data: [
              { id: "s1", nombre: "Teatro", direccion: "Centro", distrito: "Piura", capacidad: "643", propia: false },
              { id: "s2", nombre: "Patio", direccion: "Plaza", distrito: "Castilla", capacidad: 120, propia: true },
            ],
            error: null,
          }),
        };
      },
    } as unknown as ClienteSupabase;

    expect(await new EventosService(cliente, {} as ArchivosEventos).listarSedes(ORGANIZADOR)).toEqual([
      { id: "s1", nombre: "Teatro", direccion: "Centro", distrito: "Piura", capacidad: 643, propia: false },
      { id: "s2", nombre: "Patio", direccion: "Plaza", distrito: "Castilla", capacidad: 120, propia: true },
    ]);
    expect(llamada).toHaveBeenCalledWith("eventos_listar_sedes", { p_organizador: ORGANIZADOR });
  });

  it("la BD falla → 503 BD_NO_DISPONIBLE", async () => {
    const cliente = {
      rpc: () => ({ abortSignal: async () => ({ data: null, error: { message: "timeout" } }) }),
    } as unknown as ClienteSupabase;

    await expect(new EventosService(cliente, {} as ArchivosEventos).listarSedes(ORGANIZADOR)).rejects.toMatchObject({
      response: { codigo: CODIGO_BD_NO_DISPONIBLE },
    });
  });
});
