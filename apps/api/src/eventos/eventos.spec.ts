import { randomUUID } from "node:crypto";
import { CategoriaEventoSchema, CategoriaPrecioSchema, EventoSchema, MapaSedeSchema } from "@reto18/shared";
import { describe, expect, it } from "vitest";
import { mapaDeCroquis } from "../../test/fixtures/croquis.js";

describe("contratos compartidos de eventos", () => {
  it("acepta el mapa completo de 643 butacas de los croquis", () => {
    const mapa = MapaSedeSchema.parse(mapaDeCroquis());
    expect(mapa.secciones.flatMap((s) => s.filas.flatMap((f) => f.bloques.flatMap((b) => b.asientos)))).toHaveLength(643);
  });

  it("rechaza el mismo número en bloques diferentes de una fila", () => {
    const mapa = mapaDeCroquis();
    mapa.secciones[0]!.filas[0]!.bloques[1]!.asientos[0]!.numero = 1;
    expect(MapaSedeSchema.safeParse(mapa).success).toBe(false);
  });

  it.each([
    { tipo: "general", capacidad: null, filas: [] },
    { tipo: "general", capacidad: 0, filas: [] },
    { tipo: "numerada", capacidad: 20, filas: [] },
    { tipo: "general", capacidad: 20, filas: mapaDeCroquis().secciones[0]!.filas },
  ])("rechaza una sección incoherente: $tipo / $capacidad", (seccion) => {
    const mapa = mapaDeCroquis();
    expect(MapaSedeSchema.safeParse({ ...mapa, secciones: [{ ...mapa.secciones[0], ...seccion }] }).success).toBe(false);
  });

  it("acepta una zona general con capacidad y sin filas", () => {
    const mapa = mapaDeCroquis();
    expect(MapaSedeSchema.safeParse({ ...mapa, secciones: [{ ...mapa.secciones[0], tipo: "general", capacidad: 120, filas: [] }] }).success).toBe(true);
  });

  it("acepta artes_visuales y rechaza categorías desconocidas", () => {
    expect(CategoriaEventoSchema.parse("artes_visuales")).toBe("artes_visuales");
    expect(CategoriaEventoSchema.safeParse("deporte").success).toBe(false);
  });

  const precio = { id: randomUUID(), evento_id: randomUUID(), sede_id: randomUUID(), nombre: "General", color: "#059669", precio_centimos: 1500, seccion_id: null };
  it.each([-1, 1.5, 2147483648])("rechaza un precio inválido: %s", (precio_centimos) => {
    expect(CategoriaPrecioSchema.safeParse({ ...precio, precio_centimos }).success).toBe(false);
  });
  it("acepta entrada gratuita y rechaza colores o referencias inválidos", () => {
    expect(CategoriaPrecioSchema.safeParse({ ...precio, precio_centimos: 0 }).success).toBe(true);
    expect(CategoriaPrecioSchema.safeParse({ ...precio, color: "rojo" }).success).toBe(false);
    expect(CategoriaPrecioSchema.safeParse({ ...precio, seccion_id: "zona" }).success).toBe(false);
    expect(CategoriaPrecioSchema.safeParse({ ...precio, sede_id: null }).success).toBe(false);
    expect(CategoriaPrecioSchema.safeParse({ ...precio, sede_id: undefined }).success).toBe(false);
  });

  it("valida un evento y exige zona horaria, aforo positivo y estado conocido", () => {
    const evento = { id: randomUUID(), organizador_id: randomUUID(), sede_id: randomUUID(), titulo: "Teatro", descripcion: "Función", categoria: "teatro", distrito: "Piura", inicio: "2026-10-17T19:00:00-05:00", estado: "aprobado", motivo_rechazo: null, destacado: false, hay_musica: false, constancia_apdayc_url: null, foto_url: null, aforo: 643, publicado: true };
    expect(EventoSchema.safeParse(evento).success).toBe(true);
    for (const cambio of [{ inicio: "2026-10-17T19:00:00" }, { aforo: 0 }, { estado: "publicado" }, { publicado: undefined }]) {
      expect(EventoSchema.safeParse({ ...evento, ...cambio }).success).toBe(false);
    }
  });
});
