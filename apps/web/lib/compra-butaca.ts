import { CODIGOS_VENTAS, type ErrorApi } from "@reto18/shared";

/**
 * Lógica pura del mapa de butacas (historia 2.11, versión reducida del 11/10/2026): sin bloqueo
 * temporal ni colores por categoría de precio, solo disponible/vendida/seleccionada. Sin React ni
 * navegador, igual que `pizarra-precios.ts`.
 */

/** Verde de una butaca libre. Nunca los tokens `--color-seat-*`/`--color-price-*` (otro contexto): hex directo. */
export const COLOR_DISPONIBLE = "#2bb5a0";
/** Blanco de la butaca que el comprador tiene elegida. */
export const COLOR_SELECCIONADA = "#ffffff";
/** Gris oscuro de una butaca ya vendida. */
export const COLOR_VENDIDA = "#3a3b3d";

/** Color (hex) de una butaca según su estado y si es la seleccionada; una vendida nunca se selecciona. */
export function colorDeButaca(estado: "disponible" | "vendida", seleccionada: boolean): string {
  if (estado === "vendida") return COLOR_VENDIDA;
  return seleccionada ? COLOR_SELECCIONADA : COLOR_DISPONIBLE;
}

/** Mismo valor que `CODIGO_SIN_CONEXION` de `lib/api` (archivo sin dependencias de red, igual que `pizarra-precios.ts`). */
const CODIGO_SIN_CONEXION_BUTACA = "SIN_CONEXION";

export type ResultadoErrorCompraButaca =
  | { tipo: "revisar_mapa" }
  | { tipo: "reintentar" }
  | { tipo: "generico" };

/**
 * Decide qué hacer ante un error de crear la orden o pagar (matriz I/O): `BUTACA_NO_DISPONIBLE`,
 * `ASIENTO_NO_EXISTE` o `VENTA_CERRADA` (alguien se adelantó, o la butaca ya no existe o la venta
 * cerró) → "revisar_mapa": hay que refrescar el estado de las butacas y limpiar la selección;
 * sin conexión → "reintentar"; cualquier otro código → aviso genérico con el mensaje de la API.
 */
export function estadoDeErrorCompraButaca(error: ErrorApi): ResultadoErrorCompraButaca {
  if (
    error.codigo === CODIGOS_VENTAS.BUTACA_NO_DISPONIBLE ||
    error.codigo === CODIGOS_VENTAS.ASIENTO_NO_EXISTE ||
    error.codigo === CODIGOS_VENTAS.VENTA_CERRADA
  ) {
    return { tipo: "revisar_mapa" };
  }
  if (error.codigo === CODIGO_SIN_CONEXION_BUTACA) return { tipo: "reintentar" };
  return { tipo: "generico" };
}
