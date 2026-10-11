import { describe, expect, it } from "vitest";
import type { EventoParaNegocio } from "../eventos/eventos.service.js";
import type { OrdenParaNegocio } from "../ventas/ventas.service.js";
import { armarTablero, comisionPorEvento, diaDeLima } from "./calculos.js";

const ORG_A = "00000000-0000-4000-8000-00000000000a";
const ORG_B = "00000000-0000-4000-8000-00000000000b";
const EV_1 = "00000000-0000-4000-8000-000000000001";
const EV_2 = "00000000-0000-4000-8000-000000000002";
const EV_3 = "00000000-0000-4000-8000-000000000003";

function evento(id: string, organizador_id: string, categoria: EventoParaNegocio["categoria"], distrito: string): EventoParaNegocio {
  return { id, organizador_id, titulo: `Evento ${id.slice(-1)}`, categoria, distrito, inicio: "2026-10-16T01:00:00Z", aforo: 100 };
}

let n = 0;
function orden(evento_id: string, usuario_id: string, cantidad: number, total: number, extra: Partial<OrdenParaNegocio> = {}): OrdenParaNegocio {
  n += 1;
  return {
    id: `orden-${n}`, usuario_id, evento_id, cantidad, total_centimos: total,
    comision_modelo: "porcentaje", comision_valor: 500, comision_importe: Math.round(total * 0.05),
    pagada_en: `2026-10-0${(n % 3) + 1}T15:00:00Z`, ...extra,
  };
}

describe("comisionPorEvento", () => {
  it("suma la comisión congelada y descuenta la tarifa por evento una sola vez", () => {
    const tarifa = { comision_modelo: "tarifa_evento" as const, comision_valor: 5000, comision_importe: 0 };
    const comision = comisionPorEvento([
      orden(EV_1, "u1", 2, 4000, tarifa),
      orden(EV_1, "u2", 1, 2000, tarifa),
      orden(EV_2, "u1", 1, 2000),
    ]);
    expect(comision.get(EV_1)).toBe(5000);
    expect(comision.get(EV_2)).toBe(100);
  });

  it("si la comisión cambió después, cada orden conserva la suya", () => {
    const comision = comisionPorEvento([
      orden(EV_1, "u1", 1, 10000), // 5 % congelado = 500
      orden(EV_1, "u2", 2, 20000, { comision_modelo: "fijo_por_entrada", comision_valor: 300, comision_importe: 600 }),
    ]);
    expect(comision.get(EV_1)).toBe(1100);
  });
});

describe("armarTablero", () => {
  const tablero = armarTablero({
    comision: { modelo: "porcentaje", valor: 500 },
    ordenes: [
      orden(EV_1, "u1", 2, 4000),
      orden(EV_2, "u2", 3, 6000),
      orden(EV_3, "u1", 1, 1000),
      orden("00000000-0000-4000-8000-0000000000ff", "u3", 1, 9999), // evento borrado: no cuenta
    ],
    eventos: [evento(EV_1, ORG_A, "musica", "Piura"), evento(EV_2, ORG_A, "teatro", "Piura"), evento(EV_3, ORG_B, "musica", "Castilla")],
    asistencia: new Map([[EV_1, 2], [EV_2, 1]]),
    ciudades: new Map([["u1", "Sullana"], ["u2", null]]),
    correos: new Map([[ORG_A, "a@example.invalid"]]),
  });

  it("resume ventas, comisión, entradas, asistentes y compradores", () => {
    expect(tablero.resumen).toEqual({
      ventas_centimos: 11000, comision_centimos: 550, entradas: 6, asistentes: 3, compradores: 2, eventos: 3,
    });
  });

  it("liquida a cada organizador: bruto menos comisión", () => {
    expect(tablero.liquidacion).toEqual([
      { organizador_id: ORG_A, correo: "a@example.invalid", eventos: 2, entradas: 5, bruto_centimos: 10000, comision_centimos: 500, neto_centimos: 9500 },
      { organizador_id: ORG_B, correo: "", eventos: 1, entradas: 1, bruto_centimos: 1000, comision_centimos: 50, neto_centimos: 950 },
    ]);
  });

  it("agrupa por categoría, distrito y ciudad del público", () => {
    expect(tablero.por_categoria).toEqual([
      { clave: "teatro", entradas: 3, importe_centimos: 6000 },
      { clave: "musica", entradas: 3, importe_centimos: 5000 },
    ]);
    expect(tablero.por_distrito.map((f) => f.clave)).toEqual(["Piura", "Castilla"]);
    expect(tablero.publico_por_ciudad).toEqual([
      { ciudad: "Sullana", compradores: 1 },
      { ciudad: "Sin indicar", compradores: 1 },
    ]);
  });
});

describe("diaDeLima", () => {
  it("usa la hora de Lima (UTC−5)", () => {
    expect(diaDeLima("2026-10-11T03:00:00Z")).toBe("2026-10-10");
    expect(diaDeLima("2026-10-11T06:00:00Z")).toBe("2026-10-11");
  });
});
