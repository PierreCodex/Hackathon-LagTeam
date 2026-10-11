import { LIMITES_MAPA } from "@reto18/shared";
import { ANCHO_PASILLO, type EstadoSeccion } from "./pizarra-mapa";

/**
 * Mapa automático tipo cine (historia 2.13, versión web): el organizador reparte las butacas del aforo
 * entre secciones (las categorías de precio del evento: VIP, General…) y elige cuántos asientos van por
 * fila; la pizarra se llena sola, con las filas que hagan falta, y luego se retoca a mano. El total de
 * butacas debe coincidir con el aforo del evento.
 */

/** Sección del generador: nombre (idealmente, el de una categoría de precio) y cuántas butacas tiene. */
export type SeccionCine = { nombre: string; asientos: number };

export type ConfigCine = {
  asientosPorFila: number;
  /** Divide cada fila en dos bloques con un pasillo al medio. */
  pasilloCentral: boolean;
  /** Secciones de adelante (junto al escenario) hacia atrás. */
  secciones: SeccionCine[];
  /** Aforo del evento: si se indica, la suma de butacas debe ser exactamente esta. */
  aforo?: number;
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

/** Asientos por fila sugeridos para un aforo, en proporción de sala (más ancha que profunda). */
export function sugerirAsientosPorFila(aforo: number): number {
  if (!Number.isFinite(aforo) || aforo < 1) return 0;
  const filas = Math.max(1, Math.round(Math.sqrt(aforo / 1.6)));
  return Math.min(LIMITES_MAPA.asientosPorFila, Math.ceil(aforo / filas));
}

/**
 * Reparte el aforo entre las secciones: con una sola, todo; con varias, la primera (la de adelante,
 * la más cara) se lleva una parte menor y el resto se reparte parejo. La suma es siempre el aforo.
 */
export function repartirAforo(aforo: number, nombres: string[]): SeccionCine[] {
  if (nombres.length === 0 || !Number.isInteger(aforo) || aforo < 1) return nombres.map((nombre) => ({ nombre, asientos: 0 }));
  if (nombres.length === 1) return [{ nombre: nombres[0]!, asientos: aforo }];
  const pesos = nombres.map((_, i) => (i === 0 ? 0.6 : 1));
  const suma = pesos.reduce((s, p) => s + p, 0);
  const asientos = pesos.map((p) => Math.max(1, Math.floor((aforo * p) / suma)));
  // Lo que sobra por redondeo va a la última sección (la de atrás).
  asientos[asientos.length - 1]! += aforo - asientos.reduce((s, n) => s + n, 0);
  return nombres.map((nombre, i) => ({ nombre, asientos: asientos[i]! }));
}

/** Filas que ocupa una sección con `asientos` butacas y `porFila` asientos por fila. */
export function filasDeSeccion(asientos: number, porFila: number): number {
  return porFila > 0 ? Math.ceil(asientos / porFila) : 0;
}

/** Primer problema de la configuración, o `null` si se puede generar. */
export function validarConfigCine(config: ConfigCine): string | null {
  const { asientosPorFila, secciones, aforo } = config;
  if (!Number.isInteger(asientosPorFila) || asientosPorFila < 1) return "Indica cuántos asientos van en cada fila.";
  if (asientosPorFila > LIMITES_MAPA.asientosPorFila) return `Una fila tiene como máximo ${LIMITES_MAPA.asientosPorFila} asientos.`;
  if (secciones.length < 1) return "Agrega al menos una sección.";
  if (secciones.length > LIMITES_MAPA.secciones) return `Puedes tener como máximo ${LIMITES_MAPA.secciones} secciones.`;
  const nombres = new Set<string>();
  for (const s of secciones) {
    const nombre = s.nombre.trim();
    if (!nombre) return "Ponle nombre a cada sección.";
    if (nombres.has(nombre.toLowerCase())) return `Hay dos secciones llamadas "${nombre}".`;
    nombres.add(nombre.toLowerCase());
    if (!Number.isInteger(s.asientos) || s.asientos < 1) return `La sección "${nombre}" necesita al menos una butaca.`;
    if (filasDeSeccion(s.asientos, asientosPorFila) > LIMITES_MAPA.filasPorSeccion) {
      return `La sección "${nombre}" pasa de ${LIMITES_MAPA.filasPorSeccion} filas: pon más asientos por fila.`;
    }
  }
  const total = secciones.reduce((suma, s) => suma + s.asientos, 0);
  if (total > LIMITES_MAPA.asientos) return `La sede tiene como máximo ${LIMITES_MAPA.asientos} butacas.`;
  if (aforo !== undefined && total !== aforo) {
    return total < aforo
      ? `Faltan ${aforo - total} butacas para llegar al aforo del evento (${aforo}).`
      : `Sobran ${total - aforo} butacas: el aforo del evento es ${aforo}.`;
  }
  return null;
}

/**
 * Secciones de la pizarra: filas con letras continuas (A, B, C… entre secciones), `asientosPorFila`
 * asientos por fila y la última fila de cada sección con lo que quede.
 */
export function generarSeccionesCine(config: ConfigCine, nuevoId: () => string = () => crypto.randomUUID()): EstadoSeccion[] {
  const { asientosPorFila, pasilloCentral, secciones } = config;
  let fila = 0;
  return secciones.map((seccion) => {
    const filas = filasDeSeccion(seccion.asientos, asientosPorFila);
    return {
      id: nuevoId(),
      nombre: seccion.nombre.trim(),
      filas: Array.from({ length: filas }, (_, j) => {
        const enFila = j < filas - 1 ? asientosPorFila : seccion.asientos - asientosPorFila * (filas - 1);
        const izquierda = pasilloCentral && enFila > 1 ? Math.ceil(enFila / 2) : enFila;
        const tamanos = izquierda < enFila ? [izquierda, enFila - izquierda] : [enFila];
        return {
          id: nuevoId(),
          nombre: nombreFila(fila++),
          bloques: tamanos.map((n, k) => ({
            id: nuevoId(),
            desplazamiento: k === 0 ? 0 : ANCHO_PASILLO,
            asientos: Array.from({ length: n }, () => ({ id: nuevoId() })),
          })),
        };
      }),
    };
  });
}

/** Butacas numeradas de la pizarra. */
export function totalButacasSecciones(secciones: EstadoSeccion[]): number {
  return secciones.reduce((s, sec) => s + sec.filas.reduce((f, fila) => f + fila.bloques.reduce((b, bl) => b + bl.asientos.length, 0), 0), 0);
}
