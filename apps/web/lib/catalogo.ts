import { CategoriaEventoSchema, type CategoriaEvento, type EventoPublico } from "@reto18/shared";
import { ETIQUETA_CATEGORIA } from "./alta-evento";

/**
 * Portada pública (1.11): funciones puras que traducen los filtros de la URL a la consulta de
 * `GET /eventos` (1.6), y arman las filas, el héroe y los textos de cada tarjeta. Sin React ni red.
 */

/** Perú no cambia de hora: Lima es UTC−5 todo el año. */
const DESFASE_LIMA_MS = -5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"] as const;

export const CATEGORIAS = CategoriaEventoSchema.options;

/** Instante de la petición (ms). Aparte para que la página lo lea una vez y las funciones sigan puras. */
export function instanteActual(): number {
  return Date.now();
}

/** Título de la fila de cada categoría en la portada. */
export const TITULO_FILA: Record<CategoriaEvento, string> = {
  musica: "Música en vivo",
  teatro: "Teatro",
  danza: "Danza",
  artes_visuales: "Artes visuales",
  cine: "Cine",
  literatura: "Literatura",
  otro: "Más eventos",
};

export const etiquetaCategoria = (categoria: CategoriaEvento): string => ETIQUETA_CATEGORIA[categoria];

export const OPCIONES_FECHA = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "fin-de-semana", etiqueta: "Este fin de semana" },
  { valor: "este-mes", etiqueta: "Este mes" },
] as const;

export const OPCIONES_PRECIO = [
  { valor: "gratis", etiqueta: "Gratis" },
  { valor: "hasta-20", etiqueta: "Hasta S/ 20" },
  { valor: "20-50", etiqueta: "S/ 20 a S/ 50" },
  { valor: "mas-50", etiqueta: "Más de S/ 50" },
] as const;

const TRAMOS_PRECIO: Record<string, { min?: number; max?: number }> = {
  gratis: { max: 0 },
  "hasta-20": { max: 2000 },
  "20-50": { min: 2000, max: 5000 },
  "mas-50": { min: 5000 },
};

export type ValoresFiltro = { q: string; fecha: string; distrito: string; precio: string; categoria: string };
export type Filtros = {
  /** Lo que se vuelve a pintar en el buscador. */
  valores: ValoresFiltro;
  /** Parámetros para `GET /eventos` (solo los válidos). */
  consulta: Record<string, string>;
  /** Hay algún filtro aplicado: la portada muestra la cuadrícula de resultados. */
  activos: boolean;
};

type ParametrosUrl = Record<string, string | string[] | undefined>;

