import {
  type CategoriaEvento,
  type EntradaTextosYCampana,
  EntradaTextosYCampanaSchema,
  JSON_SCHEMA_RESPUESTA_IA_TEXTOS_Y_CAMPANA,
  type OrigenIa,
  type PaletaPieza,
  type Publicacion,
  type RedCampana,
  type RepartoRed,
  type RespuestaIaTextosYCampana,
  RespuestaIaTextosYCampanaSchema,
  type TextosYCampana,
  TextosYCampanaSchema,
} from "@reto18/shared";
import type { PeticionOllama } from "../adaptador-ollama.js";

/** Resultado de una función de IA: el respaldo no es un error, es un resultado válido. */
export interface ResultadoIa<T> {
  origen: OrigenIa;
  valor: T;
}

/** Llama al proveedor (Ollama) y devuelve su JSON, o lanza. */
export type LlamarProveedor = (peticion: PeticionOllama) => Promise<unknown>;

const ZONA = "America/Lima";
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const PALETAS: Record<CategoriaEvento, PaletaPieza> = {
  musica: { fondo: "#1E1B4B", texto: "#FFFFFF", acento: "#F59E0B" },
  teatro: { fondo: "#7F1D1D", texto: "#FFF7ED", acento: "#FBBF24" },
  danza: { fondo: "#9D174D", texto: "#FFFFFF", acento: "#FDE047" },
  artes_visuales: { fondo: "#0F766E", texto: "#FFFFFF", acento: "#F97316" },
  cine: { fondo: "#111827", texto: "#F9FAFB", acento: "#EF4444" },
  literatura: { fondo: "#3F2E1E", texto: "#FEF3C7", acento: "#D97706" },
  otro: { fondo: "#1D4ED8", texto: "#FFFFFF", acento: "#FACC15" },
};

const GUSTO: Record<CategoriaEvento, string> = {
  musica: "la música en vivo",
  teatro: "el teatro",
  danza: "la danza",
  artes_visuales: "el arte",
  cine: "el cine",
  literatura: "la lectura y la literatura",
  otro: "los planes culturales",
};

const SISTEMA =
  "Eres el asistente de marketing de una plataforma de eventos culturales de Piura (Perú). " +
  "Escribes en español sencillo y cercano, sin jerga de marketing, como si se lo explicaras a un amigo. " +
  "Respondes solo con un JSON que cumple el esquema que se te da.";

/**
 * `textosYCampana` (AD-11): textos, paleta y campaña de la pieza de un evento.
 * Nunca lanza por un fallo del proveedor: ante tiempo límite, error de red o respuesta inválida,
 * devuelve el respaldo determinista construido con los datos reales del evento.
 */
export async function textosYCampana(
  entrada: EntradaTextosYCampana,
  llamar: LlamarProveedor,
  avisar: (mensaje: string) => void = () => {},
  ahora: Date = new Date(),
): Promise<ResultadoIa<TextosYCampana>> {
  const datos = EntradaTextosYCampanaSchema.parse(entrada);
  try {
    const crudo = await llamar({
      sistema: SISTEMA,
      usuario: prompt(datos, ahora),
      formato: JSON_SCHEMA_RESPUESTA_IA_TEXTOS_Y_CAMPANA as Record<string, unknown>,
    });
    const respuesta = RespuestaIaTextosYCampanaSchema.safeParse(crudo);
    if (!respuesta.success) {
      const problema = respuesta.error.issues[0];
      throw new Error(`la respuesta no cumple el esquema (${problema?.path.join(".")}: ${problema?.message})`);
    }
    return { origen: "ia", valor: TextosYCampanaSchema.parse(completar(datos, respuesta.data, ahora)) };
  } catch (e) {
    avisar(`textosYCampana: se usa el respaldo (${motivo(e)})`);
    return { origen: "respaldo", valor: respaldoTextosYCampana(datos, ahora) };
  }
}

