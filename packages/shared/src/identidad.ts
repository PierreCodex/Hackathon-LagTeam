import { z } from "zod";

/** Rol de una cuenta (AD-3). Una cuenta tiene exactamente uno. */
export const RolSchema = z.enum(["admin", "organizador", "publico"]);
export type Rol = z.infer<typeof RolSchema>;

/** Roles que se pueden elegir en el registro público (el admin se siembra con un script). */
export const RolRegistroSchema = z.enum(["organizador", "publico"]);
export type RolRegistro = z.infer<typeof RolRegistroSchema>;

/** Teléfono en formato E.164 (AD-9). */
export const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Normaliza un WhatsApp a E.164: quita espacios y guiones, y a un número peruano
 * de 9 dígitos que empieza por 9 le añade `+51`. No inventa prefijos para otros casos.
 */
export function normalizarWhatsapp(valor: string): string {
  const limpio = valor.replace(/[\s-]/g, "");
  return /^9\d{8}$/.test(limpio) ? `+51${limpio}` : limpio;
}

/** WhatsApp de entrada: se normaliza y luego debe quedar en E.164. */
export const WhatsappSchema = z
  .string()
  .transform(normalizarWhatsapp)
  .pipe(z.string().regex(E164_REGEX, "WhatsApp no válido: usa 9 dígitos (987 654 321) o +código"));

/** Cuerpo de `POST /api/v1/identidad/registro`. */
export const RegistroSchema = z.object({
  correo: z.string().trim().toLowerCase().pipe(z.email("Correo no válido")),
  contrasena: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
  rol: RolRegistroSchema,
  whatsapp: WhatsappSchema,
  ciudad: z.string().trim().min(1).max(100).optional(),
  /** Consentimiento para recibir avisos por WhatsApp. Debe enviarse explícitamente. */
  acepta_avisos: z.boolean(),
});
export type RegistroEntrada = z.input<typeof RegistroSchema>;
export type Registro = z.output<typeof RegistroSchema>;

/** Perfil de una cuenta: respuesta de registro y de `GET /api/v1/identidad/perfil`. */
export const PerfilSchema = z.object({
  id: z.uuid(),
  correo: z.string(),
  rol: RolSchema,
  whatsapp: z.string().regex(E164_REGEX),
  ciudad: z.string().nullable(),
  acepta_avisos: z.boolean(),
});
export type Perfil = z.infer<typeof PerfilSchema>;

/** Códigos de error del módulo `identidad`. */
export const CODIGOS_IDENTIDAD = {
  CORREO_YA_REGISTRADO: "CORREO_YA_REGISTRADO",
  NO_AUTENTICADO: "NO_AUTENTICADO",
  SIN_PERMISO: "SIN_PERMISO",
  SIN_PERFIL: "SIN_PERFIL",
  AUTH_NO_DISPONIBLE: "AUTH_NO_DISPONIBLE",
} as const;
export type CodigoIdentidad = (typeof CODIGOS_IDENTIDAD)[keyof typeof CODIGOS_IDENTIDAD];
