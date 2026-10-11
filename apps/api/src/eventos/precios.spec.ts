import { CODIGO_BD_NO_DISPONIBLE, CODIGOS_EVENTOS, MAXIMO_RANGOS_PRECIO, LIMITES_MAPA, PreciosEntradaSchema } from "@reto18/shared";
import { describe, expect, it, vi } from "vitest";
import type { UsuarioAutenticado } from "../identidad/roles.js";
import type { ClienteSupabase } from "../supabase/supabase.module.js";
import type { ArchivosEventos } from "./archivos-eventos.js";
import { EventosService, validarConEsquema } from "./eventos.service.js";

const ORGANIZADOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTRO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENTO = "11111111-1111-4111-8111-111111111111";
const CATEGORIA = "22222222-2222-4222-8222-222222222222";
const RANGO = "33333333-3333-4333-8333-333333333333";
const ASIENTO = "44444444-4444-4444-8444-444444444444";

const rango = (fila: string, desde: number, hasta: number, seccion = "Platea baja") =>
  ({ categoria_id: CATEGORIA, seccion, fila, desde, hasta });

/** Valida como el controlador y devuelve el mensaje de 400 `DATOS_INVALIDOS`. */
function mensajeDeError(valor: unknown): string {
  try {
    validarConEsquema(PreciosEntradaSchema, valor, "precios");
  } catch (e) {
    const respuesta = (e as { response: { codigo: string; mensaje: string } }).response;
    expect(respuesta.codigo).toBe(CODIGOS_EVENTOS.DATOS_INVALIDOS);
    return respuesta.mensaje;
  }
  throw new Error("Los precios debían ser inválidos");
}

describe("PreciosEntradaSchema", () => {
  it("acepta una fila con varias categorías contiguas, otra fila con los mismos números y la lista vacía", () => {
    const precios = { rangos: [rango("A", 1, 6), rango("A", 7, 16), rango("A", 17, 22), rango("B", 1, 22), rango("A", 1, 22, "Mezanine")] };
    expect(PreciosEntradaSchema.parse(precios)).toEqual(precios);
    expect(PreciosEntradaSchema.parse({ rangos: [] })).toEqual({ rangos: [] });
  });

  it("recorta los nombres de sección y fila", () => {
    expect(PreciosEntradaSchema.parse({ rangos: [rango(" A ", 1, 2, " Platea baja ")] }).rangos[0]).toMatchObject({ seccion: "Platea baja", fila: "A" });
  });

  it.each<[string, unknown, string]>([
    ["rango invertido", { rangos: [rango("A", 7, 6)] }, "rangos.0.hasta:"],
    ["solape con el anterior", { rangos: [rango("A", 1, 6), rango("A", 6, 10)] }, "rangos.1:"],
    ["solape con uno largo que no es el anterior", { rangos: [rango("A", 1, 20), rango("A", 2, 3), rango("A", 5, 6)] }, "rangos.2:"],
    ["solape en desorden", { rangos: [rango("A", 10, 12), rango("A", 1, 10)] }, "rangos.1:"],
    ["número cero", { rangos: [rango("A", 0, 2)] }, "rangos.0.desde:"],
    ["número fuera de límite", { rangos: [rango("A", 1, LIMITES_MAPA.numeroAsiento + 1)] }, "rangos.0.hasta:"],
    ["categoría no válida", { rangos: [{ ...rango("A", 1, 2), categoria_id: "vip" }] }, "rangos.0.categoria_id:"],
    ["fila vacía", { rangos: [rango(" ", 1, 2)] }, "rangos.0.fila:"],
    ["sin rangos", {}, "rangos:"],
  ])("%s → DATOS_INVALIDOS nombrando la ruta", (_caso, valor, ruta) => {
    expect(mensajeDeError(valor)).toContain(ruta);
  });

  it(`acepta ${MAXIMO_RANGOS_PRECIO} rangos y rechaza uno más`, () => {
    const muchos = (n: number) => ({ rangos: Array.from({ length: n }, (_, i) => rango(`F${Math.floor(i / 10)}`, (i % 10) * 2 + 1, (i % 10) * 2 + 2)) });
    expect(PreciosEntradaSchema.safeParse(muchos(MAXIMO_RANGOS_PRECIO)).success).toBe(true);
    expect(mensajeDeError(muchos(MAXIMO_RANGOS_PRECIO + 1))).toContain("rangos:");
  });
});

type Respuesta = { data: unknown; error: { code?: string; message: string; details?: string } | null; status?: number };

const PRECIOS = {
  rangos: [{ id: RANGO, ...rango("A", 1, 2) }],
  asientos: [
    { asiento_id: ASIENTO, seccion: "Platea baja", fila: "A", numero: 1, categoria_id: CATEGORIA },
    { asiento_id: "55555555-5555-4555-8555-555555555555", seccion: "Platea baja", fila: "A", numero: 3, categoria_id: null },
  ],
  categorias: [{ id: CATEGORIA, evento_id: EVENTO, sede_id: "66666666-6666-4666-8666-666666666666", nombre: "VIP", color: "#D97706", precio_centimos: 5000, seccion_id: null }],
};

/**
 * Cliente simulado: cada RPC responde según su nombre. `from("eventos_eventos")` devuelve `evento`
 * (la verificación de dueño); `from("eventos_categorias_precio")` devuelve `categorias` (el `select`
 * extra de `preciosDe`), por defecto las de `PRECIOS`.
 */
