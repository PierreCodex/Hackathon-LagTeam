import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  CODIGO_RESPUESTA_INVALIDA,
  CODIGO_SIN_CONEXION,
  MENSAJE_RESPUESTA_INVALIDA,
  MENSAJE_SIN_CONEXION,
  pedirApi,
  urlApi,
} from "./api";

const EventoSchema = z.object({ id: z.string(), titulo: z.string() });
const API = "https://api.ejemplo";

function respuestaJson(cuerpo: unknown, status: number) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(cuerpo), { status }));
}

describe("pedirApi", () => {
  it("respuesta válida: 2xx que cumple el esquema devuelve { ok: true, datos }", async () => {
    const fetchFn = respuestaJson({ id: "e1", titulo: "La última función", extra: 1 }, 200);

    const resultado = await pedirApi("/eventos/e1", EventoSchema, { apiUrl: `${API}/`, fetchFn });

    expect(resultado).toEqual({ ok: true, datos: { id: "e1", titulo: "La última función" } });
    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://api.ejemplo/api/v1/eventos/e1");
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it("error de la API: 4xx/5xx con { error: { codigo, mensaje } } lo devuelve tal cual", async () => {
    const fetchFn = respuestaJson(
      {
        error: {
          codigo: "BUTACA_OCUPADA",
          mensaje: "Esa butaca la acaba de elegir otra persona. Elige otra.",
        },
      },
      409,
    );

    const resultado = await pedirApi("eventos", EventoSchema, { apiUrl: API, fetchFn });

    expect(resultado).toEqual({
      ok: false,
      error: {
        codigo: "BUTACA_OCUPADA",
        mensaje: "Esa butaca la acaba de elegir otra persona. Elige otra.",
      },
    });
  });

  describe("respuesta fuera de contrato → RESPUESTA_INVALIDA con mensaje amable", () => {
    const invalida = {
      ok: false,
      error: { codigo: CODIGO_RESPUESTA_INVALIDA, mensaje: MENSAJE_RESPUESTA_INVALIDA },
    };

    it("2xx que no cumple el esquema", async () => {
      const resultado = await pedirApi("eventos", EventoSchema, {
        apiUrl: API,
        fetchFn: respuestaJson({ hola: 1 }, 200),
      });
      expect(resultado).toEqual(invalida);
    });

    it("cuerpo que no es JSON", async () => {
      const fetchFn = vi.fn<typeof fetch>(
        async () => new Response("<html>Bad Gateway</html>", { status: 502 }),
      );
      const resultado = await pedirApi("eventos", EventoSchema, { apiUrl: API, fetchFn });
      expect(resultado).toEqual(invalida);
    });

    it("4xx sin el formato de error común", async () => {
      const resultado = await pedirApi("eventos", EventoSchema, {
        apiUrl: API,
        fetchFn: respuestaJson({ message: "Not Found" }, 404),
      });
      expect(resultado).toEqual(invalida);
    });
  });

  describe("API inalcanzable → SIN_CONEXION", () => {
    const sinConexion = {
      ok: false,
      error: { codigo: CODIGO_SIN_CONEXION, mensaje: MENSAJE_SIN_CONEXION },
    };

    it("fallo de red", async () => {
      const fetchFn = vi.fn<typeof fetch>(async () => {
        throw new TypeError("fetch failed");
      });
      expect(await pedirApi("eventos", EventoSchema, { apiUrl: API, fetchFn })).toEqual(sinConexion);
    });

    it("tiempo límite", async () => {
      // fetch simulado que solo responde al abortar, como el real.
      const fetchFn = vi.fn<typeof fetch>(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      );
      const resultado = await pedirApi("eventos", EventoSchema, {
        apiUrl: API,
        fetchFn,
        tiempoLimiteMs: 10,
      });
      expect(resultado).toEqual(sinConexion);
    });

    it("falta API_URL, sin llamar a la red", async () => {
      const fetchFn = vi.fn<typeof fetch>();
      const anterior = process.env.API_URL;
      delete process.env.API_URL;
      try {
        expect(await pedirApi("eventos", EventoSchema, { fetchFn })).toEqual(sinConexion);
      } finally {
        if (anterior !== undefined) process.env.API_URL = anterior;
      }
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  it("2xx con cuerpo vacío (201 sin contenido) se valida como undefined", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(null, { status: 201 }));

    const resultado = await pedirApi("eventos/e1/destacar", z.undefined(), { apiUrl: API, fetchFn });

    expect(resultado).toEqual({ ok: true, datos: undefined });
  });

  it("envía el cuerpo como JSON con POST", async () => {
    const fetchFn = respuestaJson({ id: "e2", titulo: "Nuevo" }, 201);

    await pedirApi("eventos", EventoSchema, { apiUrl: API, fetchFn, cuerpo: { titulo: "Nuevo" } });

    const init = fetchFn.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ titulo: "Nuevo" }));
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
  });
});

describe("urlApi", () => {
  it("une la base y la ruta sin barras dobles", () => {
    expect(urlApi("https://api.ejemplo//", "/eventos")).toBe("https://api.ejemplo/api/v1/eventos");
    expect(urlApi("https://api.ejemplo", "eventos?x=1")).toBe(
      "https://api.ejemplo/api/v1/eventos?x=1",
    );
  });
});
