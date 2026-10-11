import type { Comision, ModeloComision } from "@reto18/shared";
import { solesACentimos } from "./alta-evento";

export const ETIQUETA_MODELO: Record<ModeloComision, string> = {
  porcentaje: "Porcentaje por entrada",
  fijo_por_entrada: "Monto fijo por entrada",
  tarifa_evento: "Tarifa por evento",
};

/** Comisión legible: "5 % de cada venta", "S/ 2 por entrada" o "S/ 50 por evento". */
export function textoComision(c: Comision): string {
  if (c.modelo === "porcentaje") return `${c.valor / 100} % de cada venta`;
  const soles = c.valor / 100;
  const monto = `S/ ${Number.isInteger(soles) ? soles : soles.toFixed(2)}`;
  return c.modelo === "fijo_por_entrada" ? `${monto} por entrada` : `${monto} por evento`;
}

/** Valor del formulario (en % o en soles) tal como se muestra: 500 → "5", 250 → "2.5". */
export function valorEnFormulario(c: Comision): string {
  return String(c.valor / 100);
}

/**
 * Valida el formulario de la comisión. `porcentaje` en %, de 0 a 100, con hasta dos decimales;
 * los demás en soles. Devuelve la comisión para la API (puntos básicos o céntimos).
 */
export function leerComision(modelo: ModeloComision, texto: string): { ok: true; comision: Comision } | { ok: false; error: string } {
  if (modelo === "porcentaje") {
    const limpio = texto.trim().replace(",", ".");
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(limpio)) return { ok: false, error: "Escribe un porcentaje, por ejemplo 5 o 7.5." };
    const puntos = Math.round(Number(limpio) * 100);
    if (puntos > 10_000) return { ok: false, error: "El porcentaje no puede pasar de 100." };
    return { ok: true, comision: { modelo, valor: puntos } };
  }
  const centimos = solesACentimos(texto);
  if (centimos === null) return { ok: false, error: "Escribe un monto en soles, por ejemplo 2 o 2.50." };
  return { ok: true, comision: { modelo, valor: centimos } };
}

/** Porcentaje de una barra respecto al máximo (mínimo 2 % para que se vea si hay algo). */
export function anchoBarra(valor: number, maximo: number): number {
  if (maximo <= 0 || valor <= 0) return 0;
  return Math.max(2, Math.round((valor / maximo) * 100));
}