/** Respaldo determinista: plantilla con fecha, sede y precio del evento. */
export function respaldoTextosYCampana(datos: EntradaTextosYCampana, ahora: Date = new Date()): TextosYCampana {
  const fecha = fechaLegible(datos.inicio);
  const precio = textoPrecio(datos.precio_minimo_centimos);
  const reparto: RepartoRed[] = [
    { red: "instagram", soles: 30 },
    { red: "facebook", soles: 20 },
  ];
  const publico = `Personas de Piura y Castilla de 18 a 45 años a las que les gusta ${GUSTO[datos.categoria]}`;
  const calendario = calendarioDesde(
    datos.inicio,
    [
      { dias_antes: 5, hora: "19:00", accion: "Publica la pieza en el feed de Instagram y Facebook" },
      { dias_antes: 2, hora: "19:00", accion: "Comparte la historia en Instagram y el estado de WhatsApp" },
      { dias_antes: 0, hora: horaMismoDia(datos.inicio), accion: "Recuerda que es hoy: historia con el enlace de compra" },
    ],
    ahora,
  );
  const lugar = `${datos.sede} (${datos.direccion}, ${datos.distrito})`;
  const valor: TextosYCampana = {
    textos: {
      titular: recortar(datos.titulo, 90),
      subtitulo: recortar(`${fecha} · ${datos.sede}${precio ? ` · ${precio}` : ""}`, 160),
      llamado:
        datos.precio_minimo_centimos === 0
          ? "Entrada libre"
          : datos.precio_minimo_centimos === null
            ? "No te lo pierdas"
            : "Compra tu entrada",
      descripcion: recortar(`${fecha} en ${lugar}.${precio ? ` ${precio}.` : ""} ${datos.descripcion}`, 600),
    },
    paleta: PALETAS[datos.categoria],
    campana: {
      publico,
      reparto,
      presupuesto_total_soles: 50,
      calendario,
      resumen: recortar(
        `Invierte 50 soles: 30 en Instagram y 20 en Facebook para ${publico.charAt(0).toLowerCase()}${publico.slice(1)}. ` +
          `Publica ${listar(calendario.map((p) => `el ${fechaCorta(p.fecha)} a las ${p.hora}`))}.`,
        600,
      ),
    },
  };
  return TextosYCampanaSchema.parse(valor);
}

/** Precios (`S/ 10`, `10 soles`, `40.00`) y horas (`20:00`, `8.30`) que la IA no puede escribir (AD-11). */
const PRECIO_U_HORA = [/S\/\s*\d/i, /\d+(?:[.,]\d+)?\s*soles?\b/i, /\b\d+[.,]\d{2}\b/, /\b([01]?\d|2[0-3])[:.][0-5]\d\b/];
const GRATIS = /entrada libre|gratis|gratuit/i;
const PRESUPUESTO_MINIMO_SOLES = 30;
const PRESUPUESTO_MAXIMO_SOLES = 150;

/**
 * Completa la salida del modelo: total del reparto, fechas del calendario y "Entrada libre".
 * Lanza (→ respaldo) si los textos traen precio u hora, si un evento de pago se anuncia gratis, o si el
 * presupuesto no está entre 30 y 150 soles o alguna red tiene 0 soles.
 */
function completar(datos: EntradaTextosYCampana, ia: RespuestaIaTextosYCampana, ahora: Date): TextosYCampana {
  const porRed = new Map<RedCampana, number>();
  for (const r of ia.campana.reparto) porRed.set(r.red, (porRed.get(r.red) ?? 0) + r.soles);
  const reparto = [...porRed].map(([red, soles]) => ({ red, soles }));
  const total = reparto.reduce((suma, r) => suma + r.soles, 0);
  if (reparto.some((r) => r.soles === 0) || total < PRESUPUESTO_MINIMO_SOLES || total > PRESUPUESTO_MAXIMO_SOLES) {
    throw new Error(`presupuesto fuera de rango (${total} soles)`);
  }
  const textos = { ...ia.textos };
  const valores = Object.values(textos);
  if (valores.some((t) => PRECIO_U_HORA.some((patron) => patron.test(t)))) {
    throw new Error("los textos traen un precio o una hora");
  }
  if (datos.precio_minimo_centimos !== 0 && valores.some((t) => GRATIS.test(t))) {
    throw new Error("los textos anuncian gratis un evento de pago");
  }
  if (datos.precio_minimo_centimos === 0 && !/entrada libre/i.test(textos.llamado)) {
    textos.llamado = "Entrada libre";
  }
  return {
    textos,
    paleta: ia.paleta,
    campana: {
      publico: ia.campana.publico,
      reparto,
      presupuesto_total_soles: total,
      calendario: calendarioDesde(datos.inicio, ia.campana.calendario, ahora),
      resumen: ia.campana.resumen,
    },
  };
}

