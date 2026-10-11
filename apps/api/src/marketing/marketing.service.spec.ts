import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { CODIGOS_MARKETING } from "@reto18/shared";
import { describe, expect, it, vi } from "vitest";
import type { EventoParaPieza, EventosService } from "../eventos/eventos.service.js";
import type { IaService } from "../ia/ia.service.js";
import { respaldoTextosYCampana } from "../ia/funciones/textos-y-campana.js";
import type { ClienteSupabase } from "../supabase/supabase.module.js";
import type { VentasService } from "../ventas/ventas.service.js";
import { INTENTOS_CODIGO_ENLACE, MarketingService } from "./marketing.service.js";
import type { PublicadorUploadPost } from "./publicador-upload-post.js";

const ORGANIZADOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EVENTO = "11111111-1111-4111-8111-111111111111";
const PIEZA = "22222222-2222-4222-8222-222222222222";

const EVENTO_APROBADO: EventoParaPieza = {
  id: EVENTO,
  organizador_id: ORGANIZADOR,
  estado: "aprobado",
  titulo: "Noche de música piurana",
  descripcion: "Concierto.",
  categoria: "musica",
  inicio: "2030-11-21T01:00:00+00:00",
  distrito: "Piura",
  foto_url: null,
  sede: { nombre: "Teatro", direccion: "Jr. Prueba 123" },
  precio_minimo_centimos: 4000,
};

type Respuesta = { data: unknown; error: { message: string } | null };

/** Cliente simulado: `single` responde al insert y `maybeSingle` a la lectura. */
function servicio(cliente: { insert?: Respuesta; lectura?: Respuesta } | null) {
  const consulta = {
    insert: () => consulta,
    select: () => consulta,
    eq: () => consulta,
    abortSignal: () => consulta,
    single: async () => cliente?.insert,
    maybeSingle: async () => cliente?.lectura,
  };
  const supabase = cliente ? ({ from: () => consulta } as unknown as ClienteSupabase) : null;
  const eventos = { datosParaPieza: vi.fn(async () => EVENTO_APROBADO) };
  const ia = {
    textosYCampana: vi.fn(async () => ({ origen: "respaldo" as const, valor: respaldoTextosYCampana({
      ...EVENTO_APROBADO,
      sede: "Teatro",
      direccion: "Jr. Prueba 123",
    }) })),
  };
  return {
    marketing: new MarketingService(
      supabase,
      eventos as unknown as EventosService,
      ia as unknown as IaService,
      {} as unknown as VentasService,
      {} as unknown as PublicadorUploadPost,
    ),
    eventos,
    ia,
  };
}

async function esperar503(promesa: Promise<unknown>) {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ServiceUnavailableException);
  expect((error as ServiceUnavailableException).getResponse()).toMatchObject({ codigo: CODIGOS_MARKETING.BD_NO_DISPONIBLE });
}

describe("MarketingService: 503 BD_NO_DISPONIBLE", () => {
  it("si falla el insert de la pieza en generarPieza", async () => {
    const { marketing, ia } = servicio({ insert: { data: null, error: { message: "caída" } } });
    await esperar503(marketing.generarPieza(ORGANIZADOR, EVENTO));
    expect(ia.textosYCampana).toHaveBeenCalledOnce();
  });

  it("si falla la lectura (maybeSingle) en obtenerPieza", async () => {
    const { marketing, eventos } = servicio({ lectura: { data: null, error: { message: "caída" } } });
    await esperar503(marketing.obtenerPieza(PIEZA));
    expect(eventos.datosParaPieza).not.toHaveBeenCalled();
  });

  it("si el cliente de Supabase es null (sin configurar), en las dos rutas", async () => {
    const { marketing, eventos, ia } = servicio(null);
    await esperar503(marketing.generarPieza(ORGANIZADOR, EVENTO));
    await esperar503(marketing.obtenerPieza(PIEZA));
    expect(eventos.datosParaPieza).not.toHaveBeenCalled();
    expect(ia.textosYCampana).not.toHaveBeenCalled();
  });
});

type RespuestaBd = { data?: unknown; error?: { message: string; code?: string } | null };

/**
 * Cliente simulado para las rutas de enlaces: cada consulta a `tabla` saca la siguiente respuesta de
 * su cola; se resuelve con `single`, `maybeSingle` o con `await` directo.
 */
