import { ConflictException, HttpException, ServiceUnavailableException } from "@nestjs/common";
import { CODIGOS_VENTAS, CrearOrdenSchema } from "@reto18/shared";
import { describe, expect, it, vi } from "vitest";
import type { EventoParaVenta, EventosService } from "../eventos/eventos.service.js";
import { NotificacionesService } from "../notificaciones/notificaciones.service.js";
import type { ClienteSupabase } from "../supabase/supabase.module.js";
import type { PasarelaPago } from "./pasarela-pago.js";
import { FirmaQr, verificarQr } from "./qr.js";
import { calcularComision, cuposGenerales, VentasService } from "./ventas.service.js";

const SECRETO = "secreto-de-prueba-con-longitud-suficiente";
const USUARIO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENTO = "11111111-1111-4111-8111-111111111111";
const ORDEN = "22222222-2222-4222-8222-222222222222";
const ENTRADA = "33333333-3333-4333-8333-333333333333";
const CATEGORIA = "44444444-4444-4444-8444-444444444444";
const AHORA = "2026-10-11T20:00:00.000000+00:00";

describe("calcularComision (AD-10)", () => {
  it("porcentaje en puntos básicos sobre el total, redondeado al céntimo", () => {
    expect(calcularComision("porcentaje", 500, 8000, 2)).toBe(400);
    expect(calcularComision("porcentaje", 500, 4010, 1)).toBe(201); // 200.5 → 201
    expect(calcularComision("porcentaje", 500, 4009, 1)).toBe(200); // 200.45 → 200
    expect(calcularComision("porcentaje", 0, 4000, 1)).toBe(0);
    expect(calcularComision("porcentaje", 10_000, 4000, 1)).toBe(4000);
    expect(calcularComision("porcentaje", 500, 0, 1)).toBe(0);
  });

  it("fijo por entrada multiplica por la cantidad", () => {
    expect(calcularComision("fijo_por_entrada", 150, 8000, 2)).toBe(300);
    expect(calcularComision("fijo_por_entrada", 150, 0, 3)).toBe(450);
  });

  it("tarifa por evento no carga la orden (la liquida la 4.2)", () => {
    expect(calcularComision("tarifa_evento", 50_000, 8000, 2)).toBe(0);
  });
});

function evento(cambios: Partial<EventoParaVenta> = {}): EventoParaVenta {
  return {
    id: EVENTO, organizador_id: USUARIO, estado: "aprobado", publicado: true, inicio: "2030-11-21T01:00:00+00:00",
    aforo: 50, titulo: "Noche piurana", sede: { nombre: "Teatro", direccion: "Jr. Prueba 123" },
    categorias: [
      { id: CATEGORIA, nombre: "General", precio_centimos: 4000, seccion_id: "s1", capacidad_zona: 120 },
      { id: "c2", nombre: "Preferencial", precio_centimos: 6000, seccion_id: "s1", capacidad_zona: 120 },
      { id: "c3", nombre: "Patio", precio_centimos: 2000, seccion_id: "s2", capacidad_zona: 30 },
      { id: "c4", nombre: "Platea", precio_centimos: 8000, seccion_id: null, capacidad_zona: null },
    ],
    ...cambios,
  };
}

describe("cuposGenerales", () => {
  it("un cupo por zona general, con least(capacidad de la zona, aforo)", () => {
    expect(cuposGenerales(evento())).toEqual([
      { seccion_id: "s1", capacidad: 50 },
      { seccion_id: "s2", capacidad: 30 },
    ]);
  });
});

type Respuesta = { data: unknown; error: { code?: string; message: string; details?: string } | null; status?: number };

