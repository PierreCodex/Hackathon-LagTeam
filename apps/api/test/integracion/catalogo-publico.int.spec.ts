import type { INestApplication } from "@nestjs/common";
import { EventoPublicoSchema, ListaEventosPublicosSchema } from "@reto18/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearAppDePrueba } from "./ayudas/app.js";
import { api } from "./ayudas/http.js";

const RUTA = "/api/v1/eventos";

describe("catálogo público contra la semilla", () => {
  let app: INestApplication;

  beforeAll(async () => { app = await crearAppDePrueba(); });
  afterAll(async () => { await app.close(); });

  it("solo devuelve aprobados publicados y prioriza el destacado", async () => {
    const respuesta = await api(app).get(RUTA);
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);
    const eventos = ListaEventosPublicosSchema.parse(respuesta.body);
    expect(eventos).toHaveLength(6);
    expect(eventos[0]?.destacado).toBe(true);
    expect(eventos.every((e) => !e.titulo.includes("pendiente") && !e.titulo.includes("corregir"))).toBe(true);
    expect(eventos.every((e) => !Object.hasOwn(e, "organizador_id"))).toBe(true);
  });

  it("combina búsqueda, fecha, categoría, distrito y precio", async () => {
    const respuesta = await api(app).get(`${RUTA}?q=Piura&desde=2026-10-01&hasta=2026-10-31&categoria=cine&distrito=Piura&precio_maximo_centimos=2000`);
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);
    const eventos = ListaEventosPublicosSchema.parse(respuesta.body);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ categoria: "cine", distrito: "Piura" });
  });

  it("devuelve el mes, la ficha pública y oculta un id no publicado", async () => {
    const octubre = await api(app).get(`${RUTA}/calendario?mes=2026-10`);
    expect(octubre.status).toBe(200);
    expect(ListaEventosPublicosSchema.parse(octubre.body)).toHaveLength(5);
    const ficha = await api(app).get(`${RUTA}/13600000-0000-4000-8000-000000000001`);
    expect(ficha.status).toBe(200);
    EventoPublicoSchema.parse(ficha.body);
    const oculto = await api(app).get(`${RUTA}/13600000-0000-4000-8000-000000000007`);
    expect(oculto.status).toBe(404);
  });

  it("valida el mes y los rangos", async () => {
    expect((await api(app).get(`${RUTA}/calendario?mes=2026-13`)).status).toBe(400);
    expect((await api(app).get(`${RUTA}?desde=2026-11-01&hasta=2026-10-01`)).status).toBe(400);
  });
});
