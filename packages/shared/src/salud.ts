import { z } from "zod";
import { ErrorApiSchema } from "./error.js";

/** Respuesta 200 de `GET /api/v1/salud`: la API y la base de datos responden. */
export const SaludOkSchema = z.object({
  api: z.literal("ok"),
  bd: z.literal("ok"),
  /** Hora de Postgres (`timestamptz`, ISO 8601). */
  hora_bd: z.string(),
});

/** Respuesta 503 de `GET /api/v1/salud`: la API responde, la base de datos no. */
export const SaludErrorSchema = z.object({
  api: z.literal("ok"),
  bd: z.literal("error"),
  error: ErrorApiSchema,
});

export const SaludRespuestaSchema = z.discriminatedUnion("bd", [SaludOkSchema, SaludErrorSchema]);

export type SaludOk = z.infer<typeof SaludOkSchema>;
export type SaludError = z.infer<typeof SaludErrorSchema>;
export type SaludRespuesta = z.infer<typeof SaludRespuestaSchema>;

export const CODIGO_BD_NO_DISPONIBLE = "BD_NO_DISPONIBLE";
