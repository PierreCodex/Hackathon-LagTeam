import { describe, expect, it } from "vitest";
import { generarSeccionesCine, nombreFila, sugerirDimensiones, sugerirGrupos, validarConfigCine } from "./mapa-cine";

describe("mapa-cine", () => {
  it("nombra las filas con letras y sigue con AA tras la Z", () => {
    expect([0, 1, 25, 26, 27].map(nombreFila)).toEqual(["A", "B", "Z", "AA", "AB"]);
  });

  it("sugiere dimensiones que cubren el aforo", () => {
    const { filas, asientosPorFila } = sugerirDimensiones(300);
    expect(filas * asientosPorFila).toBeGreaterThanOrEqual(300);
    expect(asientosPorFila).toBeGreaterThan(filas);
  });

  it("sugiere VIP, Platea y General que suman todas las filas", () => {
    const grupos = sugerirGrupos(10);
    expect(grupos.map((g) => g.nombre)).toEqual(["VIP", "Platea", "General"]);
    expect(grupos.reduce((s, g) => s + g.filas, 0)).toBe(10);
    expect(sugerirGrupos(2)).toEqual([{ nombre: "General", filas: 2 }]);
  });

  it("rechaza secciones que no suman las filas de la sala", () => {
    const config = { filas: 5, asientosPorFila: 10, pasilloCentral: true, grupos: [{ nombre: "VIP", filas: 2 }] };
    expect(validarConfigCine(config)).toMatch(/suman 2 filas/);
    expect(validarConfigCine({ ...config, grupos: [{ nombre: "VIP", filas: 2 }, { nombre: "General", filas: 3 }] })).toBeNull();
  });

  it("genera filas con letras continuas y el pasillo al medio", () => {
    const secciones = generarSeccionesCine({
      filas: 3,
      asientosPorFila: 7,
      pasilloCentral: true,
      grupos: [{ nombre: "VIP", filas: 1 }, { nombre: "General", filas: 2 }],
    });
    expect(secciones.map((s) => s.filas.map((f) => f.nombre))).toEqual([["A"], ["B", "C"]]);
    const fila = secciones[1]!.filas[0]!;
    expect(fila.bloques.map((b) => b.asientos.length)).toEqual([4, 3]);
    expect(fila.bloques.map((b) => b.desplazamiento)).toEqual([0, 2]);
  });
});
