import { ServiceUnavailableException } from "@nestjs/common";
import { CODIGOS_VENTAS } from "@reto18/shared";
import { describe, expect, it } from "vitest";
import { FirmaQr, firmaDe, firmarQr, verificarQr } from "./qr.js";

const SECRETO = "secreto-de-prueba-con-longitud-suficiente";
const ENTRADA = "11111111-1111-4111-8111-111111111111";

describe("QR firmado (AD-7)", () => {
  it("el QR es `entrada_id.firma` con HMAC-SHA256 en base64url y se verifica", () => {
    const qr = firmarQr(ENTRADA, SECRETO);
    expect(qr).toMatch(/^11111111-1111-4111-8111-111111111111\.[A-Za-z0-9_-]{43}$/);
    expect(verificarQr(qr, SECRETO)).toBe(ENTRADA);
    expect(verificarQr(`  ${qr}\n`, SECRETO)).toBe(ENTRADA);
  });

  it("la firma es determinista y depende del secreto y del id", () => {
    expect(firmaDe(ENTRADA, SECRETO)).toBe(firmaDe(ENTRADA, SECRETO));
    expect(firmaDe(ENTRADA, "otro-secreto")).not.toBe(firmaDe(ENTRADA, SECRETO));
    expect(firmaDe("22222222-2222-4222-8222-222222222222", SECRETO)).not.toBe(firmaDe(ENTRADA, SECRETO));
  });

  it("rechaza un QR manipulado: otro id con la misma firma, firma alterada u otro secreto", () => {
    const firma = firmaDe(ENTRADA, SECRETO);
    expect(verificarQr(`22222222-2222-4222-8222-222222222222.${firma}`, SECRETO)).toBeNull();
    const alterada = `${firma.slice(0, -1)}${firma.endsWith("A") ? "B" : "A"}`;
    expect(verificarQr(`${ENTRADA}.${alterada}`, SECRETO)).toBeNull();
    expect(verificarQr(firmarQr(ENTRADA, "otro-secreto"), SECRETO)).toBeNull();
  });

  it.each([
    "",
    ENTRADA,
    `${ENTRADA}.`,
    `${ENTRADA}.corta`,
    `no-es-uuid.${"a".repeat(43)}`,
    `${ENTRADA.toUpperCase()}.${"a".repeat(43)}`,
    `${ENTRADA}.${"a".repeat(44)}`,
    `${ENTRADA}.${"+".repeat(43)}`,
    `${ENTRADA}.${"a".repeat(43)}.extra`,
  ])("rechaza el formato roto %#", (qr) => {
    expect(verificarQr(qr, SECRETO)).toBeNull();
  });

  it("FirmaQr sin QR_SECRET responde 503 QR_NO_CONFIGURADO al firmar y al verificar", () => {
    for (const secreto of [undefined, "", "   "]) {
      const firma = new FirmaQr(secreto);
      for (const accion of [() => firma.firmar(ENTRADA), () => firma.verificar(`${ENTRADA}.x`)]) {
        const error = (() => {
          try {
            accion();
          } catch (e) {
            return e;
          }
        })();
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect((error as ServiceUnavailableException).getResponse()).toMatchObject({ codigo: CODIGOS_VENTAS.QR_NO_CONFIGURADO });
      }
    }
  });

  it("FirmaQr con secreto firma y verifica igual que las funciones", () => {
    const firma = new FirmaQr(SECRETO);
    expect(firma.firmar(ENTRADA)).toBe(firmarQr(ENTRADA, SECRETO));
    expect(firma.verificar(firmarQr(ENTRADA, SECRETO))).toBe(ENTRADA);
  });
});
