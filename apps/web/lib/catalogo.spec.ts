import type { EventoPublico } from "@reto18/shared";
import { describe, expect, it } from "vitest";
import {
  armarFilas,
  distritosDe,
  eventosHeroe,
  fechaCorta,
  leerFiltros,
  rangoFecha,
  rutaCatalogo,
  soles,
  textoPrecio,
} from "./catalogo";

// Domingo 11 oct 2026, 2:40 a. m. en Lima (07:40 UTC).
const AHORA = Date.parse("2026-10-11T07:40:00Z");

let n = 0;
function evento(parcial: Partial<EventoPublico>): EventoPublico {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    titulo: `Evento ${n}`,
    descripcion: "x",
    categoria: "musica",
    distrito: "Piura",
    inicio: "2026-10-16T20:00:00-05:00",
    destacado: false,
    foto_url: null,
    aforo: 100,
    precio_minimo_centimos: 2500,
    sede: { id: "13100000-0000-4000-8000-000000000001", nombre: "Teatro", direccion: "Centro", distrito: "Piura" },
    categorias: [],
    ...parcial,
  };
}

describe("rangoFecha (días de Lima)", () => {
  it("hoy", () => expect(rangoFecha("hoy", AHORA)).toEqual({ desde: "2026-10-11", hasta: "2026-10-11" }));
  it("en domingo, el fin de semana es solo hoy", () =>
    expect(rangoFecha("fin-de-semana", AHORA)).toEqual({ desde: "2026-10-11", hasta: "2026-10-11" }));
  it("un martes, el fin de semana va de viernes a domingo", () =>
    expect(rangoFecha("fin-de-semana", Date.parse("2026-10-13T15:00:00Z"))).toEqual({ desde: "2026-10-16", hasta: "2026-10-18" }));
  it("este mes, desde hoy hasta el último día", () =>
    expect(rangoFecha("este-mes", AHORA)).toEqual({ desde: "2026-10-11", hasta: "2026-10-31" }));
  it("a las 11 p. m. de Lima sigue siendo el mismo día", () =>
    expect(rangoFecha("hoy", Date.parse("2026-10-12T04:00:00Z"))).toEqual({ desde: "2026-10-11", hasta: "2026-10-11" }));
  it("opción desconocida → null", () => expect(rangoFecha("ayer", AHORA)).toBeNull());
});

describe("leerFiltros", () => {
  it("sin parámetros no hay filtros", () => {
    expect(leerFiltros({}, AHORA)).toEqual({
      valores: { q: "", fecha: "", distrito: "", precio: "", categoria: "" },
      consulta: {},
      activos: false,
    });
  });

  it("traduce cada filtro a la consulta de la API", () => {
    const { consulta, activos } = leerFiltros(
      { q: " marinera ", fecha: "hoy", distrito: "Castilla", precio: "20-50", categoria: "danza" },
      AHORA,
    );
    expect(activos).toBe(true);
    expect(consulta).toEqual({
      q: "marinera",
      distrito: "Castilla",
      categoria: "danza",
      desde: "2026-10-11",
      hasta: "2026-10-11",
      precio_minimo_centimos: "2000",
      precio_maximo_centimos: "5000",
    });
  });

  it.each([
    ["gratis", { precio_maximo_centimos: "0" }],
    ["hasta-20", { precio_maximo_centimos: "2000" }],
    ["mas-50", { precio_minimo_centimos: "5000" }],
  ])("precio %s", (precio, esperado) => {
    expect(leerFiltros({ precio }, AHORA).consulta).toEqual(esperado);
  });

  it("ignora valores que no reconoce y los vacía en el buscador", () => {
    const filtros = leerFiltros({ categoria: "circo", precio: "caro", fecha: "ayer" }, AHORA);
    expect(filtros.consulta).toEqual({});
    expect(filtros.activos).toBe(false);
    expect(filtros.valores).toMatchObject({ categoria: "", precio: "", fecha: "" });
  });

  it("toma el primer valor si llega repetido", () => {
    expect(leerFiltros({ categoria: ["cine", "teatro"] }, AHORA).consulta).toEqual({ categoria: "cine" });
  });
});

describe("textos de la tarjeta", () => {
  it("rutaCatalogo", () => {
    expect(rutaCatalogo()).toBe("eventos");
    expect(rutaCatalogo({ categoria: "cine", q: "río" })).toBe("eventos?categoria=cine&q=r%C3%ADo");
  });
  it("soles", () => {
    expect(soles(2500)).toBe("S/ 25");
    expect(soles(2550)).toBe("S/ 25.50");
  });
  it("textoPrecio", () => {
    expect(textoPrecio({ precio_minimo_centimos: 0 })).toBe("Gratis");
    expect(textoPrecio({ precio_minimo_centimos: 4000 })).toBe("Desde S/ 40");
    expect(textoPrecio({ precio_minimo_centimos: null })).toBeNull();
  });
  it("fechaCorta en hora de Lima", () => {
    // 01:00 UTC del 17 = 8:00 p. m. del 16 en Lima.
    expect(fechaCorta("2026-10-17T01:00:00+00:00")).toBe("16 oct");
  });
});

describe("filas y héroe", () => {
  const destacado = evento({ destacado: true, inicio: "2026-10-16T20:00:00-05:00" });
  const teatro = evento({ categoria: "teatro", inicio: "2026-10-17T19:00:00-05:00" });
  const cine1 = evento({ categoria: "cine", inicio: "2026-10-31T18:30:00-05:00", distrito: "Castilla" });
  const cine2 = evento({ categoria: "cine", inicio: "2026-11-07T18:30:00-05:00" });
  const todos = [destacado, teatro, cine1, cine2];

  it("semana (7 días), próximos (todos) y una fila por categoría con 2 o más", () => {
    const filas = armarFilas(todos, AHORA);
    expect(filas.map((f) => [f.id, f.eventos.length, f.verTodos])).toEqual([
      ["semana", 2, "/?fecha=este-mes"],
      ["proximos", 4, undefined],
      ["cine", 2, "/?categoria=cine"],
    ]);
  });

  it("sin eventos esta semana, solo próximos", () => {
    expect(armarFilas([cine1, cine2], AHORA).map((f) => f.id)).toEqual(["proximos", "cine"]);
  });

  it("si todos son de esta semana, no repite la fila de próximos", () => {
    expect(armarFilas([destacado, teatro], AHORA).map((f) => f.id)).toEqual(["semana"]);
  });

  it("héroe: los destacados; si no hay, el primero", () => {
    expect(eventosHeroe(todos)).toEqual([destacado]);
    expect(eventosHeroe([teatro, cine1])).toEqual([teatro]);
    expect(eventosHeroe([])).toEqual([]);
  });

  it("distritos únicos en orden alfabético", () => {
    expect(distritosDe(todos)).toEqual(["Castilla", "Piura"]);
  });
});