function servicioEnlaces(
  colas: Record<string, RespuestaBd[]>,
  ventasPorRef = vi.fn(async (refs: string[]) => refs.map((ref) => ({ ref, ordenes: 0, entradas: 0, importe_centimos: 0 }))),
) {
  const inserciones: { tabla: string; fila: Record<string, unknown> }[] = [];
  const from = vi.fn((tabla: string) => {
    const respuesta = async () => {
      const r = colas[tabla]?.shift() ?? {};
      return { data: r.data ?? null, error: r.error ?? null };
    };
    const consulta: Record<string, unknown> = {
      insert: (fila: Record<string, unknown>) => {
        inserciones.push({ tabla, fila });
        return consulta;
      },
      select: () => consulta,
      eq: () => consulta,
      order: () => consulta,
      abortSignal: () => consulta,
      single: respuesta,
      maybeSingle: respuesta,
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => respuesta().then(ok, ko),
    };
    return consulta;
  });
  const marketing = new MarketingService(
    { from } as unknown as ClienteSupabase,
    {} as unknown as EventosService,
    {} as unknown as IaService,
    { ventasPorRef } as unknown as VentasService,
    {} as unknown as PublicadorUploadPost,
  );
  return { marketing, from, inserciones, ventasPorRef };
}

const PIEZA_PROPIA = { data: { id: PIEZA, evento_id: EVENTO, organizador_id: ORGANIZADOR } };
const PIEZA_AJENA = { data: { id: PIEZA, evento_id: EVENTO, organizador_id: "otro-organizador" } };
const CREADO = "2026-10-11T12:00:00.000000+00:00";
const CODIGO = "aZ09bY18";
const CHOQUE = { error: { message: "duplicate key value violates unique constraint", code: "23505" } };

async function esperar404(promesa: Promise<unknown>, codigo: string) {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(NotFoundException);
  expect((error as NotFoundException).getResponse()).toMatchObject({ codigo });
}

describe("MarketingService.crearEnlace", () => {
  const guardado = {
    data: { codigo: CODIGO, evento_id: EVENTO, pieza_id: PIEZA, red: "instagram", zona: "Castilla", creado_en: CREADO },
  };

  it("guarda el enlace con código base62 de 8, evento y pieza de la BD, red, zona y dueño", async () => {
    const { marketing, inserciones } = servicioEnlaces({ marketing_piezas: [PIEZA_PROPIA], marketing_enlaces: [guardado] });
    const enlace = await marketing.crearEnlace(ORGANIZADOR, PIEZA, { red: "instagram", zona: "Castilla" });
    expect(enlace).toEqual(guardado.data);
    expect(inserciones).toEqual([{
      tabla: "marketing_enlaces",
      fila: {
        codigo: expect.stringMatching(/^[0-9A-Za-z]{8}$/),
        evento_id: EVENTO,
        pieza_id: PIEZA,
        red: "instagram",
        zona: "Castilla",
        organizador_id: ORGANIZADOR,
      },
    }]);
  });

  it("sin red ni zona las guarda como null", async () => {
    const { marketing, inserciones } = servicioEnlaces({
      marketing_piezas: [PIEZA_PROPIA],
      marketing_enlaces: [{ data: { ...guardado.data, red: null, zona: null } }],
    });
    await marketing.crearEnlace(ORGANIZADOR, PIEZA, {});
    expect(inserciones[0]!.fila).toMatchObject({ red: null, zona: null });
  });

  it("si el código choca (23505) genera otro y reintenta", async () => {
    const { marketing, inserciones } = servicioEnlaces({
      marketing_piezas: [PIEZA_PROPIA],
      marketing_enlaces: [CHOQUE, CHOQUE, guardado],
    });
    expect(await marketing.crearEnlace(ORGANIZADOR, PIEZA, {})).toEqual(guardado.data);
    expect(inserciones).toHaveLength(3);
    expect(new Set(inserciones.map((i) => i.fila.codigo)).size).toBe(3);
  });

  it(`tras ${INTENTOS_CODIGO_ENLACE} choques seguidos responde 503`, async () => {
    const { marketing, inserciones } = servicioEnlaces({
      marketing_piezas: [PIEZA_PROPIA],
      marketing_enlaces: Array.from({ length: INTENTOS_CODIGO_ENLACE + 1 }, () => CHOQUE),
    });
    await esperar503(marketing.crearEnlace(ORGANIZADOR, PIEZA, {}));
    expect(inserciones).toHaveLength(INTENTOS_CODIGO_ENLACE);
  });

  it("otro error de la BD no se reintenta: 503", async () => {
    const { marketing, inserciones } = servicioEnlaces({
      marketing_piezas: [PIEZA_PROPIA],
      marketing_enlaces: [{ error: { message: "caída" } }],
    });
    await esperar503(marketing.crearEnlace(ORGANIZADOR, PIEZA, {}));
    expect(inserciones).toHaveLength(1);
  });

  it("pieza ajena, inexistente o id que no es UUID: 404 PIEZA_NO_ENCONTRADA sin insertar", async () => {
    const casos: [string, RespuestaBd[]][] = [[PIEZA, [PIEZA_AJENA]], [PIEZA, [{ data: null }]], ["no-es-un-uuid", []]];
    for (const [id, piezas] of casos) {
      const { marketing, inserciones } = servicioEnlaces({ marketing_piezas: piezas });
      await esperar404(marketing.crearEnlace(ORGANIZADOR, id, {}), CODIGOS_MARKETING.PIEZA_NO_ENCONTRADA);
      expect(inserciones).toHaveLength(0);
    }
  });
});