function simulado(
  respuestas: Record<string, Respuesta>,
  evento: Respuesta = { data: { id: EVENTO, organizador_id: ORGANIZADOR }, error: null },
  categorias: Respuesta = { data: PRECIOS.categorias, error: null },
) {
  const llamadas = vi.fn();
  const cliente = {
    rpc: (nombre: string, args: unknown) => {
      llamadas(nombre, args);
      return { abortSignal: async () => ({ status: 200, ...(respuestas[nombre] ?? { data: null, error: { message: `sin respuesta para ${nombre}` } }) }) };
    },
    from: (tabla: string) => {
      if (tabla === "eventos_categorias_precio") {
        const consultaCategorias = { select: () => consultaCategorias, eq: () => consultaCategorias, order: () => consultaCategorias, abortSignal: async () => categorias };
        return consultaCategorias;
      }
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        abortSignal: () => consulta,
        maybeSingle: async () => evento,
      };
      return consulta;
    },
  } as unknown as ClienteSupabase;
  return { servicio: new EventosService(cliente, {} as ArchivosEventos), llamadas };
}

const usuario = (id: string, rol: "organizador" | "admin" | "publico" = "organizador") =>
  ({ id, perfil: { rol } }) as unknown as UsuarioAutenticado;

describe("EventosService: precios por rango", () => {
  it("guardarPrecios llama a la RPC con los rangos y devuelve los precios leídos", async () => {
    const s = simulado({ eventos_guardar_precios: { data: EVENTO, error: null }, eventos_leer_precios: { data: PRECIOS, error: null } });
    const entrada = PreciosEntradaSchema.parse({ rangos: [rango("A", 1, 2)] });

    expect(await s.servicio.guardarPrecios(ORGANIZADOR, EVENTO, entrada)).toEqual(PRECIOS);
    expect(s.llamadas).toHaveBeenCalledWith("eventos_guardar_precios", { p_organizador: ORGANIZADOR, p_evento_id: EVENTO, p_rangos: entrada.rangos });
    expect(s.llamadas).toHaveBeenCalledWith("eventos_leer_precios", { p_evento_id: EVENTO });
  });

  it.each([
    ["EVENTO_NO_EXISTE", 404],
    ["EVENTO_AJENO", 403],
    ["EVENTO_PUBLICADO", 409],
    ["RANGO_FUERA_DEL_MAPA", 400],
    ["CATEGORIA_NO_VALIDA", 400],
    ["DATOS_INVALIDOS", 400],
  ])("guardarPrecios: la RPC rechaza con %s → %i", async (codigo, estado) => {
    const s = simulado({ eventos_guardar_precios: { data: null, error: { code: "P0001", message: codigo, details: "detalle" } } });

    await expect(s.servicio.guardarPrecios(ORGANIZADOR, EVENTO, { rangos: [] })).rejects.toMatchObject({
      status: estado,
      response: { codigo, mensaje: expect.stringContaining("detalle") },
    });
    expect(s.llamadas).not.toHaveBeenCalledWith("eventos_leer_precios", expect.anything());
  });

  it("publicarEvento: la RPC rechaza con ASIENTOS_SIN_PRECIO → 409", async () => {
    const s = simulado({ eventos_publicar_evento: { data: null, error: { code: "P0001", message: "ASIENTOS_SIN_PRECIO", details: "3 asientos" } } });
    await expect(s.servicio.publicarEvento(ORGANIZADOR, EVENTO)).rejects.toMatchObject({
      status: 409, response: { codigo: "ASIENTOS_SIN_PRECIO", mensaje: expect.stringContaining("3 asientos") },
    });
  });

  it("guardados pero sin poder leerlos → 503 que pide recargar", async () => {
    const s = simulado({ eventos_guardar_precios: { data: EVENTO, error: null }, eventos_leer_precios: { data: null, error: { message: "timeout" } } });
    await expect(s.servicio.guardarPrecios(ORGANIZADOR, EVENTO, { rangos: [] })).rejects.toMatchObject({
      status: 503, response: { codigo: CODIGO_BD_NO_DISPONIBLE, mensaje: expect.stringContaining("se guardaron") },
    });
  });

  it("leerPrecios: el dueño y el admin leen; otro organizador → 403 EVENTO_AJENO", async () => {
    const s = simulado({ eventos_leer_precios: { data: PRECIOS, error: null } });
    expect(await s.servicio.leerPrecios(usuario(ORGANIZADOR), EVENTO)).toEqual(PRECIOS);
    expect(await s.servicio.leerPrecios(usuario(OTRO, "admin"), EVENTO)).toEqual(PRECIOS);
    await expect(s.servicio.leerPrecios(usuario(OTRO), EVENTO)).rejects.toMatchObject({ status: 403, response: { codigo: "EVENTO_AJENO" } });
  });

  it("leerPrecios de un evento inexistente → 404; con la BD caída → 503; con datos fuera de contrato → 500", async () => {
    await expect(simulado({}, { data: null, error: null }).servicio.leerPrecios(usuario(ORGANIZADOR), EVENTO))
      .rejects.toMatchObject({ status: 404, response: { codigo: "EVENTO_NO_EXISTE" } });
    await expect(simulado({}, { data: null, error: { message: "caída" } }).servicio.leerPrecios(usuario(ORGANIZADOR), EVENTO))
      .rejects.toMatchObject({ status: 503 });
    await expect(simulado({ eventos_leer_precios: { data: { rangos: [] }, error: null } }).servicio.leerPrecios(usuario(ORGANIZADOR), EVENTO))
      .rejects.toMatchObject({ status: 500 });
  });
});