function prompt(datos: EntradaTextosYCampana, ahora: Date): string {
  const diasHasta = Math.max(0, diasEntre(fechaLima(ahora), fechaLima(new Date(datos.inicio))));
  const precio = textoPrecio(datos.precio_minimo_centimos) ?? "sin precio publicado";
  return [
    "Prepara la pieza de marketing de este evento:",
    `- Título: ${datos.titulo}`,
    `- Tipo: ${datos.categoria}`,
    `- Descripción: ${datos.descripcion}`,
    `- Fecha: ${fechaLegible(datos.inicio)} (faltan ${diasHasta} días)`,
    `- Lugar: ${datos.sede}, ${datos.direccion}, ${datos.distrito} (Piura)`,
    `- Precio: ${precio}`,
    "",
    "Reglas:",
    "- textos: titular corto y llamativo (máximo 8 palabras), subtítulo de una frase, llamado a la acción breve y una descripción de 2 o 3 frases.",
    "- No escribas en los textos la fecha, la hora, el lugar ni el precio: la plantilla los pone con los datos reales.",
    datos.precio_minimo_centimos === 0 ? '- La entrada es libre: dilo con las palabras "Entrada libre" en el llamado.' : "",
    "- paleta: 3 colores hex (fondo, texto y acento) con buen contraste y que vayan con el tipo de evento.",
    "- campana.publico: a quién va dirigido (edad, intereses y zona de Piura).",
    "- campana.reparto: soles enteros por red (instagram, facebook, whatsapp, tiktok o x); entre 30 y 150 soles en total.",
    `- campana.calendario: de 2 a 5 publicaciones; dias_antes entre 0 y ${Math.min(diasHasta, 30)}; hora HH:MM de Lima; qué publicar.`,
    "- campana.resumen: la campaña explicada como a un amigo, en 2 o 3 frases (cuánto invertir, en qué red y cuándo publicar).",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Fechas del calendario desde `inicio` (America/Lima); quita las pasadas y deja al menos el mismo día. */
export function calendarioDesde(
  inicio: string,
  items: { dias_antes: number; hora: string; accion: string }[],
  ahora: Date = new Date(),
): Publicacion[] {
  const diaEvento = fechaLima(new Date(inicio));
  const hoy = fechaLima(ahora);
  const conFecha = items
    .map((p) => ({ ...p, fecha: restarDias(diaEvento, p.dias_antes) }))
    .filter((p) => p.fecha >= hoy)
    .sort((a, b) => b.dias_antes - a.dias_antes || a.hora.localeCompare(b.hora));
  if (conFecha.length) return conFecha.slice(0, 8);
  return [{ dias_antes: 0, hora: horaMismoDia(inicio), accion: "Comparte la pieza con el enlace de compra", fecha: diaEvento }];
}

interface PartesLima {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  diaSemana: number;
}

function partesLima(fecha: Date): PartesLima {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONA,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(fecha)
      .map((p) => [p.type, p.value]),
  );
  const anio = Number(partes.year);
  const mes = Number(partes.month);
  const dia = Number(partes.day);
  return {
    anio,
    mes,
    dia,
    hora: Number(partes.hour) % 24,
    minuto: Number(partes.minute),
    diaSemana: new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay(),
  };
}

/** `YYYY-MM-DD` en America/Lima. */
function fechaLima(fecha: Date): string {
  const { anio, mes, dia } = partesLima(fecha);
  return new Date(Date.UTC(anio, mes - 1, dia)).toISOString().slice(0, 10);
}

function restarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

const dosCifras = (n: number) => String(n).padStart(2, "0");

/** "viernes 16 de octubre, 20:00" (America/Lima). */
export function fechaLegible(iso: string): string {
  const p = partesLima(new Date(iso));
  return `${DIAS[p.diaSemana]} ${p.dia} de ${MESES[p.mes - 1]}, ${dosCifras(p.hora)}:${dosCifras(p.minuto)}`;
}

/** "sábado 11/10" a partir de `YYYY-MM-DD`. */
function fechaCorta(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${dosCifras(d.getUTCDate())}/${dosCifras(d.getUTCMonth() + 1)}`;
}

/** Hora de la publicación del mismo día: 2 h antes del inicio, entre las 08:00 y las 19:00. */
function horaMismoDia(inicio: string): string {
  const { hora } = partesLima(new Date(inicio));
  return `${dosCifras(Math.max(8, Math.min(19, hora - 2)))}:00`;
}

/** "Entrada libre", "Entradas desde S/ 40.00" o `undefined` si no hay precio. */
export function textoPrecio(centimos: number | null): string | undefined {
  if (centimos === null) return undefined;
  if (centimos === 0) return "Entrada libre";
  return `Entradas desde S/ ${(centimos / 100).toFixed(2)}`;
}

function listar(partes: string[]): string {
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

function recortar(texto: string, maximo: number): string {
  const limpio = texto.trim().replace(/\s+/g, " ");
  return limpio.length <= maximo ? limpio : `${limpio.slice(0, maximo - 1).trimEnd()}…`;
}

function motivo(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "TimeoutError") return "tiempo límite agotado";
    const causa = (e.cause as { code?: string } | undefined)?.code;
    return causa ? `${e.message}: ${causa}` : e.message;
  }
  return String(e);
}
