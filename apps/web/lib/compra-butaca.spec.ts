import { CODIGOS_VENTAS, type ErrorApi } from "@reto18/shared";
import { describe, expect, it } from "vitest";
import {
  COLOR_DISPONIBLE,
  COLOR_SELECCIONADA,
  COLOR_VENDIDA,
  colorDeButaca,
  estadoDeErrorCompraButaca,
} from "./compra-butaca";

describe("colorDeButaca", () => {
  it("una butaca disponible sin seleccionar es verde", () => {
    expect(colorDeButaca("disponible", false)).toBe(COLOR_DISPONIBLE);
  });

  it("una butaca disponible seleccionada es blanca", () => {
    expect(colorDeButaca("disponible", true)).toBe(COLOR_SELECCIONADA);
  });

  it("una butaca vendida siempre es gris oscuro, aunque llegue 'seleccionada'", () => {
    expect(colorDeButaca("vendida", false)).toBe(COLOR_VENDIDA);
    expect(colorDeButaca("vendida", true)).toBe(COLOR_VENDIDA);
  });
});

describe("estadoDeErrorCompraButaca (matriz I/O)", () => {
  it.each([CODIGOS_VENTAS.BUTACA_NO_DISPONIBLE, CODIGOS_VENTAS.ASIENTO_NO_EXISTE, CODIGOS_VENTAS.VENTA_CERRADA])(
    "%s manda a revisar el mapa (alguien se adelantó o la venta cerró)",
    (codigo) => {
      const error: ErrorApi = { codigo, mensaje: "x" };
      expect(estadoDeErrorCompraButaca(error)).toEqual({ tipo: "revisar_mapa" });
    },
  );

  it("sin conexión ofrece reintentar", () => {
    expect(estadoDeErrorCompraButaca({ codigo: "SIN_CONEXION", mensaje: "x" })).toEqual({ tipo: "reintentar" });
  });

  it("cualquier otro código da el aviso genérico", () => {
    expect(estadoDeErrorCompraButaca({ codigo: CODIGOS_VENTAS.ORDEN_EXPIRADA, mensaje: "x" })).toEqual({ tipo: "generico" });
    expect(estadoDeErrorCompraButaca({ codigo: CODIGOS_VENTAS.PAGO_RECHAZADO, mensaje: "x" })).toEqual({ tipo: "generico" });
    expect(estadoDeErrorCompraButaca({ codigo: CODIGOS_VENTAS.BD_NO_DISPONIBLE, mensaje: "x" })).toEqual({ tipo: "generico" });
  });
});
