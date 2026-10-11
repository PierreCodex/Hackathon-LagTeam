import { CODIGOS_ACCESO, type ResultadoValidacion } from "@reto18/shared";
import { describe, expect, it } from "vitest";
import {
  avisoDeErrorValidacion,
  avisoDeResultadoValidacion,
  debeProcesarCodigo,
  esErrorPermisoCamara,
  mensajeErrorCamara,
  MENSAJE_PERMISO_CAMARA,
  MENSAJE_SIN_CAMARA,
  VENTANA_REPETIDO_MS,
} from "./escaner";

// Matriz I/O de la historia 8 (escanear), sobre la lógica pura: sin React ni cámara real.

const RESULTADO: ResultadoValidacion = {
  resultado: "aceptada",
  entrada_id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  evento_id: "5f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4c",
  usada_en: "2026-10-16T20:05:00-05:00",
};

describe("avisoDeResultadoValidacion", () => {
  it("200 aceptada: aviso de éxito", () => {
    expect(avisoDeResultadoValidacion(RESULTADO)).toEqual({
      tipo: "exito",
      titulo: "Entrada aceptada. Puede pasar.",
    });
  });
});

describe("avisoDeErrorValidacion", () => {
  it("ENTRADA_YA_USADA con la hora de uso", () => {
    const aviso = avisoDeErrorValidacion({
      codigo: CODIGOS_ACCESO.ENTRADA_YA_USADA,
      mensaje: "Esta entrada ya se usó",
      detalles: { usada_en: "2026-10-16T20:05:00-05:00" },
    });
    expect(aviso.tipo).toBe("advertencia");
    expect(aviso.titulo).toBe("Esta entrada ya se usó.");
    expect(aviso.detalle).toContain("Vie 16 oct");
  });

  it("ENTRADA_YA_USADA sin detalles: el mensaje de la API tal cual", () => {
    const aviso = avisoDeErrorValidacion({ codigo: CODIGOS_ACCESO.ENTRADA_YA_USADA, mensaje: "Esta entrada ya se usó" });
    expect(aviso.detalle).toBe("Esta entrada ya se usó");
  });

  it.each([
    [CODIGOS_ACCESO.ENTRADA_DE_OTRO_EVENTO, "La entrada es de otro evento"],
    [CODIGOS_ACCESO.QR_INVALIDO, "El QR no es una entrada válida"],
    [CODIGOS_ACCESO.EVENTO_NO_ENCONTRADO, "El evento no existe"],
  ])("%s: aviso de error con el mensaje de la API", (codigo, mensaje) => {
    const aviso = avisoDeErrorValidacion({ codigo, mensaje });
    expect(aviso).toEqual({ tipo: "error", titulo: "No se aceptó la entrada.", detalle: mensaje });
  });
});

describe("debeProcesarCodigo (evita mandar el mismo frame varias veces)", () => {
  it("primera lectura: siempre se procesa", () => {
    expect(debeProcesarCodigo(null, "abc", 0)).toBe(true);
  });

  it("mismo texto antes de la ventana: no se procesa otra vez", () => {
    expect(debeProcesarCodigo({ texto: "abc", en: 1000 }, "abc", 1000 + VENTANA_REPETIDO_MS - 1)).toBe(false);
  });

  it("mismo texto tras la ventana: se procesa de nuevo (p. ej. se volvió a escanear)", () => {
    expect(debeProcesarCodigo({ texto: "abc", en: 1000 }, "abc", 1000 + VENTANA_REPETIDO_MS)).toBe(true);
  });

  it("texto distinto: se procesa aunque sea casi al mismo tiempo", () => {
    expect(debeProcesarCodigo({ texto: "abc", en: 1000 }, "otro", 1001)).toBe(true);
  });
});

describe("permiso de cámara", () => {
  it("NotAllowedError (y variantes del navegador) es un permiso negado", () => {
    expect(esErrorPermisoCamara(new DOMException("x", "NotAllowedError"))).toBe(true);
    expect(esErrorPermisoCamara(new DOMException("x", "PermissionDeniedError"))).toBe(true);
    expect(esErrorPermisoCamara(new DOMException("x", "SecurityError"))).toBe(true);
  });

  it("otro fallo (p. ej. sin cámara en el dispositivo) no es un permiso negado", () => {
    expect(esErrorPermisoCamara(new DOMException("x", "NotFoundError"))).toBe(false);
    expect(esErrorPermisoCamara("no es un Error")).toBe(false);
  });

  it("mensajeErrorCamara distingue el permiso negado de cualquier otro fallo, sin reintentar solo", () => {
    expect(mensajeErrorCamara(new DOMException("x", "NotAllowedError"))).toBe(MENSAJE_PERMISO_CAMARA);
    expect(mensajeErrorCamara(new DOMException("x", "NotFoundError"))).toBe(MENSAJE_SIN_CAMARA);
  });
});
