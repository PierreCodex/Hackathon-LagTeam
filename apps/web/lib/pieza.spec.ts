import { describe, expect, it } from "vitest";
import {
  esFormatoPieza,
  fechaCalendario,
  fechaPieza,
  nombreRed,
  rutaMarketingEvento,
  textoPrecio,
  urlPng,
} from "./pieza";

describe("textoPrecio", () => {
  it.each([
    [2500, "Desde S/ 25"],
    [4000, "Desde S/ 40"],
    [2550, "Desde S/ 25.50"],
    [0, "Entrada libre"],
    [null, null],
  ])("%s → %s", (centimos, esperado) => {
    expect(textoPrecio(centimos)).toBe(esperado);
  });
});

describe("fechaPieza", () => {
  it("muestra el inicio en hora de Lima", () => {
    expect(fechaPieza("2026-10-16T20:00:00-05:00")).toBe("Vie 16 oct · 8:00 p. m.");
  });

  it("convierte desde UTC a Lima, aunque cambie el día", () => {
    expect(fechaPieza("2026-10-17T01:00:00Z")).toBe("Vie 16 oct · 8:00 p. m.");
  });

  it("mañana y mediodía", () => {
    expect(fechaPieza("2026-09-05T09:05:00-05:00")).toBe("Sáb 5 sept · 9:05 a. m.");
    expect(fechaPieza("2026-12-01T12:00:00-05:00")).toBe("Mar 1 dic · 12:00 p. m.");
    expect(fechaPieza("2026-12-01T00:30:00-05:00")).toBe("Mar 1 dic · 12:30 a. m.");
  });

  it("devuelve el texto si no es una fecha", () => {
    expect(fechaPieza("mañana")).toBe("mañana");
  });
});

describe("fechaCalendario", () => {
  it("fecha y hora de Lima del calendario", () => {
    expect(fechaCalendario("2026-10-14", "19:00")).toBe("Mié 14 oct · 7:00 p. m.");
    expect(fechaCalendario("2026-10-16", "08:30")).toBe("Vie 16 oct · 8:30 a. m.");
  });

  it("devuelve los datos tal cual si no se entienden", () => {
    expect(fechaCalendario("x", "19:00")).toBe("x · 19:00");
  });
});

describe("nombreRed, urlPng y rutas", () => {
  it("nombres de las redes", () => {
    expect(nombreRed("instagram")).toBe("Instagram");
    expect(nombreRed("whatsapp")).toBe("WhatsApp");
    expect(nombreRed("tiktok")).toBe("TikTok");
    expect(nombreRed("x")).toBe("X");
  });

  it("ruta del PNG 4:5", () => {
    expect(urlPng("abc", "4x5")).toBe("/piezas/abc/4x5");
  });

  it("solo existe el formato 4x5", () => {
    expect(esFormatoPieza("4x5")).toBe(true);
    expect(esFormatoPieza("9x16")).toBe(false);
  });

  it("ruta de Marketing del evento", () => {
    expect(rutaMarketingEvento("e1")).toBe("/organizador/eventos/e1/marketing");
    expect(rutaMarketingEvento("e1", "p1")).toBe("/organizador/eventos/e1/marketing?pieza=p1");
  });
});
