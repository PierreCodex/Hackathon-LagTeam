import { describe, expect, it } from "vitest";
import { ALFABETO_BASE62, esCodigoValido, generarCodigo } from "./codigo-enlace.js";

describe("código del enlace rastreable (AD-8)", () => {
  it("el alfabeto es base62 sin repetidos", () => {
    expect(ALFABETO_BASE62).toHaveLength(62);
    expect(new Set(ALFABETO_BASE62).size).toBe(62);
  });

  it("genera códigos base62 de 8 caracteres, válidos y distintos", () => {
    const codigos = Array.from({ length: 500 }, generarCodigo);
    for (const codigo of codigos) {
      expect(codigo).toMatch(/^[0-9A-Za-z]{8}$/);
      expect(esCodigoValido(codigo)).toBe(true);
    }
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it("usa todo el alfabeto (mayúsculas, minúsculas y dígitos)", () => {
    const vistos = new Set(Array.from({ length: 400 }, generarCodigo).join(""));
    expect(vistos.size).toBeGreaterThan(55);
  });

  it("rechaza formatos inválidos", () => {
    for (const codigo of ["", "abc", "abcdefghi", "abcd-fgh", "abcdéfgh", "abcd efg", " abcdefg", "../../xx"]) {
      expect(esCodigoValido(codigo)).toBe(false);
    }
    expect(esCodigoValido("aZ09bY18")).toBe(true);
  });
});
