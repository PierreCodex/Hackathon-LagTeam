import { describe, expect, it } from "vitest";
import type { OrdenParaNegocio } from "../ventas/ventas.service.js";
import { armarVentasOrganizador, type EnlaceConClics, type EventoConCategorias } from "./ventas-organizador.js";

const EV_1 = "00000000-0000-4000-8000-000000000001";
const EV_2 = "00000000-0000-4000-8000-000000000002";
const AJENO = "00000000-0000-4000-8000-0000000000ff";
const PIEZA = "00000000-0000-4000-8000-0000000000a1";

const evento = (id: string, titulo: string): EventoConCategorias => ({
  id, organizador_id: "org", titulo, categoria: "musica", distrito: "Piura", inicio: "2026-10-20T01:00:00Z", aforo: 100,
  categorias: [{ id: `${id}-vip`, nombre: "VIP" }, { id: `${id}-gen`, nombre: "General" }],
});

let n = 0;
const orden = (evento_id: string, categoria_id: string, cantidad: number, total: number, ref: string | null = null): OrdenParaNegocio => ({
  id: `o${++n}`, usuario_id: "u", evento_id, categoria_id, ref, cantidad, total_centimos: total,
  comision_modelo: "porcentaje", comision_valor: 500, comision_importe: Math.round(total * 0.05), pagada_en: "2026-10-10T15:00:00Z",
});

const enlace = (codigo: string, clics: number, red: EnlaceConClics["red"]): EnlaceConClics => ({
  codigo, evento_id: EV_1, pieza_id: PIEZA, red, zona: null, creado_en: "2026-10-09T15:00:00Z", clics,
});

describe("armarVentasOrganizador", () => {
  const ventas = armarVentasOrganizador({
    eventos: [evento(EV_1, "Peña"), evento(EV_2, "Teatro")],
    ordenes: [
      orden(EV_1, `${EV_1}-vip`, 2, 8000, "Insta001"),
      orden(EV_1, `${EV_1}-gen`, 1, 2000, "Face0001"),
      orden(EV_1, `${EV_1}-gen`, 3, 6000),
      orden(EV_2, `${EV_2}-gen`, 1, 2000, "Otro0001"), // código que no es suyo: va a "sin enlace"
      orden(AJENO, "x", 5, 99999, "Insta001"), // evento ajeno: no cuenta
    ],
    asistencia: new Map([[EV_1, 4]]),
    enlaces: [enlace("Insta001", 30, "instagram"), enlace("Face0001", 12, "facebook")],
  });

  it("resume solo las ventas de sus eventos, con la comisión y el neto", () => {
    expect(ventas.resumen).toEqual({
      ordenes: 4, entradas: 7, importe_centimos: 18000, clics: 42, comision_centimos: 900, neto_centimos: 17100,
    });
  });

  it("asigna cada venta a la pieza por el código del enlace", () => {
    expect(ventas.piezas).toHaveLength(1);
    expect(ventas.piezas[0]).toMatchObject({ pieza_id: PIEZA, titulo_evento: "Peña", clics: 42, ordenes: 2, entradas: 3, importe_centimos: 10000 });
    expect(ventas.piezas[0]!.enlaces.map((e) => [e.red, e.entradas])).toEqual([["instagram", 2], ["facebook", 1]]);
    expect(ventas.sin_enlace).toEqual({ ordenes: 2, entradas: 4, importe_centimos: 8000 });
  });

  it("desglosa cada evento por categoría de precio, también los que no vendieron", () => {
    const pena = ventas.eventos.find((e) => e.evento_id === EV_1)!;
    expect(pena).toMatchObject({ entradas: 6, asistentes: 4, importe_centimos: 16000 });
    expect(pena.por_categoria).toEqual([
      { clave: "VIP", entradas: 2, importe_centimos: 8000 },
      { clave: "General", entradas: 4, importe_centimos: 8000 },
    ]);
    expect(ventas.eventos.find((e) => e.evento_id === EV_2)).toMatchObject({ entradas: 1, por_categoria: [{ clave: "General" }] });
  });
});
