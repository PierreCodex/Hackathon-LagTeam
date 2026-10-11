import { z } from "zod";
import { CategoriaEventoSchema } from "./eventos.js";

const textoHasta = (maximo: number) => z.string().trim().min(1).max(maximo);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const fechaHora = z.iso.datetime({ offset: true });

/** De dónde salen los textos y la campaña: del modelo o de la plantilla de respaldo (AD-11). */
export const OrigenIaSchema = z.enum(["ia", "respaldo"]);
export type OrigenIa = z.infer<typeof OrigenIaSchema>;

/** Redes a las que se reparte el presupuesto de la campaña. */
export const RedCampanaSchema = z.enum(["instagram", "facebook", "whatsapp", "tiktok", "x"]);
export type RedCampana = z.infer<typeof RedCampanaSchema>;

/** Textos de la pieza. No llevan fecha, sede ni precio de la IA: esos huecos salen de `datos`. */
export const TextosPiezaSchema = z.object({
  titular: textoHasta(90),
  subtitulo: textoHasta(160),
  llamado: textoHasta(60),
  descripcion: textoHasta(600),
});
export type TextosPieza = z.infer<typeof TextosPiezaSchema>;

/** Paleta de 3 colores hex para la plantilla. */
export const PaletaPiezaSchema = z.object({ fondo: hex, texto: hex, acento: hex });
export type PaletaPieza = z.infer<typeof PaletaPiezaSchema>;

/** Presupuesto en soles enteros para una red. */
export const RepartoRedSchema = z.object({
  red: RedCampanaSchema,
  soles: z.number().int().min(0).max(100_000),
});
export type RepartoRed = z.infer<typeof RepartoRedSchema>;

/** Publicación del calendario tal como la propone la IA: días antes del evento y hora de Lima. */
export const PublicacionIaSchema = z.object({
  dias_antes: z.number().int().min(0).max(60),
  hora,
  accion: textoHasta(200),
});

/** Publicación del calendario con su fecha (`YYYY-MM-DD`, America/Lima), calculada desde el inicio del evento. */
export const PublicacionSchema = PublicacionIaSchema.extend({ fecha: z.iso.date() });
export type Publicacion = z.infer<typeof PublicacionSchema>;

const campanaBase = {
  /** A quién: el público objetivo, en palabras sencillas. */
  publico: textoHasta(300),
  /** Cuánto: soles por red. */
  reparto: z.array(RepartoRedSchema).min(1).max(5),
  /** La campaña explicada como a un amigo. */
  resumen: textoHasta(600),
};

/** Salida que se pide al modelo (`format` de Ollama). El total y las fechas los calcula la API. */
export const RespuestaIaTextosYCampanaSchema = z.object({
  textos: TextosPiezaSchema,
  paleta: PaletaPiezaSchema,
  campana: z.object({ ...campanaBase, calendario: z.array(PublicacionIaSchema).min(1).max(8) }),
});
export type RespuestaIaTextosYCampana = z.infer<typeof RespuestaIaTextosYCampanaSchema>;

/** JSON Schema de la salida del modelo, para el `format` de Ollama. */
export const JSON_SCHEMA_RESPUESTA_IA_TEXTOS_Y_CAMPANA = z.toJSONSchema(RespuestaIaTextosYCampanaSchema);

/** Campaña: a quién, cuánto (en soles, por red) y cuándo. */
export const CampanaSchema = z.object({
  ...campanaBase,
  /** Suma del reparto. */
  presupuesto_total_soles: z.number().int().min(0),
  calendario: z.array(PublicacionSchema).min(1).max(8),
});
export type Campana = z.infer<typeof CampanaSchema>;

/** Salida de `ia.textosYCampana`: textos, paleta y campaña. */
export const TextosYCampanaSchema = z.object({
  textos: TextosPiezaSchema,
  paleta: PaletaPiezaSchema,
  campana: CampanaSchema,
});
export type TextosYCampana = z.infer<typeof TextosYCampanaSchema>;

