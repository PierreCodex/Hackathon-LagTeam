import { describe, expect, it, vi } from "vitest";
import { consultarSalud, resumir } from "./salud";

function respuestaJson(cuerpo: unknown, status: number) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(cuerpo), { status }));
}

describe("salud en la web", () => {
  it("muestra API ok · BD ok con la hora de Postgres en Lima", async () => {
    const fetchFn = respuestaJson(
      { api: "ok", bd: "ok", hora_bd: "2026-10-10T21:00:00.000+00:00" },
      200,
    );

    const resumen = resumir(await consultarSalud("https://api.ejemplo/", fetchFn));

    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://api.ejemplo/api/v1/salud");
    expect(resumen).toMatchObject({ api: "ok", bd: "ok" });
    // 21:00 UTC son las 4:00 p. m. en Lima (UTC-5); es-PE usa reloj de 12 horas.
    expect(resumen.detalle).toMatch(/\b4:00:00\b/);
    expect(resumen.detalle).toContain("hora de Lima");
  });

  it("muestra API ok · BD error cuando la API responde 503", async () => {
    const fetchFn = respuestaJson(
      {
        api: "ok",
        bd: "error",
        error: { codigo: "BD_NO_DISPONIBLE", mensaje: "La base de datos respondió con un error" },
      },
      503,
    );

    const resumen = resumir(await consultarSalud("https://api.ejemplo", fetchFn));

    expect(resumen).toEqual({
      api: "ok",
      bd: "error",
      detalle: "La base de datos respondió con un error",
    });
  });

  it("muestra API error · BD ? cuando no se llega a la API", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });

    const resumen = resumir(await consultarSalud("https://api.ejemplo", fetchFn));

    expect(resumen).toMatchObject({ api: "error", bd: "?" });
  });

  it("muestra API error · BD ? cuando falta API_URL, sin llamar a la red", async () => {
    const fetchFn = vi.fn<typeof fetch>();

    const resumen = resumir(await consultarSalud(undefined, fetchFn));

    expect(resumen).toMatchObject({ api: "error", bd: "?" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("muestra API error · BD ? cuando la respuesta no cumple el contrato", async () => {
    const resumen = resumir(
      await consultarSalud("https://api.ejemplo", respuestaJson({ hola: 1 }, 500)),
    );

    expect(resumen).toMatchObject({ api: "error", bd: "?" });
  });

  it("informa respuesta inesperada, no falta de conexión, si el cuerpo no es JSON", async () => {
    const fetchFn = vi.fn<typeof fetch>(
      async () => new Response("<html>Bad Gateway</html>", { status: 502 }),
    );

    const resumen = resumir(await consultarSalud("https://api.ejemplo", fetchFn));

    expect(resumen).toEqual({
      api: "error",
      bd: "?",
      detalle: "Respuesta inesperada de la API (HTTP 502)",
    });
  });
});
