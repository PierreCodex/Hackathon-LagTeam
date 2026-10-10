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
 * Normaliza un WhatsApp a E.164: quita espacios, guiones, puntos y paréntesis; `00…` pasa a `+…`;
 * a un número peruano de 9 dígitos que empieza por 9 (con o sin `51` delante) le añade `+51`.
 * No inventa prefijos para otros casos.
 */
export function normalizarWhatsapp(valor: string): string {
  let limpio = valor.replace(/[\s.()-]/g, "");
  if (limpio.startsWith("00")) limpio = `+${limpio.slice(2)}`;
  if (/^9\d{8}$/.test(limpio)) return `+51${limpio}`;
  if (/^519\d{8}$/.test(limpio)) return `+${limpio}`;
  return limpio;
}

/** Un móvil peruano (`+51`) tiene 9 dígitos y empieza por 9. */
const MOVIL_PERU_REGEX = /^\+519\d{8}$/;

/** WhatsApp de entrada: se normaliza y luego debe quedar en E.164. */
export const WhatsappSchema = z
  .string()
  .transform(normalizarWhatsapp)
  .pipe(
    z
      .string()
      .regex(E164_REGEX, "WhatsApp no válido: usa 9 dígitos (987 654 321) o +código")
      .refine((v) => !v.startsWith("+51") || MOVIL_PERU_REGEX.test(v), {
        message: "WhatsApp no válido: un móvil de Perú tiene 9 dígitos y empieza por 9",
      }),
  );

/** Auth limita la contraseña a 72 bytes (bcrypt), no a 72 caracteres. */
const BYTES_MAX_CONTRASENA = 72;

/** Bytes de un texto en UTF-8 (sin `TextEncoder`, que no está en los tipos de este paquete). */
function bytesUtf8(texto: string): number {
  let bytes = 0;
  for (const caracter of texto) {
    const codigo = caracter.codePointAt(0) ?? 0;
    bytes += codigo < 0x80 ? 1 : codigo < 0x800 ? 2 : codigo < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Cuerpo de `POST /api/v1/identidad/registro`. */
export const RegistroSchema = z.object({
  correo: z.string().trim().toLowerCase().pipe(z.email("Correo no válido")),
  contrasena: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .refine((v) => bytesUtf8(v) <= BYTES_MAX_CONTRASENA, {
      message: `La contraseña no puede pasar de ${BYTES_MAX_CONTRASENA} bytes`,
    }),
  rol: RolRegistroSchema,
  whatsapp: WhatsappSchema,
  /** Opcional: `""` y `null` cuentan como sin ciudad (así lo envía el formulario de la 1.8). */
  ciudad: z
    .string()
    .trim()
    .max(100)
    .nullish()
    .transform((v) => v || undefined),
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
