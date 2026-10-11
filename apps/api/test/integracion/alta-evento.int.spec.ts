import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { CategoriaPrecioSchema, EventoCreadoSchema, EventoSchema, SedeResumenSchema } from "@reto18/shared";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUCKET_CONSTANCIAS, BUCKET_FOTOS } from "../../src/eventos/archivos-eventos.js";
import { SEDE_CROQUIS_ID, SEDE_GENERAL_ID } from "../fixtures/croquis.js";
import { crearAppDePrueba } from "./ayudas/app.js";
import { api } from "./ayudas/http.js";
import { clienteAdminDePrueba, entornoDePrueba } from "./ayudas/supabase.js";
import { tokenPorRol, type UsuarioDePrueba } from "./ayudas/tokens.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const RUTA = "/api/v1/eventos";

function datos(cambio: Record<string, unknown> = {}) {
  return {
    titulo: "Noche de marinera",
    categoria: "danza",
    descripcion: "Una noche de marinera norteña con parejas de Piura.",
    inicio: "2030-11-20T20:00:00-05:00",
    aforo: 100,
    hay_musica: false,
    sede: { tipo: "existente", sede_id: SEDE_CROQUIS_ID },
    categorias: [{ nombre: "General", precio_centimos: 2000 }],
    ...cambio,
  };
}

