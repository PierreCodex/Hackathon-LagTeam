import type { RedCampana } from "@reto18/shared";

/**
 * Formatos de la pieza de marketing (3.8). Funciones puras: las usan la plantilla PNG
 * (`app/piezas/[pieza]/[formato]/route.tsx`) y la pantalla Marketing del organizador.
 * Fecha, sede y precio salen siempre de `pieza.datos` (AD-11), nunca de los textos de la IA.
 */

/** Formatos de imagen que existen. 9:16, 16:9 y A4 llegan con la 3.9. */
export const FORMATOS_PIEZA = ["4x5"] as const;
export type FormatoPieza = (typeof FORMATOS_PIEZA)[number];

/** Tamaño en píxeles de cada formato. */
export const TAMANO_FORMATO: Record<FormatoPieza, { ancho: number; alto: number }> = {
  "4x5": { ancho: 1080, alto: 1350 },
};

export function esFormatoPieza(valor: string): valor is FormatoPieza {
  return (FORMATOS_PIEZA as readonly string[]).includes(valor);
}

/** Lima no cambia de hora: siempre UTC−5. */
const DESFASE_LIMA_MS = -5 * 60 * 60 * 1000;

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"] as const;

/** "20:00" → "8:00 p. m."; "00:30" → "12:30 a. m.". */
function hora12(horas: number, minutos: number): string {
  const sufijo = horas < 12 ? "a. m." : "p. m.";
  const h = horas % 12 === 0 ? 12 : horas % 12;
  return `${h}:${String(minutos).padStart(2, "0")} ${sufijo}`;
}

/** Fecha con los campos UTC ya movidos a Lima → "Vie 16 oct". */
function diaYMes(fecha: Date): string {
  return `${DIAS[fecha.getUTCDay()]} ${fecha.getUTCDate()} ${MESES[fecha.getUTCMonth()]}`;
}

/**
 * Inicio del evento (ISO con zona) en hora de Lima: "2026-10-16T20:00:00-05:00" → "Vie 16 oct · 8:00 p. m.".
 * Si no es una fecha válida, devuelve el texto tal cual.
 */
export function fechaPieza(inicio: string): string {
  const ms = Date.parse(inicio);
  if (Number.isNaN(ms)) return inicio;
  const lima = new Date(ms + DESFASE_LIMA_MS);
  return `${diaYMes(lima)} · ${hora12(lima.getUTCHours(), lima.getUTCMinutes())}`;
}

/** Publicación del calendario (fecha `YYYY-MM-DD` y hora `HH:mm` de Lima) → "Mié 14 oct · 7:00 p. m.". */
export function fechaCalendario(fecha: string, hora: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [horas, minutos] = hora.split(":").map(Number);
  if ([anio, mes, dia, horas, minutos].some((n) => n === undefined || Number.isNaN(n))) return `${fecha} · ${hora}`;
  const dia0 = new Date(Date.UTC(anio!, mes! - 1, dia!));
  return `${diaYMes(dia0)} · ${hora12(horas!, minutos!)}`;
}

/** Soles desde céntimos, sin decimales si son enteros: 2500 → "25"; 2550 → "25.50". */
export function soles(centimos: number): string {
  return centimos % 100 === 0 ? String(centimos / 100) : (centimos / 100).toFixed(2);
}

/**
 * Línea de precio del flyer (precios con IGV, AD-10): 2500 → "Desde S/ 25"; 0 → "Entrada libre";
 * `null` (sin categorías) → `null`, sin línea de precio.
 */
export function textoPrecio(centimos: number | null): string | null {
  if (centimos === null) return null;
  if (centimos === 0) return "Entrada libre";
  return `Desde S/ ${soles(centimos)}`;
}

const NOMBRE_RED: Record<RedCampana, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  x: "X",
};

/** Nombre visible de la red: "whatsapp" → "WhatsApp". */
export function nombreRed(red: RedCampana): string {
  return NOMBRE_RED[red];
}

/** Ruta del PNG de la pieza en la web: `/piezas/<id>/4x5`. */
export function urlPng(piezaId: string, formato: FormatoPieza): string {
  return `/piezas/${encodeURIComponent(piezaId)}/${formato}`;
}

/** Ruta de la pantalla Marketing de un evento, con la pieza si ya hay una. */
export function rutaMarketingEvento(eventoId: string, piezaId?: string): string {
  const base = `/organizador/eventos/${encodeURIComponent(eventoId)}/marketing`;
  return piezaId ? `${base}?pieza=${encodeURIComponent(piezaId)}` : base;
}
