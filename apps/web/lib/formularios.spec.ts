import type { RegistroEntrada } from "@reto18/shared";
import { describe, expect, it } from "vitest";
import { CODIGO_SIN_CONEXION } from "./api";
import {
  MENSAJE_CREDENCIALES,
  mensajeErrorIngreso,
  primerCampoConError,
  validarRegistro,
} from "./formularios";

const valido: RegistroEntrada = {
  correo: "lucia@ejemplo.pe",
  contrasena: "secreta123",
  rol: "organizador",
  whatsapp: "987 654 321",
  ciudad: "",
  acepta_avisos: false,
};

describe("validarRegistro", () => {
  it("datos válidos: devuelve la entrada tal cual (la API normaliza)", () => {
    expect(validarRegistro(valido)).toEqual({ ok: true, datos: valido });
  });

  it("WhatsApp 12345 y contraseña corta: un error por campo con el texto del esquema", () => {
    const resultado = validarRegistro({ ...valido, whatsapp: "12345", contrasena: "corta" });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.errores.whatsapp).toMatch(/WhatsApp no válido/);
    expect(resultado.errores.contrasena).toBe("La contraseña debe tener al menos 8 caracteres");
    expect(resultado.errores.correo).toBeUndefined();
    expect(primerCampoConError(resultado.errores)).toBe("contrasena");
  });

  it("correo no válido va primero en el orden de lectura", () => {
    const resultado = validarRegistro({ ...valido, correo: "no-es-correo", whatsapp: "1" });
    expect(resultado.ok || primerCampoConError(resultado.errores)).toBe("correo");
  });
});

describe("mensajeErrorIngreso", () => {
  it("credenciales malas → 'Correo o contraseña incorrectos.'", () => {
    expect(mensajeErrorIngreso({ status: 400, code: "invalid_credentials" }).mensaje).toBe(
      MENSAJE_CREDENCIALES,
    );
  });

  it("Auth caído o sin red → SIN_CONEXION", () => {
    expect(mensajeErrorIngreso({ status: 0, name: "AuthRetryableFetchError" }).codigo).toBe(
      CODIGO_SIN_CONEXION,
    );
    expect(mensajeErrorIngreso({ status: 503 }).codigo).toBe(CODIGO_SIN_CONEXION);
  });

  it("demasiados intentos → aviso propio", () => {
    expect(mensajeErrorIngreso({ status: 429 }).codigo).toBe("DEMASIADOS_INTENTOS");
  });
});
