import { LIMITES_MAPA } from "@reto18/shared";
import { ANCHO_PASILLO, type EstadoSeccion } from "./pizarra-mapa";

/**
 * Mapa automático tipo cine (historia 2.13, versión web): el organizador da filas × asientos por fila y
 * cómo agrupar las filas en secciones (p. ej. VIP, Platea, General); la pizarra se llena sola y luego
 * se retoca a mano. Cada sección recibe su precio en la pizarra de precios (2.10).
 */

/** Grupo de filas consecutivas que forman una sección. */
export type GrupoFilas = { nombre: string; filas: number };

export type ConfigCine = {
  filas: number;
  asientosPorFila: number;
  /** Divide cada fila en dos bloques con un pasillo al medio. */
  pasilloCentral: boolean;
  /** Secciones de adelante (junto al escenario) hacia atrás; sus filas deben sumar `filas`. */
  grupos: GrupoFilas[];
};

/** Nombre de la fila n (0 → "A", 25 → "Z", 26 → "AA"). */
export function nombreFila(n: number): string {
  let nombre = "";
  let resto = n;
  do {
    nombre = String.fromCharCode(65 + (resto % 26)) + nombre;
    resto = Math.floor(resto / 26) - 1;
  } while (resto >= 0);
  return nombre;
}

/** Filas y asientos por fila sugeridos para un aforo, en proporción de sala (más ancha que profunda). */
export function sugerirDimensiones(total: number): { filas: number; asientosPorFila: number } {
  if (!Number.isFinite(total) || total < 1) return { filas: 0, asientosPorFila: 0 };
  const filas = Math.max(1, Math.round(Math.sqrt(total / 1.6)));
  return { filas, asientosPorFila: Math.min(LIMITES_MAPA.asientosPorFila, Math.ceil(total / filas)) };
}

/**
 * Secciones sugeridas: hasta 3 filas, una sola; si no, VIP adelante (~20 %), Platea al medio (~40 %)
 * y General atrás (el resto).
 */
export function sugerirGrupos(filas: number): GrupoFilas[] {
  if (filas < 1) return [];
  if (filas <= 3) return [{ nombre: "General", filas }];
  const vip = Math.max(1, Math.round(filas * 0.2));
  const platea = Math.max(1, Math.round(filas * 0.4));
  const general = filas - vip - platea;
  return general > 0
    ? [{ nombre: "VIP", filas: vip }, { nombre: "Platea", filas: platea }, { nombre: "General", filas: general }]
    : [{ nombre: "VIP", filas: vip }, { nombre: "Platea", filas: filas - vip }];
}

/** Primer problema de la configuración, o `null` si se puede generar. */
export function validarConfigCine(config: ConfigCine): string | null {
  const { filas, asientosPorFila, grupos } = config;
  if (!Number.isInteger(filas) || filas < 1) return "Indica cuántas filas tendrá la sala.";
  if (!Number.isInteger(asientosPorFila) || asientosPorFila < 1) return "Indica cuántos asientos tendrá cada fila.";
  if (asientosPorFila > LIMITES_MAPA.asientosPorFila) return `Una fila tiene como máximo ${LIMITES_MAPA.asientosPorFila} asientos.`;
  if (filas * asientosPorFila > LIMITES_MAPA.asientos) return `La sede tiene como máximo ${LIMITES_MAPA.asientos} asientos.`;
  if (grupos.length < 1) return "Agrega al menos una sección.";
  if (grupos.length > LIMITES_MAPA.secciones) return `Puedes tener como máximo ${LIMITES_MAPA.secciones} secciones.`;
  const nombres = new Set<string>();
  for (const g of grupos) {
    const nombre = g.nombre.trim();
    if (!nombre) return "Ponle nombre a cada sección.";
    if (nombres.has(nombre.toLowerCase())) return `Hay dos secciones llamadas "${nombre}".`;
    nombres.add(nombre.toLowerCase());
    if (!Number.isInteger(g.filas) || g.filas < 1) return `La sección "${nombre}" necesita al menos una fila.`;
    if (g.filas > LIMITES_MAPA.filasPorSeccion) return `Una sección tiene como máximo ${LIMITES_MAPA.filasPorSeccion} filas.`;
  }
  const suma = grupos.reduce((s, g) => s + g.filas, 0);
  if (suma !== filas) return `Las secciones suman ${suma} filas y la sala tiene ${filas}.`;
  return null;
}

/** Secciones de la pizarra: filas con letras continuas (A, B, C… entre secciones) y asientos 1…N. */
export function generarSeccionesCine(config: ConfigCine, nuevoId: () => string = () => crypto.randomUUID()): EstadoSeccion[] {
  const { asientosPorFila, pasilloCentral, grupos } = config;
  const izquierda = pasilloCentral && asientosPorFila > 1 ? Math.ceil(asientosPorFila / 2) : asientosPorFila;
  const tamanos = izquierda < asientosPorFila ? [izquierda, asientosPorFila - izquierda] : [asientosPorFila];
  let fila = 0;
  return grupos.map((grupo) => ({
    id: nuevoId(),
    nombre: grupo.nombre.trim(),
    filas: Array.from({ length: grupo.filas }, () => ({
      id: nuevoId(),
      nombre: nombreFila(fila++),
      bloques: tamanos.map((n, k) => ({
        id: nuevoId(),
        desplazamiento: k === 0 ? 0 : ANCHO_PASILLO,
        asientos: Array.from({ length: n }, () => ({ id: nuevoId() })),
      })),
    })),
  }));
}
