import { randomInt } from "node:crypto";
import { LONGITUD_CODIGO_ENLACE, PATRON_CODIGO_ENLACE } from "@reto18/shared";

/** Alfabeto base62 del código del enlace rastreable (AD-8). */
export const ALFABETO_BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Código aleatorio de 8 caracteres base62 con `crypto.randomInt` (sin sesgo de módulo). */
export function generarCodigo(): string {
  let codigo = "";
  for (let i = 0; i < LONGITUD_CODIGO_ENLACE; i++) {
    codigo += ALFABETO_BASE62[randomInt(ALFABETO_BASE62.length)];
  }
  return codigo;
}

/** `true` si `codigo` tiene la forma de un código de enlace (base62 de 8). No dice si existe. */
export function esCodigoValido(codigo: string): boolean {
  return PATRON_CODIGO_ENLACE.test(codigo);
}
