import { z } from "zod";

/**
 * Forma común de los errores de la API: `{ "error": { "codigo", "mensaje", "detalles"? } }`.
 * `detalles` lleva datos del error que la interfaz necesita (p. ej. `usada_en` de `ENTRADA_YA_USADA`).
 */
export const ErrorApiSchema = z.object({
  codigo: z.string(),
  mensaje: z.string(),
  detalles: z.record(z.string(), z.unknown()).optional(),
});

export type ErrorApi = z.infer<typeof ErrorApiSchema>;