/** Servicio con BD, eventos, bandeja y pasarela simulados para el pago. */
function servicio(opciones: { orden?: Record<string, unknown> | null; confirmacion: Respuesta; bandejaFalla?: boolean }) {
  const lectura = {
    select: () => lectura, eq: () => lectura, abortSignal: () => lectura,
    maybeSingle: async () => ({ data: opciones.orden === undefined ? filaOrden() : opciones.orden, error: null }),
  };
  const insertBandeja = vi.fn(() => ({
    abortSignal: async () => ({ error: opciones.bandejaFalla ? { message: "bandeja caída" } : null }),
  }));
  const supabase = {
    from: (tabla: string) => (tabla === "notificaciones_bandeja" ? { insert: insertBandeja } : lectura),
    rpc: () => ({ abortSignal: async () => ({ status: 200, ...opciones.confirmacion }) }),
  } as unknown as ClienteSupabase;
  const eventos = { datosParaVenta: vi.fn(async () => evento()) };
  const notificaciones = new NotificacionesService(supabase);
  vi.spyOn((notificaciones as unknown as { logger: { error: () => void } }).logger, "error").mockImplementation(() => {});
  const pasarela: PasarelaPago = {
    cobrar: vi.fn(async () => ({ referencia: "sim_yape_1" })),
    anular: vi.fn(async () => {}),
  };
  const ventas = new VentasService(supabase, eventos as unknown as EventosService, notificaciones, pasarela, new FirmaQr(SECRETO));
  for (const nivel of ["warn", "error"] as const) {
    vi.spyOn((ventas as unknown as { logger: Record<typeof nivel, () => void> }).logger, nivel).mockImplementation(() => {});
  }
  return { ventas, pasarela, insertBandeja };
}

function filaOrden(cambios: Record<string, unknown> = {}) {
  return {
    id: ORDEN, usuario_id: USUARIO, evento_id: EVENTO, categoria_id: CATEGORIA, cantidad: 1,
    precio_unitario_centimos: 4000, total_centimos: 4000, estado: "pendiente", expira_en: AHORA, ref: null,
    metodo_pago: null, pagada_en: null, creado_en: AHORA, ...cambios,
  };
}

const PAGADA: Respuesta = {
  data: { resultado: "pagada", orden: filaOrden({ estado: "pagada", metodo_pago: "yape", pagada_en: AHORA }), entradas: [ENTRADA] },
  error: null,
};
const COMPRADOR = { id: USUARIO, telefono: "+51987654321" };

async function capturar(promesa: Promise<unknown>): Promise<unknown> {
  return promesa.then(() => undefined, (e: unknown) => e);
}

