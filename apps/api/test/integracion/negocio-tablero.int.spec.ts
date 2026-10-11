import type { INestApplication } from "@nestjs/common";
import { ComisionSchema, TableroSchema } from "@reto18/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearAppDePrueba } from "./ayudas/app.js";
import { api } from "./ayudas/http.js";
import { tokenPorRol, type UsuarioDePrueba } from "./ayudas/tokens.js";

/** Evento ya pasado de `seed-tablero.sql`, con ventas y asistencia. */
const FESTIVAL_MARINERA = "13600000-0000-4000-8000-000000000009";
const SEGUNDO_ORGANIZADOR = "13000000-0000-4000-8000-000000000002";

describe("tablero, comisión y Excel del administrador contra la BD de prueba", () => {
  let app: INestApplication;
  let admin: UsuarioDePrueba;
  let publico: UsuarioDePrueba;

  beforeAll(async () => {
    app = await crearAppDePrueba();
    [admin, publico] = await Promise.all([tokenPorRol("admin"), tokenPorRol("publico")]);
  });

  afterAll(async () => {
    // Deja la comisión de la semilla (5 %) para el resto de pruebas y la demo.
    if (admin) await api(app, admin.token).put("/api/v1/negocio/comision").send({ modelo: "porcentaje", valor: 500 });
    await app?.close();
  });

  it("solo el administrador ve el tablero", async () => {
    expect((await api(app).get("/api/v1/negocio/tablero")).status).toBe(401);
    expect((await api(app, publico.token).get("/api/v1/negocio/tablero")).status).toBe(403);
  });

  it("resume las ventas sembradas con asistencia y la liquidación del organizador", async () => {
    const respuesta = await api(app, admin.token).get("/api/v1/negocio/tablero");
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);
    const tablero = TableroSchema.parse(respuesta.body);
    const festival = tablero.eventos.find((e) => e.evento_id === FESTIVAL_MARINERA);
    expect(festival?.entradas).toBeGreaterThan(0);
    expect(festival?.asistentes).toBeGreaterThan(0);
    const liquidacion = tablero.liquidacion.find((l) => l.organizador_id === SEGUNDO_ORGANIZADOR);
    expect(liquidacion?.correo).toBe("colectivo.marinera@example.invalid");
    expect(liquidacion!.neto_centimos).toBe(liquidacion!.bruto_centimos - liquidacion!.comision_centimos);
    expect(tablero.publico_por_ciudad.length).toBeGreaterThan(1);
  });

  it("cambia la comisión vigente sin tocar la de las ventas ya pagadas", async () => {
    const antes = TableroSchema.parse((await api(app, admin.token).get("/api/v1/negocio/tablero")).body);
    const cambio = await api(app, admin.token).put("/api/v1/negocio/comision").send({ modelo: "fijo_por_entrada", valor: 200 });
    expect(cambio.status, JSON.stringify(cambio.body)).toBe(200);
    expect(ComisionSchema.parse(cambio.body)).toEqual({ modelo: "fijo_por_entrada", valor: 200 });
    const despues = TableroSchema.parse((await api(app, admin.token).get("/api/v1/negocio/tablero")).body);
    expect(despues.comision).toEqual({ modelo: "fijo_por_entrada", valor: 200 });
    expect(despues.resumen.comision_centimos).toBe(antes.resumen.comision_centimos);
  });

  it("rechaza un porcentaje de más de 100 %", async () => {
    const respuesta = await api(app, admin.token).put("/api/v1/negocio/comision").send({ modelo: "porcentaje", valor: 20_000 });
    expect(respuesta.status).toBe(400);
  });

  it("descarga el tablero en Excel", async () => {
    const respuesta = await api(app, admin.token)
      .get("/api/v1/negocio/tablero/excel")
      .buffer(true)
      .parse((res, fin) => {
        const partes: Buffer[] = [];
        res.on("data", (p: Buffer) => partes.push(p));
        res.on("end", () => fin(null, Buffer.concat(partes)));
      });
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers["content-type"]).toContain("spreadsheetml");
    expect((respuesta.body as Buffer).subarray(0, 2).toString()).toBe("PK"); // un .xlsx es un zip
  });
});
