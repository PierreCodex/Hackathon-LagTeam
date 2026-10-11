import { z } from "zod";

/** Cuerpo de `POST /api/v1/acceso/eventos/:eventoId/validar`: el texto leído del QR (`entrada_id.firma`). */
export const ValidarEntradaSchema = z.object({ qr: z.string().trim().min(1).max(200) });
export type ValidarEntrada = z.infer<typeof ValidarEntradaSchema>;

/** Respuesta 200 de la validación en puerta: la entrada queda usada (un solo uso, AD-7). */
export const ResultadoValidacionSchema = z.object({
  resultado: z.literal("aceptada"),
  entrada_id: z.uuid(),
  evento_id: z.uuid(),
  usada_en: z.iso.datetime({ offset: true }),
});
export type ResultadoValidacion = z.infer<typeof ResultadoValidacionSchema>;

/** Códigos de error del módulo `acceso`. `ENTRADA_YA_USADA` trae `detalles.usada_en`. */
export const CODIGOS_ACCESO = {
  EVENTO_NO_ENCONTRADO: "EVENTO_NO_ENCONTRADO",
  QR_INVALIDO: "QR_INVALIDO",
  ENTRADA_YA_USADA: "ENTRADA_YA_USADA",
  ENTRADA_DE_OTRO_EVENTO: "ENTRADA_DE_OTRO_EVENTO",
  /** Mismo valor que `CODIGO_BD_NO_DISPONIBLE`. */
  BD_NO_DISPONIBLE: "BD_NO_DISPONIBLE",
} as const;
export type CodigoAcceso = (typeof CODIGOS_ACCESO)[keyof typeof CODIGOS_ACCESO];