const primero = (valor: string | string[] | undefined): string => (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? "";

/** Día de Lima (`YYYY-MM-DD`) de un instante, y su día de la semana (0 = domingo). */
function diaLima(ms: number): { fecha: string; semana: number; anio: number; mes: number } {
  const lima = new Date(ms + DESFASE_LIMA_MS);
  return {
    fecha: lima.toISOString().slice(0, 10),
    semana: lima.getUTCDay(),
    anio: lima.getUTCFullYear(),
    mes: lima.getUTCMonth(),
  };
}

/** Rango `desde`/`hasta` (días de Lima) de una opción de fecha, contado desde `ahora`. */
export function rangoFecha(opcion: string, ahora: number): { desde: string; hasta: string } | null {
  const hoy = diaLima(ahora);
  if (opcion === "hoy") return { desde: hoy.fecha, hasta: hoy.fecha };
  if (opcion === "fin-de-semana") {
    // Viernes a domingo de esta semana; si ya es sábado o domingo, desde hoy hasta el domingo.
    const hastaDomingo = (7 - hoy.semana) % 7;
    const desdeViernes = hoy.semana === 6 || hoy.semana === 0 ? 0 : 5 - hoy.semana;
    return {
      desde: diaLima(ahora + desdeViernes * DIA_MS).fecha,
      hasta: diaLima(ahora + hastaDomingo * DIA_MS).fecha,
    };
  }
  if (opcion === "este-mes") {
    const ultimo = new Date(Date.UTC(hoy.anio, hoy.mes + 1, 0)).toISOString().slice(0, 10);
    return { desde: hoy.fecha, hasta: ultimo };
  }
  return null;
}

/** Filtros de la URL de la portada → valores del buscador y consulta para la API. Ignora lo que no reconoce. */
export function leerFiltros(parametros: ParametrosUrl, ahora: number): Filtros {
  const valores: ValoresFiltro = {
    q: primero(parametros.q).slice(0, 100),
    fecha: primero(parametros.fecha),
    distrito: primero(parametros.distrito).slice(0, 100),
    precio: primero(parametros.precio),
    categoria: primero(parametros.categoria),
  };
  const consulta: Record<string, string> = {};
  if (valores.q) consulta.q = valores.q;
  if (valores.distrito) consulta.distrito = valores.distrito;
  if ((CATEGORIAS as readonly string[]).includes(valores.categoria)) consulta.categoria = valores.categoria;
  else valores.categoria = "";

  const rango = rangoFecha(valores.fecha, ahora);
  if (rango) Object.assign(consulta, rango);
  else valores.fecha = "";

  const tramo = TRAMOS_PRECIO[valores.precio];
  if (tramo) {
    if (tramo.min !== undefined) consulta.precio_minimo_centimos = String(tramo.min);
    if (tramo.max !== undefined) consulta.precio_maximo_centimos = String(tramo.max);
  } else valores.precio = "";

  return { valores, consulta, activos: Object.keys(consulta).length > 0 };
}

/** Ruta de `GET /eventos` con la consulta. */
export function rutaCatalogo(consulta: Record<string, string> = {}): string {
  const qs = new URLSearchParams(consulta).toString();
  return qs ? `eventos?${qs}` : "eventos";
}

/**
 * Checkout del evento (2.8). Conserva el `ref` del enlace rastreable (`/r/<código>` lleva a la ficha
 * con `?ref=`, 3.2) para que la venta se atribuya a su pieza.
 */
export function rutaComprar(eventoId: string, ref?: string | string[]): string {
  const codigo = primero(ref);
  const base = `/eventos/${eventoId}/comprar`;
  return codigo ? `${base}?ref=${encodeURIComponent(codigo)}` : base;
}

/** Céntimos de PEN → "S/ 25" o "S/ 25.50". */
export function soles(centimos: number): string {
  const soles = centimos / 100;
  return `S/ ${Number.isInteger(soles) ? soles : soles.toFixed(2)}`;
}

/** Precio de la tarjeta: "Gratis" o "Desde S/ 25"; sin categorías, `null`. */
export function textoPrecio(evento: Pick<EventoPublico, "precio_minimo_centimos">): string | null {
  const minimo = evento.precio_minimo_centimos;
  if (minimo === null) return null;
  return minimo === 0 ? "Gratis" : `Desde ${soles(minimo)}`;
}

/** "17 oct", en hora de Lima. */
export function fechaCorta(inicio: string): string {
  const ms = Date.parse(inicio);
  if (Number.isNaN(ms)) return inicio;
  const lima = new Date(ms + DESFASE_LIMA_MS);
  return `${lima.getUTCDate()} ${MESES[lima.getUTCMonth()]}`;
}

/** Color de precio de cada categoría para el degradado de las tarjetas sin foto. */
const COLOR_CATEGORIA: Record<CategoriaEvento, string> = {
  musica: "var(--color-price-1)",
  teatro: "var(--color-price-2)",
  danza: "var(--color-price-3)",
  artes_visuales: "var(--color-price-4)",
  cine: "var(--color-seat-held)",
  literatura: "var(--color-price-2)",
  otro: "var(--color-price-4)",
};

/** Fondo de la imagen de una tarjeta sin foto: un brillo del color de su categoría sobre carbón, como el mockup. */
export function degradadoCategoria(categoria: CategoriaEvento): string {
  return `radial-gradient(circle at 60% 35%, ${COLOR_CATEGORIA[categoria]} 0%, transparent 65%), var(--color-surface-inverse)`;
}

/** `verTodos`: la lista filtrada de la fila; sin ella, la fila ya muestra todos sus eventos. */
export type FilaPortada = { id: string; titulo: string; eventos: EventoPublico[]; verTodos?: string };

/** Una categoría tiene su propia fila desde este número de eventos; con menos, sus eventos ya salen en "Próximos". */
export const MINIMO_FILA_CATEGORIA = 2;

/**
 * Filas de la portada, en el orden de la API (destacados primero): "Imperdibles de la semana"
 * (próximos 7 días), "Próximos eventos" (todos) y una fila por categoría con al menos
 * `MINIMO_FILA_CATEGORIA` eventos, en el orden de `CATEGORIAS`.
 */
export function armarFilas(eventos: readonly EventoPublico[], ahora: number): FilaPortada[] {
  const limite = ahora + 7 * DIA_MS;
  const semana = eventos.filter((e) => {
    const ms = Date.parse(e.inicio);
    return ms >= ahora - DIA_MS && ms <= limite;
  });
  const filas: FilaPortada[] = [];
  if (semana.length > 0) {
    filas.push({ id: "semana", titulo: "Imperdibles de la semana", eventos: semana, verTodos: "/?fecha=este-mes" });
  }
  if (eventos.length > semana.length) {
    filas.push({ id: "proximos", titulo: "Próximos eventos", eventos: [...eventos] });
  }
  for (const categoria of CATEGORIAS) {
    const deCategoria = eventos.filter((e) => e.categoria === categoria);
    if (deCategoria.length >= MINIMO_FILA_CATEGORIA) {
      filas.push({ id: categoria, titulo: TITULO_FILA[categoria], eventos: deCategoria, verTodos: `/?categoria=${categoria}` });
    }
  }
  return filas;
}

/** Eventos del héroe: los destacados; si no hay, el próximo evento. */
export function eventosHeroe(eventos: readonly EventoPublico[]): EventoPublico[] {
  const destacados = eventos.filter((e) => e.destacado);
  return destacados.length > 0 ? destacados : eventos.slice(0, 1);
}

/** Distritos con eventos publicados, para el selector (orden alfabético). */
export function distritosDe(eventos: readonly EventoPublico[]): string[] {
  return [...new Set(eventos.map((e) => e.distrito))].sort((a, b) => a.localeCompare(b, "es"));
}
