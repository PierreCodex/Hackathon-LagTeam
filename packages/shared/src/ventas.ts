import { z } from "zod";

const fechaHora = z.iso.datetime({ offset: true });
const centimos = z.number().int().min(0);

/** Máximo de entradas por orden. */
export const MAXIMO_ENTRADAS_POR_ORDEN = 10;
/** Minutos que una orden pendiente reserva el cupo (AD-5). */
export const MINUTOS_RESERVA_ORDEN = 10;

/** Métodos del pago simulado (AD-6): sin datos reales de tarjeta. */
export const MetodoPagoSchema = z.enum(["tarjeta", "yape", "plin"]);
export type MetodoPago = z.infer<typeof MetodoPagoSchema>;

export const EstadoOrdenSchema = z.enum(["pendiente", "pagada", "expirada"]);
export type EstadoOrden = z.infer<typeof EstadoOrdenSchema>;

/** Modelos de comisión de la plataforma (AD-10). */
export const ModeloComisionSchema = z.enum(["porcentaje", "fijo_por_entrada", "tarifa_evento"]);
export type ModeloComision = z.infer<typeof ModeloComisionSchema>;

/** Cuerpo de `POST /api/v1/ventas/ordenes`. `ref`: código del enlace rastreable, sin validar (AD-8). */
export const CrearOrdenSchema = z.object({
  evento_id: z.uuid(),
  categoria_id: z.uuid(),
  cantidad: z.number().int().min(1).max(MAXIMO_ENTRADAS_POR_ORDEN),
  /** Nunca rechaza la orden (AD-8): un `ref` vacío o de más de 64 caracteres (tras recortar) queda ausente. */
  ref: z.string().optional().transform((ref) => {
    const limpio = ref?.trim();
    return limpio && limpio.length <= 64 ? limpio : undefined;
  }),
});
export type CrearOrden = z.infer<typeof CrearOrdenSchema>;

/** Cuerpo de `POST /api/v1/ventas/ordenes/asiento` (historia 2.11, mapa de butacas). */
export const CrearOrdenAsientoSchema = z.object({
  evento_id: z.uuid(),
  asiento_id: z.uuid(),
  /** Nunca rechaza la orden (AD-8): un `ref` vacío o de más de 64 caracteres (tras recortar) queda ausente. */
  ref: z.string().optional().transform((ref) => {
    const limpio = ref?.trim();
    return limpio && limpio.length <= 64 ? limpio : undefined;
  }),
});
export type CrearOrdenAsiento = z.infer<typeof CrearOrdenAsientoSchema>;

/** Cuerpo de `POST /api/v1/ventas/ordenes/:id/pagar`. */
export const PagarOrdenSchema = z.object({ metodo: MetodoPagoSchema });
export type PagarOrden = z.infer<typeof PagarOrdenSchema>;

/** Id de una orden en la ruta (`:id`). */
export const OrdenIdSchema = z.uuid();

/** Orden de compra tal como la ve quien compra (la comisión no se expone). Importes en céntimos (AD-10). */
export const OrdenSchema = z.object({
  id: z.uuid(),
  evento_id: z.uuid(),
  categoria_id: z.uuid(),
  cantidad: z.number().int().min(1).max(MAXIMO_ENTRADAS_POR_ORDEN),
  precio_unitario_centimos: centimos,
  total_centimos: centimos,
  estado: EstadoOrdenSchema,
  expira_en: fechaHora,
  ref: z.string().nullable(),
  metodo_pago: MetodoPagoSchema.nullable(),
  pagada_en: fechaHora.nullable(),
  creado_en: fechaHora,
  /** Butaca numerada (2.11); `null` en una orden de zona general. */
  asiento_id: z.uuid().nullable(),
});
export type Orden = z.infer<typeof OrdenSchema>;

/** Dónde queda una butaca numerada, para mostrarla en la entrada (2.11). */
export const AsientoEntradaSchema = z.object({ seccion: z.string(), fila: z.string(), numero: z.number().int() });

