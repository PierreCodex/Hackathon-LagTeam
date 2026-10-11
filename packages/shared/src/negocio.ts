import { z } from "zod";
import { ModeloComisionSchema } from "./ventas.js";

const centimos = z.number().int().min(0);
const conteo = z.number().int().min(0);

/**
 * Comisión vigente de la plataforma (AD-10). `valor`: puntos básicos si es `porcentaje` (500 = 5 %),
 * céntimos por entrada si es `fijo_por_entrada` y céntimos por evento si es `tarifa_evento`.
 */
export const ComisionSchema = z
  .object({ modelo: ModeloComisionSchema, valor: z.number().int().min(0).max(100_000_00) })
  .refine((c) => c.modelo !== "porcentaje" || c.valor <= 10_000, {
    message: "valor: el porcentaje no puede pasar de 100 %",
    path: ["valor"],
  });
export type Comision = z.infer<typeof ComisionSchema>;

/** Liquidación de un organizador: ventas brutas menos la comisión congelada en cada orden. */
export const LiquidacionSchema = z.object({
  organizador_id: z.uuid(),
  correo: z.string(),
  eventos: conteo,
  entradas: conteo,
  bruto_centimos: centimos,
  comision_centimos: centimos,
  neto_centimos: z.number().int(),
});
export type Liquidacion = z.infer<typeof LiquidacionSchema>;

export const FilaTableroSchema = z.object({ clave: z.string(), entradas: conteo, importe_centimos: centimos });
export type FilaTablero = z.infer<typeof FilaTableroSchema>;

export const EventoTableroSchema = z.object({
  evento_id: z.uuid(),
  titulo: z.string(),
  categoria: z.string(),
  distrito: z.string(),
  inicio: z.string(),
  aforo: conteo,
  entradas: conteo,
  asistentes: conteo,
  importe_centimos: centimos,
});
export type EventoTablero = z.infer<typeof EventoTableroSchema>;

/** `GET /api/v1/negocio/tablero` (administrador): todo lo del tablero, la liquidación y la comisión. */
export const TableroSchema = z.object({
  /** Instante del cálculo: separa los eventos ya realizados de los futuros. */
  generado_en: z.string(),
  comision: ComisionSchema,
  resumen: z.object({
    ventas_centimos: centimos,
    comision_centimos: centimos,
    entradas: conteo,
    asistentes: conteo,
    compradores: conteo,
    eventos: conteo,
  }),
  por_categoria: z.array(FilaTableroSchema),
  por_distrito: z.array(FilaTableroSchema),
  por_dia: z.array(FilaTableroSchema),
  /** Perfil del público: compradores por ciudad declarada al registrarse. */
  publico_por_ciudad: z.array(z.object({ ciudad: z.string(), compradores: conteo })),
  eventos: z.array(EventoTableroSchema),
  liquidacion: z.array(LiquidacionSchema),
});
export type Tablero = z.infer<typeof TableroSchema>;

const metricasVenta = { ordenes: conteo, entradas: conteo, importe_centimos: centimos };

/** Enlace rastreable de una pieza con sus clics y ventas pagadas (AD-8). */
export const VentaEnlaceSchema = z.object({
  codigo: z.string(),
  red: z.string().nullable(),
  zona: z.string().nullable(),
  clics: conteo,
  ...metricasVenta,
});
export type VentaEnlace = z.infer<typeof VentaEnlaceSchema>;

/** Ventas de una pieza de marketing: la suma de sus enlaces. */
export const VentaPiezaSchema = z.object({
  pieza_id: z.uuid(),
  evento_id: z.uuid(),
  titulo_evento: z.string(),
  clics: conteo,
  ...metricasVenta,
  enlaces: z.array(VentaEnlaceSchema),
});
export type VentaPieza = z.infer<typeof VentaPiezaSchema>;

export const VentaEventoSchema = z.object({
  evento_id: z.uuid(),
  titulo: z.string(),
  inicio: z.string(),
  aforo: conteo,
  asistentes: conteo,
  ...metricasVenta,
  por_categoria: z.array(FilaTableroSchema),
});
export type VentaEvento = z.infer<typeof VentaEventoSchema>;

/** `GET /api/v1/negocio/mis-ventas` (organizador): sus ventas por evento, por categoría de precio y por pieza. */
export const VentasOrganizadorSchema = z.object({
  resumen: z.object({ ...metricasVenta, clics: conteo, comision_centimos: centimos, neto_centimos: z.number().int() }),
  eventos: z.array(VentaEventoSchema),
  piezas: z.array(VentaPiezaSchema),
  /** Ventas que no llegaron por un enlace rastreable (catálogo, enlace directo). */
  sin_enlace: z.object(metricasVenta),
});
export type VentasOrganizador = z.infer<typeof VentasOrganizadorSchema>;
