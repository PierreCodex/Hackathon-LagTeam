import { describe, expect, it } from "vitest";
import {
  generarSeccionesCine,
  nombreFila,
  repartirAforo,
  sugerirAsientosPorFila,
  totalButacasSecciones,
  validarConfigCine,
} from "./mapa-cine";

describe("mapa-cine", () => {
  it("nombra las filas con letras y sigue con AA tras la Z", () => {
    expect([0, 1, 25, 26, 27].map(nombreFila)).toEqual(["A", "B", "Z", "AA", "AB"]);
  });

  it("sugiere más asientos por fila que filas", () => {
    const porFila = sugerirAsientosPorFila(300);
    expect(porFila).toBeGreaterThan(Math.ceil(300 / porFila));
  });

  it("reparte el aforo entre las categorías y la suma es el aforo", () => {
    const reparto = repartirAforo(100, ["VIP", "General"]);
    expect(reparto.map((s) => s.nombre)).toEqual(["VIP", "General"]);
    expect(reparto.reduce((s, x) => s + x.asientos, 0)).toBe(100);
    expect(reparto[0]!.asientos).toBeLessThan(reparto[1]!.asientos);
    expect(repartirAforo(50, ["Única"])).toEqual([{ nombre: "Única", asientos: 50 }]);
  });

  it("exige que las butacas coincidan con el aforo", () => {
    const config = { asientosPorFila: 10, pasilloCentral: true, aforo: 50, secciones: [{ nombre: "VIP", asientos: 20 }] };
    expect(validarConfigCine(config)).toMatch(/Faltan 30/);
    expect(validarConfigCine({ ...config, secciones: [{ nombre: "VIP", asientos: 60 }] })).toMatch(/Sobran 10/);
    expect(validarConfigCine({ ...config, secciones: [{ nombre: "VIP", asientos: 20 }, { nombre: "General", asientos: 30 }] })).toBeNull();
  });

  it("genera filas completas, la última con el resto, y el pasillo al medio", () => {
    const secciones = generarSeccionesCine({
      asientosPorFila: 8,
      pasilloCentral: true,
      secciones: [{ nombre: "VIP", asientos: 8 }, { nombre: "General", asientos: 13 }],
    });
    expect(secciones.map((s) => s.filas.map((f) => f.nombre))).toEqual([["A"], ["B", "C"]]);
    expect(secciones[1]!.filas.map((f) => f.bloques.map((b) => b.asientos.length))).toEqual([[4, 4], [3, 2]]);
    expect(totalButacasSecciones(secciones)).toBe(21);
  });
});