describe("MarketingService.registrarClic", () => {
  const enlace = { data: { id: "enlace-1", codigo: CODIGO, evento_id: EVENTO } };

  it("código existente: inserta un clic sin datos personales y devuelve el evento", async () => {
    const { marketing, inserciones } = servicioEnlaces({ marketing_enlaces: [enlace], marketing_clics: [{}] });
    expect(await marketing.registrarClic(CODIGO)).toEqual({ codigo: CODIGO, evento_id: EVENTO });
    expect(inserciones).toEqual([{ tabla: "marketing_clics", fila: { enlace_id: "enlace-1" } }]);
  });

  it("formato inválido: 404 ENLACE_NO_ENCONTRADO sin tocar la BD", async () => {
    const { marketing, from } = servicioEnlaces({});
    for (const codigo of ["corto", "demasiado-largo", "abc$efgh"]) {
      await esperar404(marketing.registrarClic(codigo), CODIGOS_MARKETING.ENLACE_NO_ENCONTRADO);
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("código desconocido: 404 ENLACE_NO_ENCONTRADO sin escribir", async () => {
    const { marketing, inserciones } = servicioEnlaces({ marketing_enlaces: [{ data: null }] });
    await esperar404(marketing.registrarClic(CODIGO), CODIGOS_MARKETING.ENLACE_NO_ENCONTRADO);
    expect(inserciones).toHaveLength(0);
  });

  it("si falla la lectura o la escritura: 503", async () => {
    const lectura = servicioEnlaces({ marketing_enlaces: [{ error: { message: "caída" } }] });
    await esperar503(lectura.marketing.registrarClic(CODIGO));
    const escritura = servicioEnlaces({ marketing_enlaces: [enlace], marketing_clics: [{ error: { message: "caída" } }] });
    await esperar503(escritura.marketing.registrarClic(CODIGO));
  });
});

describe("MarketingService.resultadosPieza", () => {
  const fila = (codigo: string, zona: string, clics: number) => ({
    codigo, evento_id: EVENTO, pieza_id: PIEZA, red: "whatsapp", zona, creado_en: CREADO, marketing_clics: [{ count: clics }],
  });

  it("une los clics con ventasPorRef por código y los suma en el total", async () => {
    const ventasPorRef = vi.fn(async () => [
      { ref: "Sullana1", ordenes: 2, entradas: 3, importe_centimos: 12000 },
      { ref: "Castill2", ordenes: 0, entradas: 0, importe_centimos: 0 },
    ]);
    const { marketing } = servicioEnlaces(
      {
        marketing_piezas: [PIEZA_PROPIA],
        marketing_enlaces: [{ data: [fila("Sullana1", "Sullana", 5), fila("Castill2", "Castilla", 1)] }],
      },
      ventasPorRef,
    );
    const resultados = await marketing.resultadosPieza(ORGANIZADOR, PIEZA);
    expect(ventasPorRef).toHaveBeenCalledWith(["Sullana1", "Castill2"]);
    const base = { evento_id: EVENTO, pieza_id: PIEZA, red: "whatsapp", creado_en: CREADO };
    expect(resultados).toEqual({
      pieza_id: PIEZA,
      evento_id: EVENTO,
      total: { clics: 6, ordenes: 2, entradas: 3, importe_centimos: 12000 },
      enlaces: [
        { ...base, codigo: "Sullana1", zona: "Sullana", clics: 5, ordenes: 2, entradas: 3, importe_centimos: 12000 },
        { ...base, codigo: "Castill2", zona: "Castilla", clics: 1, ordenes: 0, entradas: 0, importe_centimos: 0 },
      ],
    });
  });

  it("pieza sin enlaces: totales en 0 y enlaces vacíos", async () => {
    const { marketing } = servicioEnlaces({ marketing_piezas: [PIEZA_PROPIA], marketing_enlaces: [{ data: [] }] });
    expect(await marketing.resultadosPieza(ORGANIZADOR, PIEZA)).toEqual({
      pieza_id: PIEZA,
      evento_id: EVENTO,
      total: { clics: 0, ordenes: 0, entradas: 0, importe_centimos: 0 },
      enlaces: [],
    });
  });

  it("pieza ajena: 404 PIEZA_NO_ENCONTRADA sin leer ventas", async () => {
    const { marketing, ventasPorRef } = servicioEnlaces({ marketing_piezas: [PIEZA_AJENA] });
    await esperar404(marketing.resultadosPieza(ORGANIZADOR, PIEZA), CODIGOS_MARKETING.PIEZA_NO_ENCONTRADA);
    expect(ventasPorRef).not.toHaveBeenCalled();
  });

  it("si falla la lectura de enlaces: 503", async () => {
    const { marketing } = servicioEnlaces({ marketing_piezas: [PIEZA_PROPIA], marketing_enlaces: [{ error: { message: "caída" } }] });
    await esperar503(marketing.resultadosPieza(ORGANIZADOR, PIEZA));
  });
});
