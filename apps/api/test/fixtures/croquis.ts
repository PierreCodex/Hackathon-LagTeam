import { randomUUID } from "node:crypto";
import type { MapaSede, MapaSedeEntrada } from "@reto18/shared";

/** Oráculo transcrito del plan, independiente de la generación SQL. */
export const CROQUIS = [
  { nombre: "Platea baja", total: 190, grupos: [
    { filas: "ABC", bloques: [[1, 11, 2], [12, 22, 0]] },
    { filas: "DEF", bloques: [[1, 12, 1], [13, 24, 0]] },
    { filas: "GH", bloques: [[1, 13, 0], [14, 26, 0]] },
  ] },
  { nombre: "Platea media", total: 204, grupos: [
    { filas: "IJK", bloques: [[1, 14, 1], [15, 28, 0]] },
    { filas: "LMNO", bloques: [[1, 15, 0], [16, 30, 0]] },
  ] },
  { nombre: "Mezanine", total: 249, grupos: [
    { filas: "P", bloques: [[1, 8, 1], [9, 26, 0], [27, 34, 0]] },
    { filas: "Q", bloques: [[1, 8, 1], [9, 26, 0], [27, 36, 0]] },
    { filas: "R", bloques: [[1, 9, 0], [10, 27, 0], [28, 37, 0]] },
    { filas: "ST", bloques: [[1, 9, 0], [10, 26, 0], [27, 36, 0]] },
    { filas: "U", bloques: [[1, 7, 2], [8, 14, 5], [15, 22, 0]] },
    { filas: "V", bloques: [[1, 8, 1], [9, 15, 5], [16, 23, 0]] },
    { filas: "W", bloques: [[1, 8, 1], [9, 17, 4], [18, 25, 0]] },
  ] },
] as const;

export function mapaDeCroquis(): MapaSede {
  return {
    id: randomUUID(), nombre: "Teatro de ejemplo de Piura", direccion: "Sede ficticia", distrito: "Piura",
    secciones: CROQUIS.map((seccion, s) => ({
      id: randomUUID(), nombre: seccion.nombre, orden: s + 1, tipo: "numerada", capacidad: null,
      filas: seccion.grupos.flatMap((grupo) => [...grupo.filas].map((nombre) => ({
        id: randomUUID(), nombre,
        bloques: grupo.bloques.map(([inicio, fin, desplazamiento], b) => ({
          id: randomUUID(), orden: b + 1, desplazamiento,
          asientos: Array.from({ length: fin - inicio + 1 }, (_, a) => ({ id: randomUUID(), numero: inicio + a })),
        })),
      }))).map((fila, f) => ({ ...fila, orden: f + 1 })),
    })),
  };
}

/** Un mapa (de `GET .../mapa` o de `mapaDeCroquis()`) como cuerpo de entrada: sin ids, salvo los de las zonas generales. */
export function aEntrada(mapa: MapaSede): MapaSedeEntrada {
  return {
    nombre: mapa.nombre, direccion: mapa.direccion, distrito: mapa.distrito,
    secciones: mapa.secciones.map((s) => s.tipo === "general"
      ? { id: s.id, nombre: s.nombre, orden: s.orden, tipo: "general" as const, capacidad: s.capacidad }
      : {
        nombre: s.nombre, orden: s.orden, tipo: "numerada" as const,
        filas: s.filas.map((f) => ({
          nombre: f.nombre, orden: f.orden,
          bloques: f.bloques.map((b) => ({ orden: b.orden, desplazamiento: b.desplazamiento, asientos: b.asientos.map((a) => ({ numero: a.numero })) })),
        })),
      }),
  };
}

/** El mapa de los croquis (3 secciones numeradas, 643 asientos) como cuerpo de entrada, sin ids. */
export function entradaDeCroquis(nombre = "Teatro de ejemplo de Piura"): MapaSedeEntrada {
  return { ...aEntrada(mapaDeCroquis()), nombre };
}

export const SEDE_CROQUIS_ID = "13100000-0000-4000-8000-000000000001";
export const SEDE_GENERAL_ID = "13100000-0000-4000-8000-000000000002";
export const ORGANIZADOR_DEMO_ID = "13000000-0000-4000-8000-000000000001";