describe("alta de evento contra la BD de prueba", () => {
  let app: INestApplication;
  let organizador: UsuarioDePrueba;
  /** Organizador de los casos que fallan: sus carpetas de Storage deben quedar vacías. */
  let fallido: UsuarioDePrueba;
  let publico: UsuarioDePrueba;
  let admin: UsuarioDePrueba;
  const sedesCreadas: string[] = [];

  beforeAll(async () => {
    app = await crearAppDePrueba();
    [organizador, fallido, publico, admin] = await Promise.all([
      tokenPorRol("organizador"),
      tokenPorRol("organizador"),
      tokenPorRol("publico"),
      tokenPorRol("admin"),
    ]);
  });

  // Corre antes que el de `limpieza.ts` (los hooks son una pila): los eventos referencian
  // `auth.users` sin cascada y hay que borrarlos antes que a los usuarios.
  afterAll(async () => {
    await app?.close();
    const bd = clienteAdminDePrueba();
    const organizadores = [organizador, fallido].filter(Boolean).map((u) => u.id);
    expect((await bd.from("eventos_eventos").delete().in("organizador_id", organizadores)).error).toBeNull();
    if (sedesCreadas.length) {
      expect((await bd.from("eventos_sedes").delete().in("id", sedesCreadas)).error).toBeNull();
    }
    for (const bucket of [BUCKET_FOTOS, BUCKET_CONSTANCIAS]) {
      for (const id of organizadores) {
        const rutas = (await archivosDe(bucket, id)).map((nombre) => `${id}/${nombre}`);
        if (rutas.length) expect((await bd.storage.from(bucket).remove(rutas)).error).toBeNull();
      }
    }
  });

  async function archivosDe(bucket: string, organizadorId: string): Promise<string[]> {
    const { data, error } = await clienteAdminDePrueba().storage.from(bucket).list(organizadorId);
    expect(error).toBeNull();
    return (data ?? []).map((f) => f.name);
  }

  function alta(usuario: UsuarioDePrueba | undefined, cuerpo: unknown, archivos: { foto?: Buffer; constancia?: Buffer } = {}) {
    let peticion = api(app, usuario?.token).post(RUTA).field("datos", JSON.stringify(cuerpo));
    if (archivos.foto) peticion = peticion.attach("foto", archivos.foto, "foto.png");
    if (archivos.constancia) peticion = peticion.attach("constancia", archivos.constancia, "constancia.pdf");
    return peticion;
  }

  async function sinRastroDelFallido() {
    expect(await archivosDe(BUCKET_FOTOS, fallido.id)).toEqual([]);
    expect(await archivosDe(BUCKET_CONSTANCIAS, fallido.id)).toEqual([]);
    const { data, error } = await clienteAdminDePrueba().from("eventos_eventos").select("id").eq("organizador_id", fallido.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  }

  it("con sede nueva: 201, evento pendiente con la foto y categorías en la zona general", async () => {
    const nombreSede = `Patio de prueba ${randomUUID()}`;
    const respuesta = await alta(
      organizador,
      datos({
        aforo: 120,
        sede: { tipo: "nueva", nombre: nombreSede, direccion: "Jr. Prueba 123", distrito: "Castilla", capacidad: 120 },
        categorias: [
          { nombre: "General", precio_centimos: 2000 },
          { nombre: "Preferencial", precio_centimos: 3500, color: "#123456" },
        ],
      }),
      { foto: PNG },
    );

    expect(respuesta.status).toBe(201);
    const { evento, categorias } = EventoCreadoSchema.parse(respuesta.body);
    sedesCreadas.push(evento.sede_id);
    expect(evento).toMatchObject({
      estado: "pendiente",
      organizador_id: organizador.id,
      aforo: 120,
      distrito: "Castilla",
      hay_musica: false,
      constancia_apdayc_url: null,
      destacado: false,
    });
    expect(evento.foto_url).toContain(`/storage/v1/object/public/${BUCKET_FOTOS}/${organizador.id}/`);
    const foto = await fetch(evento.foto_url!);
    expect(foto.status).toBe(200);

    const bd = clienteAdminDePrueba();
    const secciones = await bd.from("eventos_secciones").select("id, tipo, capacidad").eq("sede_id", evento.sede_id);
    expect(secciones.error).toBeNull();
    expect(secciones.data).toEqual([{ id: expect.any(String), tipo: "general", capacidad: 120 }]);
    expect(categorias).toHaveLength(2);
    expect(categorias.map((c) => [c.nombre, c.precio_centimos, c.color])).toEqual([
      ["General", 2000, expect.stringMatching(/^#[0-9A-F]{6}$/i)],
      ["Preferencial", 3500, "#123456"],
    ]);
    expect(categorias.every((c) => c.sede_id === evento.sede_id && c.seccion_id === secciones.data![0]!.id)).toBe(true);

    // La sede nueva queda disponible para los demás organizadores.
    const sedes = await api(app, fallido.token).get(`${RUTA}/sedes`);
    expect(sedes.body).toContainEqual(expect.objectContaining({ id: evento.sede_id, nombre: nombreSede, capacidad: 120 }));
  });

  it("con la sede sembrada, música y constancia: 201 y la constancia guardada", async () => {
    const respuesta = await alta(organizador, datos({ aforo: 500, hay_musica: true, categoria: "musica" }), {
      foto: PNG,
      constancia: PDF,
    });

    expect(respuesta.status).toBe(201);
    const { evento, categorias } = EventoCreadoSchema.parse(respuesta.body);
    expect(evento).toMatchObject({ estado: "pendiente", hay_musica: true, aforo: 500, sede_id: SEDE_CROQUIS_ID, distrito: "Piura" });
    expect(evento.constancia_apdayc_url).toContain(`/storage/v1/object/${BUCKET_CONSTANCIAS}/${organizador.id}/`);
    // Sede numerada: los precios por sección o rango son de la pizarra (2.3 y 2.4).
    expect(categorias).toEqual([expect.objectContaining({ sede_id: SEDE_CROQUIS_ID, seccion_id: null })]);

    // Lo que quedó en la BD: pendiente, organizador del token y categorías en la sede del evento.
    const bd = clienteAdminDePrueba();
    const fila = await bd.from("eventos_eventos").select("*").eq("id", evento.id).single();
    expect(fila.error).toBeNull();
    expect(EventoSchema.parse({ ...fila.data, creado_en: undefined })).toMatchObject({
      estado: "pendiente",
      organizador_id: organizador.id,
    });
    const precios = await bd.from("eventos_categorias_precio").select("*").eq("evento_id", evento.id);
    expect(CategoriaPrecioSchema.array().parse(precios.data).every((c) => c.sede_id === fila.data.sede_id)).toBe(true);

    // La constancia es privada: su URL no se abre sin firma.
    expect((await fetch(evento.constancia_apdayc_url!)).ok).toBe(false);
    expect(await archivosDe(BUCKET_CONSTANCIAS, organizador.id)).toHaveLength(1);
  });

  it.each([
    ["sede sembrada de 643 con aforo 700", () => datos({ aforo: 700 })],
    [
      "sede nueva de 120 con aforo 150",
      () =>
        datos({
          aforo: 150,
          sede: { tipo: "nueva", nombre: `Sede fallida ${randomUUID()}`, direccion: "Jr. X", distrito: "Piura", capacidad: 120 },
        }),
    ],
  ])("aforo mayor que la sede (%s) → 400 AFORO_SUPERA_SEDE, sin evento ni archivos", async (_caso, cuerpo) => {
    const peticion = cuerpo();
    const respuesta = await alta(fallido, { ...peticion, hay_musica: true }, { foto: PNG, constancia: PDF });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe("AFORO_SUPERA_SEDE");
    expect(respuesta.body.error.mensaje).toContain("aforo");
    await sinRastroDelFallido();
    const sede = peticion.sede as { tipo: string; nombre?: string };
    if (sede.tipo === "nueva") {
      const { data } = await clienteAdminDePrueba().from("eventos_sedes").select("id").eq("nombre", sede.nombre!);
      expect(data).toEqual([]);
    }
  });

  it("música sin constancia → 400 MUSICA_SIN_CONSTANCIA sin subir nada", async () => {
    const respuesta = await alta(fallido, datos({ hay_musica: true }), { foto: PNG });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe("MUSICA_SIN_CONSTANCIA");
    await sinRastroDelFallido();
  });

  it("sede inexistente → 404 SEDE_NO_EXISTE y borra lo subido", async () => {
    const respuesta = await alta(fallido, datos({ sede: { tipo: "existente", sede_id: randomUUID() } }), { foto: PNG });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe("SEDE_NO_EXISTE");
    await sinRastroDelFallido();
  });

  it.each([
    ["sin categorías", datos({ categorias: [] })],
    ["inicio pasado", datos({ inicio: "2020-01-01T20:00:00-05:00" })],
    ["JSON mal formado", "{titulo:"],
  ])("datos inválidos (%s) → 400 DATOS_INVALIDOS", async (_caso, cuerpo) => {
    const peticion = api(app, fallido.token)
      .post(RUTA)
      .field("datos", typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo))
      .attach("foto", PNG, "foto.png");
    const respuesta = await peticion;

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe("DATOS_INVALIDOS");
    await sinRastroDelFallido();
  });

  it.each([
    ["foto que no es imagen", { foto: PDF }],
    ["foto de más de 5 MB", { foto: Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]) }],
  ])("archivo no válido (%s) → 400 ARCHIVO_NO_VALIDO", async (_caso, archivos) => {
    const respuesta = await alta(fallido, datos(), archivos);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe("ARCHIVO_NO_VALIDO");
    await sinRastroDelFallido();
  });

  it("público o admin → 403; sin token → 401", async () => {
    expect((await alta(publico, datos(), { foto: PNG })).status).toBe(403);
    expect((await alta(admin, datos(), { foto: PNG })).status).toBe(403);
    expect((await alta(undefined, datos(), { foto: PNG })).status).toBe(401);
    expect((await api(app, publico.token).get(`${RUTA}/sedes`)).status).toBe(403);
  });

  it("GET /eventos/sedes lista las sedes compartidas con su capacidad", async () => {
    const respuesta = await api(app, organizador.token).get(`${RUTA}/sedes`);

    expect(respuesta.status).toBe(200);
    const sedes = SedeResumenSchema.array().parse(respuesta.body);
    expect(sedes).toContainEqual(expect.objectContaining({ id: SEDE_CROQUIS_ID, distrito: "Piura", capacidad: 643 }));
    expect(sedes).toContainEqual(expect.objectContaining({ id: SEDE_GENERAL_ID, distrito: "Castilla", capacidad: 120 }));
  });

  it("las funciones del alta no se pueden ejecutar desde el navegador (AD-1)", async () => {
    const { url, clavePublica } = entornoDePrueba();
    const navegador = createClient(url, clavePublica, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${organizador.token}` } },
    });

    const creada = await navegador.rpc("eventos_crear_evento", { datos: datos() });
    const listada = await navegador.rpc("eventos_listar_sedes");

    expect(creada.error?.code).toBe("42501");
    expect(listada.error?.code).toBe("42501");
  });
});