/** Entrada de `ia.textosYCampana`: los datos reales del evento (de la BD). */
export const EntradaTextosYCampanaSchema = z.object({
  titulo: z.string().trim().min(1),
  descripcion: z.string().trim().min(1),
  categoria: CategoriaEventoSchema,
  inicio: fechaHora,
  sede: z.string().trim().min(1),
  direccion: z.string().trim().min(1),
  distrito: z.string().trim().min(1),
  /** Céntimos de PEN (AD-10); `0` es entrada libre; `null` si el evento no tiene categorías. */
  precio_minimo_centimos: z.number().int().min(0).nullable(),
});
export type EntradaTextosYCampana = z.infer<typeof EntradaTextosYCampanaSchema>;

/** Datos del evento para los huecos de la plantilla. Salen siempre de la BD, nunca de la IA (AD-11). */
export const DatosPiezaSchema = z.object({
  evento_id: z.uuid(),
  titulo: z.string().trim().min(1),
  inicio: fechaHora,
  sede: z.string().trim().min(1),
  direccion: z.string().trim().min(1),
  distrito: z.string().trim().min(1),
  precio_minimo_centimos: z.number().int().min(0).nullable(),
  foto_url: z.url().nullable(),
});
export type DatosPieza = z.infer<typeof DatosPiezaSchema>;

/**
 * Respuesta de `POST /api/v1/marketing/eventos/:eventoId/piezas` (201) y de
 * `GET /api/v1/marketing/piezas/:id` (200).
 */
export const PiezaSchema = z.object({
  id: z.uuid(),
  evento_id: z.uuid(),
  origen: OrigenIaSchema,
  textos: TextosPiezaSchema,
  paleta: PaletaPiezaSchema,
  campana: CampanaSchema,
  datos: DatosPiezaSchema,
  creado_en: fechaHora,
});
export type Pieza = z.infer<typeof PiezaSchema>;

/** Longitud del código del enlace rastreable (AD-8). */
export const LONGITUD_CODIGO_ENLACE = 8;
/** Código del enlace rastreable: base62 de 8 caracteres (AD-8). */
export const PATRON_CODIGO_ENLACE = /^[0-9A-Za-z]{8}$/;
export const CodigoEnlaceSchema = z.string().regex(PATRON_CODIGO_ENLACE);

/** Cuerpo de `POST /api/v1/marketing/piezas/:id/enlaces`. Sin cuerpo equivale a `{}`. */
export const CrearEnlaceSchema = z
  .object({
    red: RedCampanaSchema.optional(),
    /** Zona o barrio al que apunta el enlace (p. ej. «Castilla»). */
    zona: textoHasta(60).optional(),
  })
  .default({});
export type CrearEnlace = z.infer<typeof CrearEnlaceSchema>;

/** Enlace rastreable. Respuesta de `POST /api/v1/marketing/piezas/:id/enlaces` (201). */
export const EnlaceSchema = z.object({
  codigo: CodigoEnlaceSchema,
  evento_id: z.uuid(),
  /** `null` en los enlaces de campañas sin pieza (Weekend, 3.7). */
  pieza_id: z.uuid().nullable(),
  red: RedCampanaSchema.nullable(),
  zona: z.string().nullable(),
  creado_en: fechaHora,
});
export type Enlace = z.infer<typeof EnlaceSchema>;

/** Respuesta de `POST /api/v1/marketing/enlaces/:codigo/clics` (201): adónde redirigir. */
export const ClicRegistradoSchema = z.object({
  codigo: CodigoEnlaceSchema,
  evento_id: z.uuid(),
});
export type ClicRegistrado = z.infer<typeof ClicRegistradoSchema>;

/** Clics y ventas pagadas (AD-8). Importe en céntimos (AD-10). */
const metricasEnlace = {
  clics: z.number().int().min(0),
  ordenes: z.number().int().min(0),
  entradas: z.number().int().min(0),
  importe_centimos: z.number().int().min(0),
};
export const MetricasEnlaceSchema = z.object(metricasEnlace);
export type MetricasEnlace = z.infer<typeof MetricasEnlaceSchema>;

export const ResultadoEnlaceSchema = EnlaceSchema.extend(metricasEnlace);
export type ResultadoEnlace = z.infer<typeof ResultadoEnlaceSchema>;

