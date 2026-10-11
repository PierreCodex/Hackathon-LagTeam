import { describe, expect, it } from "vitest";
import { DESTINOS_POR_ROL, ROLES, destinosBarra, destinosCabecera } from "./navegacion";

describe("menú de la cabecera", () => {
  it.each(ROLES)("quita Cuenta y conserva el orden de la barra (%s)", (rol) => {
    const esperados = DESTINOS_POR_ROL[rol].filter((d) => d.id !== "cuenta");
    const cabecera = destinosCabecera(rol);

    expect(cabecera.some((d) => d.id === "cuenta")).toBe(false);
    expect(cabecera).toEqual(esperados);
  });

  it("al organizador le muestra Mis eventos · Marketing · Ventas", () => {
    expect(destinosCabecera("organizador").map((d) => d.etiqueta)).toEqual([
      "Mis eventos",
      "Marketing",
      "Ventas",
    ]);
  });

  it("al público le muestra Eventos · Calendario · Mis entradas", () => {
    expect(destinosCabecera("publico").map((d) => d.etiqueta)).toEqual([
      "Eventos",
      "Calendario",
      "Mis entradas",
    ]);
  });

  it("sin sesión, el público no ve Mis entradas ni Cuenta", () => {
    expect(destinosCabecera("publico", false).map((d) => d.etiqueta)).toEqual(["Eventos", "Calendario"]);
    expect(destinosBarra("publico", false).map((d) => d.etiqueta)).toEqual(["Eventos", "Calendario"]);
    expect(destinosBarra("publico").map((d) => d.etiqueta)).toEqual(["Eventos", "Calendario", "Mis entradas", "Cuenta"]);
  });

  it("no cambia la barra del rol", () => {
    destinosCabecera("administrador");
    expect(DESTINOS_POR_ROL.administrador.map((d) => d.id)).toContain("cuenta");
  });
});
