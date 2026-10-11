import { normalizarWhatsapp, RegistroSchema } from "@reto18/shared";
import { describe, expect, it } from "vitest";

const valido = {
  correo: "ana@ejemplo.pe",
  contrasena: "secreta123",
  rol: "publico",
  whatsapp: "987654321",
  acepta_avisos: false,
};

describe("normalizarWhatsapp", () => {
  it.each([
    ["987 654 321", "+51987654321"],
    ["987-654-321", "+51987654321"],
    ["51987654321", "+51987654321"],
    ["0051 987 654 321", "+51987654321"],
    ["+51 (987) 654.321", "+51987654321"],
    ["+34 600 000 000", "+34600000000"],
  ])("%j → %j", (entrada, salida) => {
    expect(normalizarWhatsapp(entrada)).toBe(salida);
  });
});

describe("RegistroSchema", () => {
  it("acepta un móvil peruano y el consentimiento en false", () => {
    expect(RegistroSchema.parse(valido)).toMatchObject({
      whatsapp: "+51987654321",
      acepta_avisos: false,
    });
  });

  it.each([
    ["+51 con 8 dígitos", "+5198765432"],
    ["+51 que no empieza por 9", "+51187654321"],
    ["demasiado corto", "12345"],
  ])("rechaza un WhatsApp %s", (_caso, whatsapp) => {
    expect(RegistroSchema.safeParse({ ...valido, whatsapp }).success).toBe(false);
  });

  it.each([
    ["  Piura  ", "Piura"],
    ["", undefined],
    [null, undefined],
    [undefined, undefined],
  ])("ciudad %j queda como %j", (ciudad, esperada) => {
    expect(RegistroSchema.parse({ ...valido, ciudad }).ciudad).toBe(esperada);
  });

  it("rechaza una ciudad de más de 100 caracteres", () => {
    expect(RegistroSchema.safeParse({ ...valido, ciudad: "a".repeat(101) }).success).toBe(false);
  });

  it("limita la contraseña a 72 bytes, no a 72 caracteres", () => {
    expect(RegistroSchema.safeParse({ ...valido, contrasena: "a".repeat(72) }).success).toBe(true);
    // 40 «ñ» son 40 caracteres pero 80 bytes en UTF-8.
    expect(RegistroSchema.safeParse({ ...valido, contrasena: "ñ".repeat(40) }).success).toBe(false);
  });
});
