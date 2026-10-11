import { AltaEventoSchema, CODIGOS_EVENTOS } from "@reto18/shared";
import { describe, expect, it } from "vitest";
import { parsearDatos } from "./eventos.service.js";

const valido = {
  titulo: "Noche de marinera",
  categoria: "danza",
  descripcion: "Una noche de marinera norteña con parejas de Piura.",
  inicio: "2030-11-20T20:00:00-05:00",
  aforo: 100,
  hay_musica: false,
  sede: { tipo: "nueva", nombre: "Patio de prueba", direccion: "Jr. Lima 123", distrito: "Piura", capacidad: 120 },
  categorias: [
    { nombre: "General", precio_centimos: 2000 },
    { nombre: "VIP", precio_centimos: 5000, color: "#2563EB" },
  ],
};

describe("AltaEventoSchema", () => {
  it("acepta un alta con sede nueva y otra con sede existente", () => {
    expect(AltaEventoSchema.safeParse(valido).success).toBe(true);
    const existente = { ...valido, sede: { tipo: "existente", sede_id: "13100000-0000-4000-8000-000000000001" } };
    expect(AltaEventoSchema.safeParse(existente).success).toBe(true);
  });

  it.each([
    ["sin categorías", { categorias: [] }, "categorias"],
    [
      "más de 6 categorías",
      { categorias: Array.from({ length: 7 }, (_, i) => ({ nombre: `C${i}`, precio_centimos: 0 })) },
      "categorias",
    ],
    ["precio negativo", { categorias: [{ nombre: "General", precio_centimos: -1 }] }, "categorias.0.precio_centimos"],
    ["precio con decimales", { categorias: [{ nombre: "General", precio_centimos: 10.5 }] }, "categorias.0.precio_centimos"],
    [
      "nombres de categoría repetidos",
      { categorias: [{ nombre: "General", precio_centimos: 0 }, { nombre: " general ", precio_centimos: 100 }] },
      "categorias.1.nombre",
    ],
    ["inicio pasado", { inicio: "2020-01-01T20:00:00-05:00" }, "inicio"],
    ["inicio sin zona horaria", { inicio: "2030-11-20T20:00:00" }, "inicio"],
    ["descripción corta", { descripcion: "Muy corta" }, "descripcion"],
    ["descripción larga", { descripcion: "a".repeat(601) }, "descripcion"],
    ["aforo cero", { aforo: 0 }, "aforo"],
    ["aforo con decimales", { aforo: 10.5 }, "aforo"],
    ["categoría desconocida", { categoria: "deporte" }, "categoria"],
    ["color no válido", { categorias: [{ nombre: "General", precio_centimos: 0, color: "rojo" }] }, "categorias.0.color"],
    ["sede sin tipo", { sede: { sede_id: "13100000-0000-4000-8000-000000000001" } }, "sede.tipo"],
    ["sede nueva sin capacidad", { sede: { tipo: "nueva", nombre: "X", direccion: "Y", distrito: "Piura" } }, "sede.capacidad"],
  ])("%s → DATOS_INVALIDOS nombrando el campo", (_caso, cambio, campo) => {
    expect(() => parsearDatos(JSON.stringify({ ...valido, ...cambio }))).toThrow(
      expect.objectContaining({
        response: { codigo: CODIGOS_EVENTOS.DATOS_INVALIDOS, mensaje: expect.stringContaining(`${campo}:`) },
      }),
    );
  });

  it("JSON mal formado → DATOS_INVALIDOS", () => {
    expect(() => parsearDatos("{titulo:")).toThrow(
      expect.objectContaining({
        response: { codigo: CODIGOS_EVENTOS.DATOS_INVALIDOS, mensaje: "datos: no es un JSON válido" },
      }),
    );
  });

  it("sin campo datos → DATOS_INVALIDOS", () => {
    expect(() => parsearDatos(undefined)).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ codigo: CODIGOS_EVENTOS.DATOS_INVALIDOS }) }),
    );
  });
});
