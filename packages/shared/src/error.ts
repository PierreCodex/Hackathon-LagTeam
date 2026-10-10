import { z } from "zod";

/** Forma común de los errores de la API: `{ "error": { "codigo", "mensaje" } }`. */
export const ErrorApiSchema = z.object({
  codigo: z.string(),
  mensaje: z.string(),
});

export type ErrorApi = z.infer<typeof ErrorApiSchema>;
