import { CODIGOS_EVENTOS, type CategoriaPrecio, type ErrorApi, type PrecioAsiento, type RangoPrecioEntrada } from "@reto18/shared";
import { describe, expect, it } from "vitest";
import {
  agregarRango,
  aRangoEntrada,
  COLOR_SIN_CATEGORIA,
  colorDeCategoria,
  estadoDeErrorGuardadoPrecios,
  pintarAsientos,
  resolverCategoriaDeAsiento,
  SELECCION_NINGUNA,
  seleccionarAsiento,
  type SeleccionRango,
} from "./pizarra-precios";

const VIP = "11111111-1111-4111-8111-111111111111";
const GENERAL = "22222222-2222-4222-8222-222222222222";

const CATEGORIAS: CategoriaPrecio[] = [
  { id: VIP, evento_id: "e", sede_id: "s", nombre: "VIP", color: "#D97706", precio_centimos: 5000, seccion_id: null },
  { id: GENERAL, evento_id: "e", sede_id: "s", nombre: "General", color: "#2563EB", precio_centimos: 2000, seccion_id: null },
];

const ASIENTO = (fila: string, numero: number, categoria_id: string | null): PrecioAsiento => ({
  asiento_id: `${fila}-${numero}`, seccion: "Platea baja", fila, numero, categoria_id,
});

describe("seleccionarAsiento (selección a dos clics)", () => {
  it("el primer clic abre la selección", () => {
    expect(seleccionarAsiento(SELECCION_NINGUNA, "Platea baja", "A", 1)).toEqual({
      tipo: "primero", seccion: "Platea baja", fila: "A", numero: 1,
    });
  });

  it("el segundo clic en la misma fila cierra el rango, con el menor número primero", () => {
    const primero: SeleccionRango = { tipo: "primero", seccion: "Platea baja", fila: "A", numero: 1 };
    expect(seleccionarAsiento(primero, "Platea baja", "A", 6)).toEqual({
      tipo: "rango", seccion: "Platea baja", fila: "A", desde: 1, hasta: 6,
    });
  });

  it("el segundo clic puede llegar en cualquier orden (hasta antes que desde)", () => {
    const primero: SeleccionRango = { tipo: "primero", seccion: "Platea baja", fila: "A", numero: 6 };
    expect(seleccionarAsiento(primero, "Platea baja", "A", 1)).toEqual({
      tipo: "rango", seccion: "Platea baja", fila: "A", desde: 1, hasta: 6,
    });
  });

  it("cruzar de fila reinicia la selección al asiento nuevo, sin cerrar un rango a medias", () => {
    const primero: SeleccionRango = { tipo: "primero", seccion: "Platea baja", fila: "A", numero: 1 };
    expect(seleccionarAsiento(primero, "Platea baja", "B", 3)).toEqual({
      tipo: "primero", seccion: "Platea baja", fila: "B", numero: 3,
    });
  });

  it("cruzar de sección (misma fila) también reinicia la selección", () => {
    const primero: SeleccionRango = { tipo: "primero", seccion: "Platea baja", fila: "A", numero: 1 };
    expect(seleccionarAsiento(primero, "Platea media", "A", 1)).toEqual({
      tipo: "primero", seccion: "Platea media", fila: "A", numero: 1,
    });
  });

  it("clic tras un rango ya cerrado empieza una selección nueva", () => {
    const rango: SeleccionRango = { tipo: "rango", seccion: "Platea baja", fila: "A", desde: 1, hasta: 6 };
    expect(seleccionarAsiento(rango, "Platea baja", "A", 10)).toEqual({
      tipo: "primero", seccion: "Platea baja", fila: "A", numero: 10,
    });
  });
});

describe("resolverCategoriaDeAsiento / colorDeCategoria", () => {
  const asientos = [ASIENTO("A", 1, VIP), ASIENTO("A", 2, null)];

  it("da la categoría del asiento cubierto por un rango", () => {
    expect(resolverCategoriaDeAsiento(asientos, "Platea baja", "A", 1)).toBe(VIP);
  });

  it("da null si el asiento no tiene categoría, o no está en la lista", () => {
    expect(resolverCategoriaDeAsiento(asientos, "Platea baja", "A", 2)).toBeNull();
    expect(resolverCategoriaDeAsiento(asientos, "Platea baja", "A", 99)).toBeNull();
  });

  it("colorDeCategoria mapea el id al color real de la categoría", () => {
    expect(colorDeCategoria(VIP, CATEGORIAS)).toBe("#D97706");
    expect(colorDeCategoria(GENERAL, CATEGORIAS)).toBe("#2563EB");
  });

  it("colorDeCategoria da el gris neutro sin categoría, o sin categorías (evento recién creado)", () => {
    expect(colorDeCategoria(null, CATEGORIAS)).toBe(COLOR_SIN_CATEGORIA);
    expect(colorDeCategoria(VIP, [])).toBe(COLOR_SIN_CATEGORIA);
  });
});

