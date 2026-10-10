import type { INestApplication } from "@nestjs/common";
import { SaludRespuestaSchema } from "@reto18/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api } from "./ayudas/http.js";
import { crearAppDePrueba } from "./ayudas/app.js";
import { entornoDePrueba } from "./ayudas/supabase.js";
import { EntornoDePruebaInvalido, prepararEntornoDePrueba } from "./entorno.js";

describe("GET /api/v1/salud contra la BD de prueba", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearAppDePrueba();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("responde 200 con bd ok y la hora de Postgres", async () => {
    const respuesta = await api(app).get("/api/v1/salud");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ api: "ok", bd: "ok" });
    expect(SaludRespuestaSchema.safeParse(respuesta.body).success).toBe(true);
  });
});

describe("protección del ejecutor (globalSetup)", () => {
  const statusLocal = () => {
    const { url, claveServicio, clavePublica } = entornoDePrueba();
    return `API_URL="${url}"\nSERVICE_ROLE_KEY="${claveServicio}"\nANON_KEY="${clavePublica}"\n`;
  };

  it("acepta la BD local que está levantada", async () => {
    await expect(prepararEntornoDePrueba({ leerStatus: statusLocal, hacerFetch: fetch })).resolves
      .toEqual(entornoDePrueba());
  });

  it("si la BD de prueba no está levantada, falla diciendo cómo levantarla", async () => {
    const hacerFetch = vi.fn<typeof fetch>();
    const leerStatus = () => {
      throw new Error("supabase start is not running");
    };

    const intento = prepararEntornoDePrueba({ leerStatus, hacerFetch });

    await expect(intento).rejects.toBeInstanceOf(EntornoDePruebaInvalido);
    await expect(intento).rejects.toThrow("pnpm db:start");
    expect(hacerFetch).not.toHaveBeenCalled();
  });

  it("si la BD local no responde, falla diciendo cómo levantarla", async () => {
    const hacerFetch = vi.fn<typeof fetch>(() => Promise.reject(new Error("ECONNREFUSED")));

    await expect(prepararEntornoDePrueba({ leerStatus: statusLocal, hacerFetch })).rejects.toThrow(
      "pnpm db:start",
    );
  });

  it("se niega a ejecutar contra una BD que no es local, sin llamarla", async () => {
    const hacerFetch = vi.fn<typeof fetch>();
    const leerStatus = () =>
      'API_URL="https://abcdefgh.supabase.co"\nSERVICE_ROLE_KEY="x"\nANON_KEY="y"\n';

    const intento = prepararEntornoDePrueba({ leerStatus, hacerFetch });

    await expect(intento).rejects.toBeInstanceOf(EntornoDePruebaInvalido);
    await expect(intento).rejects.toThrow("debe ser local");
    expect(hacerFetch).not.toHaveBeenCalled();
  });
});
