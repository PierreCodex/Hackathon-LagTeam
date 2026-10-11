import { CODIGO_BD_NO_DISPONIBLE, CODIGOS_EVENTOS, DuplicarSedeSchema, LIMITES_MAPA, MapaSedeEntradaSchema } from "@reto18/shared";
import { describe, expect, it, vi } from "vitest";
import { entradaDeCroquis, mapaDeCroquis } from "../../test/fixtures/croquis.js";
import type { ClienteSupabase } from "../supabase/supabase.module.js";
import type { ArchivosEventos } from "./archivos-eventos.js";
import { EventosService, validarConEsquema } from "./eventos.service.js";

const ORGANIZADOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SEDE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EVENTO = "11111111-1111-4111-8111-111111111111";
const ZONA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type Entrada = ReturnType<typeof entradaDeCroquis>;
type SeccionNumerada = Extract<Entrada["secciones"][number], { tipo: "numerada" }>;

function numerada(entrada: Entrada, i = 0): SeccionNumerada {
  return entrada.secciones[i] as SeccionNumerada;
}

/** Valida como el controlador y devuelve el mensaje de 400 `DATOS_INVALIDOS`. */
function mensajeDeError(valor: unknown): string {
  try {
    validarConEsquema(MapaSedeEntradaSchema, valor, "mapa");
  } catch (e) {
    const respuesta = (e as { response: { codigo: string; mensaje: string } }).response;
    expect(respuesta.codigo).toBe(CODIGOS_EVENTOS.DATOS_INVALIDOS);
    return respuesta.mensaje;
  }
  throw new Error("El mapa debía ser inválido");
}

