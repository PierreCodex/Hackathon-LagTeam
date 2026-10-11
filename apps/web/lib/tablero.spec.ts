import { describe, expect, it } from "vitest";
import { anchoBarra, leerComision, textoComision, valorEnFormulario } from "./tablero";

describe("leerComision", () => {
  it("convierte el porcentaje a puntos básicos", () => {
    expect(leerComision("porcentaje", "5")).toEqual({ ok: true, comision: { modelo: "porcentaje", valor: 500 } });
    expect(leerComision("porcentaje", "7,5")).toEqual({ ok: true, comision: { modelo: "porcentaje", valor: 750 } });
  });

  it("rechaza porcentajes inválidos o de más de 100", () => {
    expect(leerComision("porcentaje", "abc").ok).toBe(false);
    expect(leerComision("porcentaje", "150").ok).toBe(false);
  });

  it("convierte los montos en soles a céntimos", () => {
    expect(leerComision("fijo_por_entrada", "2.50")).toEqual({ ok: true, comision: { modelo: "fijo_por_entrada", valor: 250 } });
    expect(leerComision("tarifa_evento", "-1").ok).toBe(false);
  });
});

describe("textoComision y valorEnFormulario", () => {
  it("muestran la comisión como la escribe el administrador", () => {
    expect(textoComision({ modelo: "porcentaje", valor: 500 })).toBe("5 % de cada venta");
    expect(textoComision({ modelo: "fijo_por_entrada", valor: 250 })).toBe("S/ 2.50 por entrada");
    expect(textoComision({ modelo: "tarifa_evento", valor: 5000 })).toBe("S/ 50 por evento");
    expect(valorEnFormulario({ modelo: "porcentaje", valor: 750 })).toBe("7.5");
  });
});

describe("anchoBarra", () => {
  it("es proporcional al máximo y nunca invisible si hay algo", () => {
    expect(anchoBarra(50, 100)).toBe(50);
    expect(anchoBarra(1, 1000)).toBe(2);
    expect(anchoBarra(0, 100)).toBe(0);
  });
});
