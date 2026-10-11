import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import {
  ClicRegistradoSchema,
  EnlaceSchema,
  EventoCreadoSchema,
  type Enlace,
  OrdenSchema,
  PiezaSchema,
  ResultadosPiezaSchema,
  VentasOrganizadorSchema,
} from "@reto18/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUCKET_FOTOS } from "../../src/eventos/archivos-eventos.js";
import { crearAppDePrueba } from "./ayudas/app.js";
import { api } from "./ayudas/http.js";
import { clienteAdminDePrueba, clientePublicoDePrueba, entornoDePrueba } from "./ayudas/supabase.js";
import { tokenPorRol, type UsuarioDePrueba } from "./ayudas/tokens.js";

const QR_SECRET = `secreto-de-prueba-${randomUUID()}`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const PRECIO = 4000;

describe("marketing: enlaces rastreables y ventas por pieza (3.2)", () => {
  let app: INestApplication;
  let organizador: UsuarioDePrueba;
  let otroOrganizador: UsuarioDePrueba;
  let comprador: UsuarioDePrueba;
  let admin: UsuarioDePrueba;
  const ollamaOriginal = process.env.OLLAMA_URL;
  const ordenes: string[] = [];
  let evento: { id: string; categoriaId: string };
  let piezaId: string;

  beforeAll(async () => {
    process.env.QR_SECRET = QR_SECRET; // Se lee al construir la app.
    delete process.env.OLLAMA_URL; // La pieza sale del respaldo, sin esperar a la IA.
    app = await crearAppDePrueba();
    [organizador, otroOrganizador, comprador, admin] = await Promise.all([
      tokenPorRol("organizador"), tokenPorRol("organizador"), tokenPorRol("publico"), tokenPorRol("admin"),
    ]);
    evento = await eventoALaVenta();
    piezaId = await generarPieza(evento.id);
  });

  // Antes que `limpieza.ts`: eventos, enlaces, órdenes y sedes referencian a los usuarios de prueba.
  afterAll(async () => {
    await app?.close();
    delete process.env.QR_SECRET;
    if (ollamaOriginal === undefined) delete process.env.OLLAMA_URL;
    else process.env.OLLAMA_URL = ollamaOriginal;
    const bd = clienteAdminDePrueba();
    if (ordenes.length) {
      expect((await bd.from("notificaciones_bandeja").delete().in("datos->>orden_id", ordenes)).error).toBeNull();
    }
    const organizadores = [organizador, otroOrganizador].filter(Boolean).map((u) => u.id);
    // Borrar los eventos arrastra piezas, enlaces, clics, cupos, órdenes y entradas (on delete cascade).
    expect((await bd.from("eventos_eventos").delete().in("organizador_id", organizadores)).error).toBeNull();
    expect((await bd.from("eventos_sedes").delete().in("creado_por", organizadores)).error).toBeNull();
    for (const id of organizadores) {
      const { data } = await bd.storage.from(BUCKET_FOTOS).list(id);
      const rutas = (data ?? []).map((f) => `${id}/${f.name}`);
      if (rutas.length) expect((await bd.storage.from(BUCKET_FOTOS).remove(rutas)).error).toBeNull();
    }
  });

  /** Alta (sede nueva de zona general) → aprobar (admin) → publicar (organizador). */
  async function eventoALaVenta(dueno: UsuarioDePrueba = organizador) {
    const alta = await api(app, dueno.token).post("/api/v1/eventos").field("datos", JSON.stringify({
      titulo: "Peña de enlaces", categoria: "musica", descripcion: "Evento de prueba de los enlaces rastreables.",
      inicio: "2030-11-20T20:00:00-05:00", aforo: 10, hay_musica: false,
      sede: { tipo: "nueva", nombre: `Patio ${randomUUID().slice(0, 8)}`, direccion: "Jr. Enlace 1", distrito: "Piura", capacidad: 10 },
      categorias: [{ nombre: "General", precio_centimos: PRECIO }],
    })).attach("foto", PNG, "foto.png");
    expect(alta.status, JSON.stringify(alta.body)).toBe(201);
    const creado = EventoCreadoSchema.parse(alta.body);
    expect((await api(app, admin.token).patch(`/api/v1/eventos/${creado.evento.id}/aprobar`)).status).toBe(200);
    expect((await api(app, dueno.token).post(`/api/v1/eventos/${creado.evento.id}/publicar`)).status).toBe(200);
    return { id: creado.evento.id, categoriaId: creado.categorias[0]!.id };
  }

  async function generarPieza(eventoId: string, dueno: UsuarioDePrueba = organizador): Promise<string> {
    const respuesta = await api(app, dueno.token).post(`/api/v1/marketing/eventos/${eventoId}/piezas`);
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(201);
    return PiezaSchema.parse(respuesta.body).id;
  }

  const crearEnlace = (pieza: string, cuerpo?: Record<string, unknown>, token = organizador.token) => {
    const peticion = api(app, token).post(`/api/v1/marketing/piezas/${pieza}/enlaces`);
    return cuerpo === undefined ? peticion : peticion.send(cuerpo);
  };

  async function enlaceCreado(pieza: string, cuerpo: Record<string, unknown> = {}): Promise<Enlace> {
    const respuesta = await crearEnlace(pieza, cuerpo);
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(201);
    return EnlaceSchema.parse(respuesta.body);
  }

  const clic = (codigo: string) => api(app).post(`/api/v1/marketing/enlaces/${codigo}/clics`);
  const resultados = (pieza: string, token = organizador.token) =>
    api(app, token).get(`/api/v1/marketing/piezas/${pieza}/resultados`);

  /** Orden de 1 entrada con `ref`; `pagar` la paga con Yape. */
  async function orden(ref: string, pagar: boolean): Promise<string> {
    const creada = await api(app, comprador.token).post("/api/v1/ventas/ordenes")
      .send({ evento_id: evento.id, categoria_id: evento.categoriaId, cantidad: 1, ref });
    expect(creada.status, JSON.stringify(creada.body)).toBe(201);
    const id = OrdenSchema.parse(creada.body).id;
    ordenes.push(id);
    if (pagar) {
      const pago = await api(app, comprador.token).post(`/api/v1/ventas/ordenes/${id}/pagar`).send({ metodo: "yape" });
      expect(pago.status, JSON.stringify(pago.body)).toBe(200);
    }
    return id;
  }

  async function clicsGuardados(codigo: string): Promise<Record<string, unknown>[]> {
    const bd = clienteAdminDePrueba();
    const { data: enlace, error } = await bd.from("marketing_enlaces").select("id").eq("codigo", codigo).single();
    expect(error).toBeNull();
    const clics = await bd.from("marketing_clics").select("*").eq("enlace_id", enlace!.id);
    expect(clics.error).toBeNull();
    return clics.data ?? [];
  }

  it("pieza recién generada: totales en 0 y sin enlaces (generar no crea enlaces)", async () => {
    const respuesta = await resultados(piezaId);
    expect(respuesta.status).toBe(200);
    expect(ResultadosPiezaSchema.parse(respuesta.body)).toEqual({
      pieza_id: piezaId,
      evento_id: evento.id,
      total: { clics: 0, ordenes: 0, entradas: 0, importe_centimos: 0 },
      enlaces: [],
    });
  });

  it("crea el enlace: 201 con código base62 de 8, evento, pieza, red y zona; sin cuerpo, red y zona null", async () => {
    const enlace = await enlaceCreado(piezaId, { red: "instagram", zona: "  Castilla  " });
    expect(enlace).toEqual({
      codigo: expect.stringMatching(/^[0-9A-Za-z]{8}$/),
      evento_id: evento.id,
      pieza_id: piezaId,
      red: "instagram",
      zona: "Castilla",
      creado_en: expect.any(String),
    });
    const { data, error } = await clienteAdminDePrueba().from("marketing_enlaces")
      .select("organizador_id").eq("codigo", enlace.codigo).single();
    expect(error).toBeNull();
    expect(data!.organizador_id).toBe(organizador.id);

    const sinCuerpo = await crearEnlace(piezaId);
    expect(sinCuerpo.status, JSON.stringify(sinCuerpo.body)).toBe(201);
    expect(sinCuerpo.body).toMatchObject({ red: null, zona: null, pieza_id: piezaId });
    expect(sinCuerpo.body.codigo).not.toBe(enlace.codigo);
  });

  it("cuerpo inválido: red fuera de la lista, zona vacía o de más de 60 caracteres → 400", async () => {
    for (const cuerpo of [{ red: "myspace" }, { zona: "" }, { zona: "   " }, { zona: "x".repeat(61) }, { zona: 5 }]) {
      const respuesta = await crearEnlace(piezaId, cuerpo);
      expect(respuesta.status, JSON.stringify(cuerpo)).toBe(400);
      expect(respuesta.body.error).toEqual({ codigo: expect.any(String), mensaje: expect.any(String) });
    }
    expect((await crearEnlace(piezaId, { zona: "x".repeat(60) })).status).toBe(201);
  });

  it("pieza ajena, inexistente o id que no es UUID → 404 PIEZA_NO_ENCONTRADA (crear y resultados)", async () => {
    const piezaAjena = await generarPieza((await eventoALaVenta(otroOrganizador)).id, otroOrganizador);
    for (const id of [piezaAjena, randomUUID(), "no-es-un-uuid"]) {
      for (const respuesta of [await crearEnlace(id, {}), await resultados(id)]) {
        expect(respuesta.status).toBe(404);
        expect(respuesta.body).toEqual({ error: { codigo: "PIEZA_NO_ENCONTRADA", mensaje: expect.any(String) } });
      }
    }
    const { count } = await clienteAdminDePrueba().from("marketing_enlaces")
      .select("*", { count: "exact", head: true }).eq("pieza_id", piezaAjena);
    expect(count).toBe(0);
  });

  it("rol equivocado → 403; sin token → 401", async () => {
    expect((await crearEnlace(piezaId, {}, comprador.token)).status).toBe(403);
    expect((await resultados(piezaId, comprador.token)).status).toBe(403);
    expect((await api(app).post(`/api/v1/marketing/piezas/${piezaId}/enlaces`).send({})).status).toBe(401);
    expect((await api(app).get(`/api/v1/marketing/piezas/${piezaId}/resultados`)).status).toBe(401);
  });

  it("registrar clic sin sesión: 201 con código y evento, y una fila sin datos personales", async () => {
    const enlace = await enlaceCreado(piezaId);
    const respuesta = await clic(enlace.codigo);
    expect(respuesta.status).toBe(201);
    expect(ClicRegistradoSchema.parse(respuesta.body)).toEqual({ codigo: enlace.codigo, evento_id: evento.id });
    const filas = await clicsGuardados(enlace.codigo);
    expect(filas).toHaveLength(1);
    expect(Object.keys(filas[0]!).sort()).toEqual(["creado_en", "enlace_id", "id"]);
  });

  it("código desconocido o con formato inválido → 404 ENLACE_NO_ENCONTRADO sin escribir nada", async () => {
    const { count: antes } = await clienteAdminDePrueba().from("marketing_clics").select("*", { count: "exact", head: true });
    for (const codigo of ["zzzzzzzz", "ZZZZ0000", "corto", "demasiado-largo"]) {
      const respuesta = await clic(codigo);
      expect(respuesta.status).toBe(404);
      expect(respuesta.body).toEqual({ error: { codigo: "ENLACE_NO_ENCONTRADO", mensaje: expect.any(String) } });
    }
    const { count: despues } = await clienteAdminDePrueba().from("marketing_clics").select("*", { count: "exact", head: true });
    expect(despues).toBe(antes);
  });

  it("verify: 1 clic + 1 orden pagada con ese ref → la pieza muestra 1 clic y 1 orden; pendiente y vencida no cuentan", async () => {
    const pieza = await generarPieza(evento.id);
    const enlace = await enlaceCreado(pieza, { red: "whatsapp" });

    expect((await clic(enlace.codigo)).status).toBe(201);
    await orden(enlace.codigo, true);
    await orden(enlace.codigo, false); // pendiente
    const vencida = await orden(enlace.codigo, false);
    const cambio = await clienteAdminDePrueba().from("ventas_ordenes").update({ estado: "expirada" }).eq("id", vencida);
    expect(cambio.error).toBeNull();

    const respuesta = await resultados(pieza);
    expect(respuesta.status).toBe(200);
    const leidos = ResultadosPiezaSchema.parse(respuesta.body);
    const esperado = { clics: 1, ordenes: 1, entradas: 1, importe_centimos: PRECIO };
    expect(leidos.total).toEqual(esperado);
    expect(leidos.enlaces).toEqual([{ ...enlace, ...esperado }]);
  });

  it("dos enlaces de la misma pieza (Sullana y Castilla): se separan por enlace y se suman en el total", async () => {
    const pieza = await generarPieza(evento.id);
    const sullana = await enlaceCreado(pieza, { zona: "Sullana" });
    const castilla = await enlaceCreado(pieza, { zona: "Castilla" });
    for (let i = 0; i < 3; i++) expect((await clic(sullana.codigo)).status).toBe(201);
    expect((await clic(castilla.codigo)).status).toBe(201);
    await orden(castilla.codigo, true);

    const leidos = ResultadosPiezaSchema.parse((await resultados(pieza)).body);
    expect(leidos.total).toEqual({ clics: 4, ordenes: 1, entradas: 1, importe_centimos: PRECIO });
    expect(leidos.enlaces).toEqual([
      { ...sullana, clics: 3, ordenes: 0, entradas: 0, importe_centimos: 0 },
      { ...castilla, clics: 1, ordenes: 1, entradas: 1, importe_centimos: PRECIO },
    ]);
  });

  it("panel de ventas (4.1): la compra desde el enlace de una pieza aparece en mis-ventas asignada a esa pieza", async () => {
    const pieza = await generarPieza(evento.id);
    const enlace = await enlaceCreado(pieza, { red: "instagram" });
    expect((await clic(enlace.codigo)).status).toBe(201);
    await orden(enlace.codigo, true);

    const respuesta = await api(app, organizador.token).get("/api/v1/negocio/mis-ventas");
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);
    const ventas = VentasOrganizadorSchema.parse(respuesta.body);
    const deLaPieza = ventas.piezas.find((p) => p.pieza_id === pieza);
    expect(deLaPieza).toMatchObject({ evento_id: evento.id, clics: 1, ordenes: 1, entradas: 1, importe_centimos: PRECIO });
    expect(deLaPieza?.enlaces).toEqual([
      { codigo: enlace.codigo, red: "instagram", zona: null, clics: 1, ordenes: 1, entradas: 1, importe_centimos: PRECIO },
    ]);
    const delEvento = ventas.eventos.find((e) => e.evento_id === evento.id);
    expect(delEvento?.por_categoria[0]?.entradas).toBe(delEvento?.entradas);

    // Otro organizador no ve estas ventas; el público no tiene panel.
    const ajeno = VentasOrganizadorSchema.parse((await api(app, otroOrganizador.token).get("/api/v1/negocio/mis-ventas")).body);
    expect(ajeno.piezas).toEqual([]);
    expect(ajeno.resumen.ordenes).toBe(0);
    expect((await api(app, comprador.token).get("/api/v1/negocio/mis-ventas")).status).toBe(403);
  });

  it("AD-1: anon y authenticated no pueden leer ni escribir marketing_enlaces ni marketing_clics", async () => {
    const { url, clavePublica } = entornoDePrueba();
    const autenticado: SupabaseClient = createClient(url, clavePublica, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${comprador.token}` } },
    });
    for (const cliente of [clientePublicoDePrueba(), autenticado]) {
      for (const tabla of ["marketing_enlaces", "marketing_clics"]) {
        const lectura = await cliente.from(tabla).select("*");
        expect(lectura.error?.code, tabla).toBe("42501");
        const insercion = await cliente.from(tabla).insert({ id: randomUUID() });
        expect(insercion.error?.code, tabla).toBe("42501");
      }
    }
  });
});