describe("MapaSedeEntradaSchema", () => {
  it("acepta el mapa de los croquis sin ids (643 asientos)", () => {
    const mapa = MapaSedeEntradaSchema.parse(entradaDeCroquis());
    const asientos = mapa.secciones.flatMap((s) => (s.tipo === "numerada" ? s.filas.flatMap((f) => f.bloques.flatMap((b) => b.asientos)) : []));
    expect(asientos).toHaveLength(643);
  });

  it("acepta una sede mixta, huecos en la numeración y el id de una zona general", () => {
    const entrada = entradaDeCroquis();
    numerada(entrada).filas[0]!.bloques[0]!.asientos.splice(3, 1);
    entrada.secciones.push({ id: ZONA, nombre: "Zona general", orden: 4, tipo: "general", capacidad: 80 });
    const mapa = MapaSedeEntradaSchema.parse(entrada);
    expect(mapa.secciones[3]).toMatchObject({ id: ZONA, capacidad: 80 });
  });

  it("descarta los ids de las secciones numeradas, filas, bloques y asientos (lo que da GET .../mapa)", () => {
    const mapa = MapaSedeEntradaSchema.parse(mapaDeCroquis());
    expect(mapa).not.toHaveProperty("id");
    expect(mapa.secciones[0]).not.toHaveProperty("id");
    const fila = (mapa.secciones[0] as SeccionNumerada).filas[0]!;
    expect(fila).not.toHaveProperty("id");
    expect(fila.bloques[0]!.asientos[0]).toEqual({ numero: 1 });
  });

  it.each<[string, (e: Entrada) => unknown, string]>([
    ["asiento repetido en una fila", (e) => { numerada(e).filas[0]!.bloques[1]!.asientos[0]!.numero = 1; return e; }, "secciones.0.filas.0.bloques.1.asientos.0.numero:"],
    ["fila repetida", (e) => { numerada(e).filas[1]!.nombre = "A"; return e; }, "secciones.0.filas.1:"],
    ["bloque con orden repetido", (e) => { numerada(e).filas[0]!.bloques[1]!.orden = 1; return e; }, "secciones.0.filas.0.bloques.1.orden:"],
    ["sección repetida", (e) => { e.secciones[1]!.nombre = "Platea baja"; return e; }, "secciones.1:"],
    ["sección general con filas", (e) => ({ ...e, secciones: [{ nombre: "General", orden: 1, tipo: "general", capacidad: 50, filas: numerada(e).filas }] }), "secciones.0.filas:"],
    ["sección general sin capacidad", (e) => ({ ...e, secciones: [{ nombre: "General", orden: 1, tipo: "general" }] }), "secciones.0.capacidad:"],
    ["sección numerada sin filas", (e) => { numerada(e).filas = []; return e; }, "secciones.0.filas:"],
    ["bloque sin asientos", (e) => { numerada(e).filas[0]!.bloques[0]!.asientos = []; return e; }, "secciones.0.filas.0.bloques.0.asientos:"],
    ["nombre vacío", (e) => ({ ...e, nombre: "   " }), "nombre:"],
    ["sin secciones", (e) => ({ ...e, secciones: [] }), "secciones:"],
    ["número de asiento cero", (e) => { numerada(e).filas[0]!.bloques[0]!.asientos[0]!.numero = 0; return e; }, "secciones.0.filas.0.bloques.0.asientos.0.numero:"],
    ["desplazamiento negativo", (e) => { numerada(e).filas[0]!.bloques[0]!.desplazamiento = -1; return e; }, "secciones.0.filas.0.bloques.0.desplazamiento:"],
    ["id de zona general no válido", (e) => ({ ...e, secciones: [{ id: "zona", nombre: "General", orden: 1, tipo: "general", capacidad: 5 }] }), "secciones.0.id:"],
    ["id de zona general repetido", (e) => ({ ...e, secciones: [
      { id: ZONA, nombre: "General", orden: 1, tipo: "general", capacidad: 5 },
      { id: ZONA, nombre: "Otra", orden: 2, tipo: "general", capacidad: 5 },
    ] }), "secciones.1.id:"],
    ["tipo desconocido", (e) => ({ ...e, secciones: [{ nombre: "Palco", orden: 1, tipo: "palco" }] }), "secciones.0.tipo:"],
  ])("%s → DATOS_INVALIDOS nombrando la ruta", (_caso, cambio, ruta) => {
    expect(mensajeDeError(cambio(entradaDeCroquis()))).toContain(ruta);
  });

  const fila = (nombre: string, asientos: number, bloques = 1) => ({
    nombre, orden: 1,
    bloques: Array.from({ length: bloques }, (_, b) => ({
      orden: b + 1, desplazamiento: 0,
      asientos: Array.from({ length: asientos / bloques }, (_, a) => ({ numero: b * (asientos / bloques) + a + 1 })),
    })),
  });
  const conFilas = (filasPorSeccion: number, asientosPorFila: number, secciones = 1) => ({
    nombre: "Coliseo", direccion: "Av. Grau", distrito: "Piura",
    secciones: Array.from({ length: secciones }, (_, s) => ({
      nombre: `S${s + 1}`, orden: s + 1, tipo: "numerada",
      filas: Array.from({ length: filasPorSeccion }, (_, f) => ({ ...fila(`F${f + 1}`, asientosPorFila), orden: f + 1 })),
    })),
  });

  it("acepta los límites justos: 200 asientos por fila, 100 filas y 5000 asientos", () => {
    expect(MapaSedeEntradaSchema.safeParse(conFilas(25, LIMITES_MAPA.asientosPorFila)).success).toBe(true);
    expect(MapaSedeEntradaSchema.safeParse(conFilas(LIMITES_MAPA.filasPorSeccion, 10)).success).toBe(true);
    expect(JSON.stringify(conFilas(25, 200)).length).toBeLessThan(512 * 1024);
  });

  it.each([
    ["más de 200 asientos en una fila (en varios bloques)", () => ({ ...conFilas(1, 1), secciones: [{ nombre: "S", orden: 1, tipo: "numerada", filas: [fila("A", 202, 2)] }] }), "secciones.0.filas.0.bloques:"],
    ["más de 100 filas", () => conFilas(LIMITES_MAPA.filasPorSeccion + 1, 1), "secciones.0.filas:"],
    ["más de 5000 asientos", () => conFilas(26, 200), "secciones:"],
    ["más de 20 secciones", () => conFilas(1, 1, LIMITES_MAPA.secciones + 1), "secciones:"],
  ])("límite superado (%s) → DATOS_INVALIDOS", (_caso, mapa, ruta) => {
    expect(mensajeDeError(mapa())).toContain(ruta);
  });

  it("DuplicarSedeSchema exige un nombre", () => {
    expect(DuplicarSedeSchema.safeParse({ nombre: "Copia" }).success).toBe(true);
    expect(DuplicarSedeSchema.safeParse({ nombre: " " }).success).toBe(false);
    expect(DuplicarSedeSchema.safeParse({}).success).toBe(false);
  });
});