describe("VentasService.pagar", () => {
  it("paga, firma las entradas y encola un aviso pendiente con el QR", async () => {
    const { ventas, pasarela, insertBandeja } = servicio({ confirmacion: PAGADA });
    const resultado = await ventas.pagar(COMPRADOR, ORDEN, "yape");
    expect(resultado.orden.estado).toBe("pagada");
    expect(resultado.entradas).toHaveLength(1);
    expect(verificarQr(resultado.entradas[0]!.qr, SECRETO)).toBe(ENTRADA);
    expect(pasarela.cobrar).toHaveBeenCalledWith({ orden_id: ORDEN, importe_centimos: 4000, metodo: "yape" });
    expect(pasarela.anular).not.toHaveBeenCalled();
    expect(insertBandeja).toHaveBeenCalledWith(expect.objectContaining({
      telefono: "+51987654321", plantilla: "entrada_pagada", adjunto_url: null,
      datos: expect.objectContaining({ orden_id: ORDEN, evento: "Noche piurana", entradas: [{ id: ENTRADA, qr: resultado.entradas[0]!.qr }] }),
    }));
  });

  it("si la bandeja falla, la compra responde igual (AD-9)", async () => {
    const { ventas } = servicio({ confirmacion: PAGADA, bandejaFalla: true });
    await expect(ventas.pagar(COMPRADOR, ORDEN, "yape")).resolves.toMatchObject({ orden: { estado: "pagada" } });
  });

  it("una orden vencida al confirmar: anula el cobro y responde 409 ORDEN_EXPIRADA", async () => {
    const { ventas, pasarela, insertBandeja } = servicio({ confirmacion: { data: { resultado: "expirada" }, error: null } });
    const error = await capturar(ventas.pagar(COMPRADOR, ORDEN, "tarjeta"));
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ codigo: CODIGOS_VENTAS.ORDEN_EXPIRADA });
    expect(pasarela.anular).toHaveBeenCalledWith("sim_yape_1");
    expect(insertBandeja).not.toHaveBeenCalled();
  });

  it("si la BD rechaza el pago (P0001), anula el cobro", async () => {
    const { ventas, pasarela } = servicio({
      confirmacion: { data: null, error: { code: "P0001", message: "ORDEN_NO_PENDIENTE", details: "La orden está pagada" }, status: 400 },
    });
    const error = await capturar(ventas.pagar(COMPRADOR, ORDEN, "plin"));
    expect((error as HttpException).getResponse()).toMatchObject({ codigo: CODIGOS_VENTAS.ORDEN_NO_PENDIENTE });
    expect(pasarela.anular).toHaveBeenCalledOnce();
  });

  it("sin comisión vigente (P0001 COMISION_NO_CONFIGURADA): 503 con ese código y el cobro se anula", async () => {
    const { ventas, pasarela } = servicio({
      confirmacion: { data: null, error: { code: "P0001", message: "COMISION_NO_CONFIGURADA", details: "No hay una comisión vigente" }, status: 400 },
    });
    const error = await capturar(ventas.pagar(COMPRADOR, ORDEN, "yape"));
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as HttpException).getResponse()).toMatchObject({ codigo: CODIGOS_VENTAS.COMISION_NO_CONFIGURADA });
    expect(pasarela.anular).toHaveBeenCalledWith("sim_yape_1");
  });

  it("sin respuesta de la BD no anula (no se sabe si quedó pagada) y responde 503", async () => {
    const { ventas, pasarela } = servicio({ confirmacion: { data: null, error: { message: "timeout" }, status: 0 } });
    const error = await capturar(ventas.pagar(COMPRADOR, ORDEN, "plin"));
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(pasarela.anular).not.toHaveBeenCalled();
  });

  it.each([
    [null, CODIGOS_VENTAS.ORDEN_NO_ENCONTRADA],
    [filaOrden({ estado: "pagada" }), CODIGOS_VENTAS.ORDEN_NO_PENDIENTE],
    [filaOrden({ estado: "expirada" }), CODIGOS_VENTAS.ORDEN_EXPIRADA],
  ])("no cobra una orden ausente, pagada o expirada %#", async (orden, codigo) => {
    const { ventas, pasarela } = servicio({ orden, confirmacion: PAGADA });
    const error = await capturar(ventas.pagar(COMPRADOR, ORDEN, "yape"));
    expect((error as HttpException).getResponse()).toMatchObject({ codigo });
    expect(pasarela.cobrar).not.toHaveBeenCalled();
  });

  it("si la pasarela rechaza, responde 402 PAGO_RECHAZADO sin tocar la orden", async () => {
    const { ventas, pasarela } = servicio({ confirmacion: PAGADA });
    vi.mocked(pasarela.cobrar).mockRejectedValueOnce(new Error("rechazado"));
    const error = await capturar(ventas.pagar(COMPRADOR, ORDEN, "yape"));
    expect((error as HttpException).getStatus()).toBe(402);
    expect((error as HttpException).getResponse()).toMatchObject({ codigo: CODIGOS_VENTAS.PAGO_RECHAZADO });
  });
});

describe("NotificacionesService.encolar", () => {
  it("nunca lanza: sin cliente de Supabase devuelve false", async () => {
    const notificaciones = new NotificacionesService(null);
    vi.spyOn((notificaciones as unknown as { logger: { error: () => void } }).logger, "error").mockImplementation(() => {});
    await expect(notificaciones.encolar({ telefono: "+51987654321", plantilla: "entrada_pagada", datos: {} })).resolves.toBe(false);
  });
});

describe("CrearOrdenSchema.ref (AD-8: se guarda sin validar)", () => {
  const base = { evento_id: ORDEN, categoria_id: CATEGORIA, cantidad: 1 };
  it("recorta y conserva un ref de hasta 64 caracteres", () => {
    expect(CrearOrdenSchema.parse({ ...base, ref: "  abc12345 " }).ref).toBe("abc12345");
    expect(CrearOrdenSchema.parse({ ...base, ref: "x".repeat(64) }).ref).toBe("x".repeat(64));
  });
  it.each(["", "   ", "x".repeat(65), undefined])("un ref vacío, sin texto o de más de 64 queda ausente sin rechazar la orden %#", (ref) => {
    const resultado = CrearOrdenSchema.safeParse({ ...base, ref });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.ref).toBeUndefined();
  });
});