/** Entrada emitida: `qr` = `entrada_id.firma` (HMAC-SHA256, AD-7). */
export const EntradaSchema = z.object({
  id: z.uuid(),
  orden_id: z.uuid(),
  evento_id: z.uuid(),
  qr: z.string().min(1),
  usada_en: fechaHora.nullable(),
  /** `null` en una entrada de zona general. */
  asiento: AsientoEntradaSchema.nullable(),
});
export type Entrada = z.infer<typeof EntradaSchema>;

/** Respuesta de `POST /api/v1/ventas/ordenes/:id/pagar` (200). */
export const OrdenPagadaSchema = z.object({
  orden: OrdenSchema,
  entradas: z.array(EntradaSchema).min(1),
});
export type OrdenPagada = z.infer<typeof OrdenPagadaSchema>;

/** Elemento de `GET /api/v1/ventas/mis-entradas`. */
export const MiEntradaSchema = EntradaSchema.extend({
  categoria: z.string(),
  evento: z.object({
    id: z.uuid(),
    titulo: z.string(),
    inicio: fechaHora,
    sede: z.object({ nombre: z.string(), direccion: z.string() }),
  }),
});
export type MiEntrada = z.infer<typeof MiEntradaSchema>;
export const MisEntradasSchema = z.array(MiEntradaSchema);

/** Ventas pagadas de un enlace rastreable (`ventasPorRef`, AD-8). */
export const VentasPorRefSchema = z.object({
  ref: z.string(),
  ordenes: z.number().int().min(0),
  entradas: z.number().int().min(0),
  importe_centimos: centimos,
});
export type VentasPorRef = z.infer<typeof VentasPorRefSchema>;

/** Butaca numerada a la venta (historia 2.11): sin categoría de precio pintada, solo disponible/vendida. */
export const ButacaVentaSchema = z.object({
  asiento_id: z.uuid(),
  seccion: z.string(),
  fila: z.string(),
  numero: z.number().int(),
  precio_centimos: centimos,
  estado: z.enum(["disponible", "vendida"]),
});
export type ButacaVenta = z.infer<typeof ButacaVentaSchema>;
export const ButacasVentaSchema = z.array(ButacaVentaSchema);

/** Códigos de error del módulo `ventas`. */
export const CODIGOS_VENTAS = {
  EVENTO_NO_ENCONTRADO: "EVENTO_NO_ENCONTRADO",
  CATEGORIA_NO_VALIDA: "CATEGORIA_NO_VALIDA",
  SIN_CUPO: "SIN_CUPO",
  /** La butaca no existe en este evento (2.11). */
  ASIENTO_NO_EXISTE: "ASIENTO_NO_EXISTE",
  /** La butaca ya no está disponible: otro comprador se adelantó (2.11, AD-5). */
  BUTACA_NO_DISPONIBLE: "BUTACA_NO_DISPONIBLE",
  VENTA_CERRADA: "VENTA_CERRADA",
  ORDEN_NO_ENCONTRADA: "ORDEN_NO_ENCONTRADA",
  ORDEN_NO_PENDIENTE: "ORDEN_NO_PENDIENTE",
  ORDEN_EXPIRADA: "ORDEN_EXPIRADA",
  PAGO_RECHAZADO: "PAGO_RECHAZADO",
  /** No hay comisión vigente en `ventas_config_comision`: no se confirma el pago (el cobro se anula). */
  COMISION_NO_CONFIGURADA: "COMISION_NO_CONFIGURADA",
  /** Falta `QR_SECRET` en la API: no se emiten ni se validan entradas. */
  QR_NO_CONFIGURADO: "QR_NO_CONFIGURADO",
  /** Mismo valor que `CODIGO_BD_NO_DISPONIBLE`. */
  BD_NO_DISPONIBLE: "BD_NO_DISPONIBLE",
} as const;
export type CodigoVentas = (typeof CODIGOS_VENTAS)[keyof typeof CODIGOS_VENTAS];