/** Respuesta de `GET /api/v1/marketing/piezas/:id/resultados` (200): total de la pieza y una fila por enlace. */
export const ResultadosPiezaSchema = z.object({
  pieza_id: z.uuid(),
  evento_id: z.uuid(),
  total: MetricasEnlaceSchema,
  enlaces: z.array(ResultadoEnlaceSchema),
});
export type ResultadosPieza = z.infer<typeof ResultadosPiezaSchema>;

/** Redes donde "Publicar ahora" publica con Upload-Post (3.4). TikTok y X quedan en exportación. */
export const RedPublicacionSchema = z.enum(["instagram", "facebook"]);
export type RedPublicacion = z.infer<typeof RedPublicacionSchema>;

/** Largo máximo del texto del post (el pie de Instagram admite 2200; se reserva sitio para el enlace). */
export const MAX_TEXTO_PUBLICACION = 2000;

/** Cuerpo de `POST /api/v1/marketing/piezas/:id/publicaciones`. */
export const PublicarPiezaSchema = z.object({
  redes: z
    .array(RedPublicacionSchema)
    .min(1)
    .max(2)
    .refine((redes) => new Set(redes).size === redes.length, "Redes repetidas"),
  /** Texto del post. Sin él, la API lo arma con los textos de la pieza. El enlace rastreable se añade siempre. */
  texto: textoHasta(MAX_TEXTO_PUBLICACION).optional(),
  /** Si llega, la publicación se programa para esa fecha en lugar de salir ahora. */
  programar_para: fechaHora.optional(),
});
export type PublicarPieza = z.infer<typeof PublicarPiezaSchema>;

/** Resultado de la publicación en una red. */
export const ResultadoRedPublicacionSchema = z.object({
  red: RedPublicacionSchema,
  ok: z.boolean(),
  /** Enlace al post, si el proveedor lo devuelve. */
  url: z.string().nullable(),
  error: z.string().nullable(),
});
export type ResultadoRedPublicacion = z.infer<typeof ResultadoRedPublicacionSchema>;

/** Respuesta de `POST /api/v1/marketing/piezas/:id/publicaciones` (201). */
export const PublicacionPiezaSchema = z.object({
  pieza_id: z.uuid(),
  /** Enlace rastreable que lleva el post (AD-8): sus clics y ventas cuentan para la pieza. */
  enlace: EnlaceSchema,
  url_enlace: z.url(),
  /** Texto final publicado, con el enlace. */
  texto: z.string(),
  /** `true` si quedó programada para `programar_para`. */
  programada: z.boolean(),
  redes: z.array(ResultadoRedPublicacionSchema),
});
export type PublicacionPieza = z.infer<typeof PublicacionPiezaSchema>;

/** Códigos de error del módulo `marketing`. */
export const CODIGOS_MARKETING = {
  EVENTO_NO_ENCONTRADO: "EVENTO_NO_ENCONTRADO",
  EVENTO_NO_APROBADO: "EVENTO_NO_APROBADO",
  EVENTO_FINALIZADO: "EVENTO_FINALIZADO",
  PIEZA_NO_ENCONTRADA: "PIEZA_NO_ENCONTRADA",
  ENLACE_NO_ENCONTRADO: "ENLACE_NO_ENCONTRADO",
  /** Falta `UPLOADPOST_API_KEY` o `WEB_URL` en la API (503): la web ofrece descargar y copiar. */
  PUBLICACION_NO_CONFIGURADA: "PUBLICACION_NO_CONFIGURADA",
  /** Upload-Post falló o no respondió (502): la web ofrece descargar y copiar. */
  PUBLICACION_FALLIDA: "PUBLICACION_FALLIDA",
  PUBLICACION_SIN_CONFIRMAR: "PUBLICACION_SIN_CONFIRMAR",
  /** Mismo valor que `CODIGO_BD_NO_DISPONIBLE`. */
  BD_NO_DISPONIBLE: "BD_NO_DISPONIBLE",
} as const;
export type CodigoMarketing = (typeof CODIGOS_MARKETING)[keyof typeof CODIGOS_MARKETING];
