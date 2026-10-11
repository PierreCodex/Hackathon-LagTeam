import { describe, expect, it } from "vitest";
import { direccionSinPais, distritoDe, lugarASede } from "./google-places";

const componentes = [
  { longText: "Av. Grau", shortText: "Av. Grau", types: ["route"] },
  { longText: "Castilla", shortText: "Castilla", types: ["locality", "political"] },
  { longText: "Piura", shortText: "Piura", types: ["administrative_area_level_2", "political"] },
];

describe("google-places", () => {
  it("toma el distrito de locality y, si falta, baja por la jerarquía", () => {
    expect(distritoDe(componentes)).toBe("Castilla");
    expect(distritoDe(componentes.filter((c) => !c.types.includes("locality")))).toBe("Piura");
    expect(distritoDe([])).toBe("");
  });

  it("quita el país al final de la dirección", () => {
    expect(direccionSinPais("Av. Grau 123, Piura 20001, Perú")).toBe("Av. Grau 123, Piura 20001");
    expect(direccionSinPais("Av. Grau 123")).toBe("Av. Grau 123");
  });

  it("usa el nombre del local solo si es un establecimiento", () => {
    const lugar = { displayName: "Teatro Municipal", formattedAddress: "Jr. Arequipa 210, Piura, Perú", addressComponents: componentes };
    expect(lugarASede(lugar, true, "")).toEqual({ nombre: "Teatro Municipal", direccion: "Jr. Arequipa 210, Piura", distrito: "Castilla" });
    expect(lugarASede(lugar, false, "Mi local").nombre).toBe("Mi local");
  });
});
