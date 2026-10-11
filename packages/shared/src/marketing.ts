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

/** Códigos de error del módulo `marketing`. */
export const CODIGOS_MARKETING = {
  EVENTO_NO_ENCONTRADO: "EVENTO_NO_ENCONTRADO",
  EVENTO_NO_APROBADO: "EVENTO_NO_APROBADO",
  EVENTO_FINALIZADO: "EVENTO_FINALIZADO",
  PIEZA_NO_ENCONTRADA: "PIEZA_NO_ENCONTRADA",
  /** Mismo valor que `CODIGO_BD_NO_DISPONIBLE`. */
  BD_NO_DISPONIBLE: "BD_NO_DISPONIBLE",
} as const;
export type CodigoMarketing = (typeof CODIGOS_MARKETING)[keyof typeof CODIGOS_MARKETING];
