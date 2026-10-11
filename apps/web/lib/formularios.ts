import { RegistroSchema, type RegistroEntrada } from "@reto18/shared";
import { CODIGO_SIN_CONEXION, MENSAJE_SIN_CONEXION } from "./api";

/** Campos del formulario de registro, en orden de lectura (el foco va al primero con error). */
export const CAMPOS_REGISTRO = [
  "correo",
  "contrasena",
  "rol",
  "whatsapp",
  "ciudad",
  "acepta_avisos",
] as const;
export type CampoRegistro = (typeof CAMPOS_REGISTRO)[number];
export type ErroresRegistro = Partial<Record<CampoRegistro, string>>;

export type ValidacionRegistro =
  | { ok: true; datos: RegistroEntrada }
  | { ok: false; errores: ErroresRegistro };

/**
 * Valida con `RegistroSchema` (el mismo DTO que la API) y devuelve un error por campo,
 * con el texto del esquema. Si es válido devuelve la entrada tal cual: la API normaliza.
 */
export function validarRegistro(entrada: RegistroEntrada): ValidacionRegistro {
  const resultado = RegistroSchema.safeParse(entrada);
  if (resultado.success) {
    return { ok: true, datos: entrada };
  }
  const errores: ErroresRegistro = {};
  for (const problema of resultado.error.issues) {
    const campo = problema.path[0];
    if (typeof campo === "string" && (CAMPOS_REGISTRO as readonly string[]).includes(campo)) {
      errores[campo as CampoRegistro] ??= problema.message;
    }
  }
  return { ok: false, errores };
}

/** Primer campo con error en orden de lectura. */
export function primerCampoConError(errores: ErroresRegistro): CampoRegistro | undefined {
  return CAMPOS_REGISTRO.find((campo) => errores[campo]);
}

export const MENSAJE_CREDENCIALES = "Correo o contraseña incorrectos.";
export const MENSAJE_DEMASIADOS_INTENTOS =
  "Hiciste demasiados intentos. Espera un momento e inténtalo de nuevo.";

/** Error de Supabase Auth reducido a lo que importa (status y código). */
export type ErrorAuth = { status?: number; code?: string; name?: string };

/** Traduce el error de `signInWithPassword` a un mensaje para la persona. */
export function mensajeErrorIngreso(error: ErrorAuth): { codigo: string; mensaje: string } {
  const { status, code, name } = error;
  if (name === "AuthRetryableFetchError" || !status || status >= 500) {
    return { codigo: CODIGO_SIN_CONEXION, mensaje: MENSAJE_SIN_CONEXION };
  }
  if (status === 429 || code === "over_request_rate_limit") {
    return { codigo: "DEMASIADOS_INTENTOS", mensaje: MENSAJE_DEMASIADOS_INTENTOS };
  }
  return { codigo: "CREDENCIALES_INVALIDAS", mensaje: MENSAJE_CREDENCIALES };
}