describe("aRangoEntrada", () => {
  it("convierte un rango cerrado y la categoría elegida al cuerpo de PUT .../precios", () => {
    const rango: SeleccionRango = { tipo: "rango", seccion: "Platea baja", fila: "A", desde: 1, hasta: 6 };
    expect(aRangoEntrada(rango, VIP)).toEqual({ categoria_id: VIP, seccion: "Platea baja", fila: "A", desde: 1, hasta: 6 });
  });

  it("da null si la selección no está cerrada (ninguna o solo el primer clic)", () => {
    expect(aRangoEntrada(SELECCION_NINGUNA, VIP)).toBeNull();
    expect(aRangoEntrada({ tipo: "primero", seccion: "Platea baja", fila: "A", numero: 1 }, VIP)).toBeNull();
  });
});

describe("agregarRango", () => {
  const rango = (seccion: string, fila: string, desde: number, hasta: number, categoria_id: string): RangoPrecioEntrada => ({
    categoria_id, seccion, fila, desde, hasta,
  });

  it("agrega un rango sin tocar los de otras filas", () => {
    const anteriores = [rango("Platea baja", "B", 1, 10, GENERAL)];
    const nuevo = rango("Platea baja", "A", 1, 6, VIP);
    expect(agregarRango(anteriores, nuevo)).toEqual([...anteriores, nuevo]);
  });

  it("repintar exactamente el mismo rango lo reemplaza del todo (misma desde/hasta)", () => {
    const anteriores = [rango("Platea baja", "A", 1, 6, GENERAL)];
    const nuevo = rango("Platea baja", "A", 1, 6, VIP);
    expect(agregarRango(anteriores, nuevo)).toEqual([nuevo]);
  });

  it("un rango nuevo que cruza el borde recorta el anterior por ese lado", () => {
    const anteriores = [rango("Platea baja", "A", 1, 10, GENERAL)];
    const nuevo = rango("Platea baja", "A", 6, 15, VIP);
    expect(agregarRango(anteriores, nuevo)).toEqual([rango("Platea baja", "A", 1, 5, GENERAL), nuevo]);
  });

  it("un rango nuevo en medio de uno anterior lo parte en dos", () => {
    const anteriores = [rango("Platea baja", "A", 1, 20, GENERAL)];
    const nuevo = rango("Platea baja", "A", 8, 12, VIP);
    expect(agregarRango(anteriores, nuevo)).toEqual([
      rango("Platea baja", "A", 1, 7, GENERAL),
      rango("Platea baja", "A", 13, 20, GENERAL),
      nuevo,
    ]);
  });
});

describe("pintarAsientos", () => {
  it("cambia la categoría de los asientos de la sección/fila dentro del rango, y deja el resto igual", () => {
    const asientos = [ASIENTO("A", 1, null), ASIENTO("A", 2, null), ASIENTO("A", 3, GENERAL), { ...ASIENTO("B", 1, null) }];
    const pintados = pintarAsientos(asientos, { categoria_id: VIP, seccion: "Platea baja", fila: "A", desde: 1, hasta: 2 });

    expect(pintados.map((a) => a.categoria_id)).toEqual([VIP, VIP, GENERAL, null]);
  });
});

describe("estadoDeErrorGuardadoPrecios (matriz I/O)", () => {
  it("EVENTO_PUBLICADO pasa a solo lectura", () => {
    const error: ErrorApi = { codigo: CODIGOS_EVENTOS.EVENTO_PUBLICADO, mensaje: "x" };
    expect(estadoDeErrorGuardadoPrecios(error)).toEqual({ tipo: "soloLectura" });
  });

  it("sin conexión ofrece reintentar", () => {
    expect(estadoDeErrorGuardadoPrecios({ codigo: "SIN_CONEXION", mensaje: "x" })).toEqual({ tipo: "reintentar" });
  });

  it("RANGO_FUERA_DEL_MAPA, CATEGORIA_NO_VALIDA o cualquier otro código dan el aviso genérico", () => {
    expect(estadoDeErrorGuardadoPrecios({ codigo: CODIGOS_EVENTOS.RANGO_FUERA_DEL_MAPA, mensaje: "x" })).toEqual({ tipo: "generico" });
    expect(estadoDeErrorGuardadoPrecios({ codigo: CODIGOS_EVENTOS.CATEGORIA_NO_VALIDA, mensaje: "x" })).toEqual({ tipo: "generico" });
    expect(estadoDeErrorGuardadoPrecios({ codigo: CODIGOS_EVENTOS.BD_NO_DISPONIBLE, mensaje: "x" })).toEqual({ tipo: "generico" });
  });
});
