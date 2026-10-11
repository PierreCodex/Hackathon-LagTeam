import { MAXIMO_ENTRADAS_POR_ORDEN, type CategoriaPrecio } from "@reto18/shared";
import { describe, expect, it } from "vitest";
import {
  OPCIONES_METODO_PAGO,
  opcionesCantidad,
  categoriasDeZonaGeneral,
  opcionesCategoria,
  totalCompra,
  validarSeleccionCompra,
} from "./compra";

// Lógica pura del checkout (historia 8), sobre la matriz I/O de la historia.

function categoria(parciales: Partial<CategoriaPrecio> = {}): CategoriaPrecio {
  return {
    id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    evento_id: "5f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4c",
    sede_id: "4f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4d",
    nombre: "General",
    color: "#FF0000",
    precio_centimos: 2500,
    seccion_id: null,
    ...parciales,
  };
}

describe("opciones del formulario", () => {
  it("método de pago: tarjeta, yape y plin", () => {
    expect(OPCIONES_METODO_PAGO).toEqual([
      { valor: "tarjeta", etiqueta: "Tarjeta" },
      { valor: "yape", etiqueta: "Yape" },
      { valor: "plin", etiqueta: "Plin" },
    ]);
  });

  it("cantidad: de 1 al máximo por orden", () => {
    const opciones = opcionesCantidad();
    expect(opciones).toHaveLength(MAXIMO_ENTRADAS_POR_ORDEN);
    expect(opciones[0]).toEqual({ valor: "1", etiqueta: "1 entrada" });
    expect(opciones[1]).toEqual({ valor: "2", etiqueta: "2 entradas" });
    expect(opciones.at(-1)).toEqual({ valor: String(MAXIMO_ENTRADAS_POR_ORDEN), etiqueta: `${MAXIMO_ENTRADAS_POR_ORDEN} entradas` });
  });

  it("categoría: nombre y precio en la etiqueta; 0 céntimos dice 'Entrada libre'", () => {
    const c1 = categoria({ id: "a", nombre: "General", precio_centimos: 2500 });
    const c2 = categoria({ id: "b", nombre: "Libre", precio_centimos: 0 });
    expect(opcionesCategoria([c1, c2])).toEqual([
      { valor: "a", etiqueta: "General · S/ 25" },
      { valor: "b", etiqueta: "Libre · Entrada libre" },
    ]);
  });
});

describe("total a mostrar", () => {
  it("sin categoría elegida: null", () => {
    expect(totalCompra([categoria({ id: "a" })], "", 1)).toBeNull();
    expect(totalCompra([categoria({ id: "a" })], "otra", 1)).toBeNull();
  });

  it("precio por cantidad, en soles", () => {
    expect(totalCompra([categoria({ id: "a", precio_centimos: 2500 })], "a", 1)).toBe("S/ 25");
    expect(totalCompra([categoria({ id: "a", precio_centimos: 2550 })], "a", 2)).toBe("S/ 51");
  });
});

describe("validarSeleccionCompra (antes de POST ventas/ordenes)", () => {
  it("sin categoría elegida", () => {
    expect(validarSeleccionCompra("", 1)).toEqual({ ok: false, mensaje: "Elige una categoría." });
  });

  it("cantidad fuera de 1–máximo", () => {
    expect(validarSeleccionCompra("a", 0)).toMatchObject({ ok: false });
    expect(validarSeleccionCompra("a", MAXIMO_ENTRADAS_POR_ORDEN + 1)).toMatchObject({ ok: false });
    expect(validarSeleccionCompra("a", 1.5)).toMatchObject({ ok: false });
  });

  it("categoría y cantidad válidas", () => {
    expect(validarSeleccionCompra("a", 1)).toEqual({ ok: true });
    expect(validarSeleccionCompra("a", MAXIMO_ENTRADAS_POR_ORDEN)).toEqual({ ok: true });
  });
});

describe("categoriasDeZonaGeneral", () => {
  it("deja solo las de zona general: las numeradas se compran eligiendo butaca", () => {
    const general = categoria({ id: "g", seccion_id: "13200000-0000-4000-8000-000000000001" });
    const numerada = categoria({ id: "n", seccion_id: null });
    expect(categoriasDeZonaGeneral([numerada, general])).toEqual([general]);
    expect(categoriasDeZonaGeneral([numerada])).toEqual([]);
  });
});