type RespuestaRpc = { data: unknown; error: { code?: string; message: string; details?: string } | null; status?: number };

/** Cliente simulado: cada RPC responde según su nombre; `from` devuelve el evento publicado. */
function simulado(respuestas: Record<string, RespuestaRpc>) {
  const llamadas = vi.fn();
  const cliente = {
    rpc: (nombre: string, args: unknown) => {
      llamadas(nombre, args);
      return { abortSignal: async () => ({ status: 200, ...(respuestas[nombre] ?? { data: null, error: { message: `sin respuesta para ${nombre}` } }) }) };
    },
    from: () => {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        abortSignal: () => consulta,
        single: async () => ({ data: { id: EVENTO, publicado: true }, error: null }),
      };
      return consulta;
    },
  } as unknown as ClienteSupabase;
  return { servicio: new EventosService(cliente, {} as ArchivosEventos), llamadas };
}

describe("EventosService: mapa de la sede y publicación", () => {
  const leido = { data: { ...mapaDeCroquis(), id: SEDE }, error: null };

  it("crearSede llama a la RPC sin sede, a nombre del organizador, y devuelve el mapa leído", async () => {
    const s = simulado({ eventos_guardar_mapa: { data: SEDE, error: null }, eventos_leer_mapa: leido });
    const entrada = MapaSedeEntradaSchema.parse(entradaDeCroquis());

    const mapa = await s.servicio.crearSede(ORGANIZADOR, entrada);

    expect(s.llamadas).toHaveBeenCalledWith("eventos_guardar_mapa", { p_organizador: ORGANIZADOR, p_sede_id: null, p_mapa: entrada });
    expect(s.llamadas).toHaveBeenCalledWith("eventos_leer_mapa", { p_sede_id: SEDE });
    expect(mapa.id).toBe(SEDE);
  });

  it("guardarMapa y duplicarSede pasan la sede y devuelven el mapa", async () => {
    const otra = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const s = simulado({ eventos_guardar_mapa: { data: SEDE, error: null }, eventos_duplicar_sede: { data: otra, error: null }, eventos_leer_mapa: leido });
    const entrada = MapaSedeEntradaSchema.parse(entradaDeCroquis());

    await s.servicio.guardarMapa(ORGANIZADOR, SEDE, entrada);
    await s.servicio.duplicarSede(ORGANIZADOR, SEDE, "Copia");

    expect(s.llamadas).toHaveBeenCalledWith("eventos_guardar_mapa", { p_organizador: ORGANIZADOR, p_sede_id: SEDE, p_mapa: entrada });
    expect(s.llamadas).toHaveBeenCalledWith("eventos_duplicar_sede", { p_organizador: ORGANIZADOR, p_sede_id: SEDE, p_nombre: "Copia" });
    expect(s.llamadas).toHaveBeenCalledWith("eventos_leer_mapa", { p_sede_id: otra });
  });

  it.each([
    ["crearSede", (s: EventosService) => s.crearSede(ORGANIZADOR, MapaSedeEntradaSchema.parse(entradaDeCroquis())), "eventos_guardar_mapa"],
    ["duplicarSede", (s: EventosService) => s.duplicarSede(ORGANIZADOR, SEDE, "Copia"), "eventos_duplicar_sede"],
  ] as const)("%s: la sede se creó pero no se pudo leer → 503 que pide recargar, no repetir", async (_caso, llamar, rpc) => {
    const s = simulado({ [rpc]: { data: SEDE, error: null }, eventos_leer_mapa: { data: null, error: { message: "timeout" } } });

    await expect(llamar(s.servicio)).rejects.toMatchObject({
      status: 503,
      response: { codigo: CODIGO_BD_NO_DISPONIBLE, mensaje: "El local se creó, pero no se pudo leer. Recarga tus locales." },
    });
  });

  it("leerMapa de una sede inexistente (la RPC da null) → 404 SEDE_NO_EXISTE", async () => {
    const s = simulado({ eventos_leer_mapa: { data: null, error: null } });
    await expect(s.servicio.leerMapa(SEDE)).rejects.toMatchObject({ status: 404, response: { codigo: CODIGOS_EVENTOS.SEDE_NO_EXISTE } });
  });

  it("leerMapa con un mapa que no cumple el contrato → 500", async () => {
    const s = simulado({ eventos_leer_mapa: { data: { id: SEDE }, error: null } });
    await expect(s.servicio.leerMapa(SEDE)).rejects.toMatchObject({ status: 500 });
  });

  it("publicarEvento llama a la RPC y devuelve el evento", async () => {
    const s = simulado({ eventos_publicar_evento: { data: EVENTO, error: null } });

    expect(await s.servicio.publicarEvento(ORGANIZADOR, EVENTO)).toEqual({ id: EVENTO, publicado: true });
    expect(s.llamadas).toHaveBeenCalledWith("eventos_publicar_evento", { p_organizador: ORGANIZADOR, p_evento_id: EVENTO });
  });

  it.each([
    ["SEDE_NO_EXISTE", 404],
    ["SEDE_AJENA", 403],
    ["MAPA_CERRADO", 409],
    ["SECCION_EN_USO", 409],
  ])("guardarMapa: la RPC rechaza con %s → %i", async (codigo, estado) => {
    const s = simulado({ eventos_guardar_mapa: { data: null, error: { code: "P0001", message: codigo, details: "detalle" } } });

    await expect(s.servicio.guardarMapa(ORGANIZADOR, SEDE, MapaSedeEntradaSchema.parse(entradaDeCroquis()))).rejects.toMatchObject({
      status: estado,
      response: { codigo, mensaje: expect.stringContaining("detalle") },
    });
  });

  it.each([
    ["EVENTO_NO_EXISTE", 404],
    ["EVENTO_AJENO", 403],
    ["EVENTO_NO_APROBADO", 409],
    ["AFORO_SUPERA_SEDE", 409],
  ])("publicarEvento: la RPC rechaza con %s → %i", async (codigo, estado) => {
    const s = simulado({ eventos_publicar_evento: { data: null, error: { code: "P0001", message: codigo, details: "detalle" } } });

    await expect(s.servicio.publicarEvento(ORGANIZADOR, EVENTO)).rejects.toMatchObject({ status: estado, response: { codigo } });
  });

  it("duplicarSede de una sede inexistente → 404 SEDE_NO_EXISTE", async () => {
    const s = simulado({ eventos_duplicar_sede: { data: null, error: { code: "P0001", message: "SEDE_NO_EXISTE" } } });
    await expect(s.servicio.duplicarSede(ORGANIZADOR, SEDE, "Copia")).rejects.toMatchObject({ status: 404, response: { codigo: "SEDE_NO_EXISTE" } });
  });

  it("un P0001 desconocido u otro error de la BD → 500", async () => {
    const s = simulado({ eventos_publicar_evento: { data: null, error: { code: "P0001", message: "OTRO" } } });
    await expect(s.servicio.publicarEvento(ORGANIZADOR, EVENTO)).rejects.toMatchObject({ status: 500 });
    const t = simulado({ eventos_guardar_mapa: { data: null, error: { code: "23505", message: "duplicate key" } } });
    await expect(t.servicio.crearSede(ORGANIZADOR, MapaSedeEntradaSchema.parse(entradaDeCroquis()))).rejects.toMatchObject({ status: 500 });
  });

  it("sin respuesta de la BD (tiempo límite) → 503 BD_NO_DISPONIBLE", async () => {
    const s = simulado({ eventos_guardar_mapa: { data: null, error: { code: "", message: "TimeoutError" }, status: 0 } });
    await expect(s.servicio.crearSede(ORGANIZADOR, MapaSedeEntradaSchema.parse(entradaDeCroquis()))).rejects.toMatchObject({
      status: 503,
      response: { codigo: CODIGO_BD_NO_DISPONIBLE },
    });
  });

  it("sin Supabase configurado → 503", async () => {
    const servicio = new EventosService(null, {} as ArchivosEventos);
    await expect(servicio.leerMapa(SEDE)).rejects.toMatchObject({ status: 503 });
    await expect(servicio.publicarEvento(ORGANIZADOR, EVENTO)).rejects.toMatchObject({ status: 503 });
  });
});
