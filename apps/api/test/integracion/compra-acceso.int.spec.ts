import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import {
  EventoCreadoSchema,
  MisEntradasSchema,
  type Orden,
  type OrdenPagada,
  OrdenPagadaSchema,
  OrdenSchema,
  ResultadoValidacionSchema,
} from "@reto18/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BUCKET_FOTOS } from "../../src/eventos/archivos-eventos.js";
import { PASARELA_PAGO, type PasarelaPago } from "../../src/ventas/pasarela-pago.js";
import { firmarQr, verificarQr } from "../../src/ventas/qr.js";
import { calcularComision, VentasService } from "../../src/ventas/ventas.service.js";
import { crearAppDePrueba } from "./ayudas/app.js";
import { api } from "./ayudas/http.js";
import { clienteAdminDePrueba } from "./ayudas/supabase.js";
import { tokenPorRol, type UsuarioDePrueba } from "./ayudas/tokens.js";

const QR_SECRET = `secreto-de-prueba-${randomUUID()}`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const PRECIO = 4000;

interface EventoALaVenta {
  id: string;
  categoriaId: string;
}

describe("compra mínima y validación en puerta contra la BD de prueba", () => {
  let app: INestApplication;
  let organizador: UsuarioDePrueba;
  let otroOrganizador: UsuarioDePrueba;
  let comprador: UsuarioDePrueba;
  let otroComprador: UsuarioDePrueba;
  let admin: UsuarioDePrueba;
  const ordenes: string[] = [];
  /** Código del enlace rastreable (8 caracteres, AD-8), único por ejecución. */
  const ref = randomUUID().replace(/-/g, "").slice(0, 8);

  // Evento A (aforo 3) para el recorrido; B (aforo 1) para la concurrencia y el vencimiento.
  let a: EventoALaVenta;
  let b: EventoALaVenta;
  let pagada: OrdenPagada;
  /** Orden ganadora de la carrera por el último cupo de B, con su dueño. */
  let ganadora: { id: string; usuario: UsuarioDePrueba };

  beforeAll(async () => {
    process.env.QR_SECRET = QR_SECRET; // Se lee al construir la app.
    app = await crearAppDePrueba();
    [organizador, otroOrganizador, comprador, otroComprador, admin] = await Promise.all([
      tokenPorRol("organizador"), tokenPorRol("organizador"), tokenPorRol("publico"), tokenPorRol("publico"), tokenPorRol("admin"),
    ]);
    a = await eventoALaVenta(3);
    b = await eventoALaVenta(1);
  });

  // Antes que `limpieza.ts`: eventos, órdenes y sedes referencian a los usuarios de prueba.
  afterAll(async () => {
    await app?.close();
    delete process.env.QR_SECRET;
    const bd = clienteAdminDePrueba();
    if (ordenes.length) {
      expect((await bd.from("notificaciones_bandeja").delete().in("datos->>orden_id", ordenes)).error).toBeNull();
    }
    const organizadores = [organizador, otroOrganizador].filter(Boolean).map((u) => u.id);
    // Borrar los eventos arrastra cupos, órdenes y entradas (on delete cascade).
    expect((await bd.from("eventos_eventos").delete().in("organizador_id", organizadores)).error).toBeNull();
    expect((await bd.from("eventos_sedes").delete().in("creado_por", organizadores)).error).toBeNull();
    for (const id of organizadores) {
      const { data } = await bd.storage.from(BUCKET_FOTOS).list(id);
      const rutas = (data ?? []).map((f) => `${id}/${f.name}`);
      if (rutas.length) expect((await bd.storage.from(BUCKET_FOTOS).remove(rutas)).error).toBeNull();
    }
  });

  /** Alta con sede nueva de zona general (capacidad 5); sin `publicar`, queda pendiente. */
  async function alta(aforo: number, dueno: UsuarioDePrueba = organizador): Promise<EventoALaVenta> {
    const respuesta = await api(app, dueno.token).post("/api/v1/eventos").field("datos", JSON.stringify({
      titulo: "Peña de prueba", categoria: "musica", descripcion: "Evento de prueba de la compra mínima de entradas.",
      inicio: "2030-11-20T20:00:00-05:00", aforo, hay_musica: false,
      sede: { tipo: "nueva", nombre: `Patio ${randomUUID().slice(0, 8)}`, direccion: "Jr. Venta 1", distrito: "Piura", capacidad: 5 },
      categorias: [{ nombre: "General", precio_centimos: PRECIO }],
    })).attach("foto", PNG, "foto.png");
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(201);
    const creado = EventoCreadoSchema.parse(respuesta.body);
    return { id: creado.evento.id, categoriaId: creado.categorias[0]!.id };
  }

  /** Alta → aprobar (admin) → publicar (organizador). */
  async function eventoALaVenta(aforo: number, dueno: UsuarioDePrueba = organizador): Promise<EventoALaVenta> {
    const evento = await alta(aforo, dueno);
    expect((await api(app, admin.token).patch(`/api/v1/eventos/${evento.id}/aprobar`)).status).toBe(200);
    expect((await api(app, dueno.token).post(`/api/v1/eventos/${evento.id}/publicar`)).status).toBe(200);
    return evento;
  }

  function crearOrden(usuario: UsuarioDePrueba, evento: EventoALaVenta, cantidad: number, extra: Record<string, unknown> = {}) {
    return api(app, usuario.token).post("/api/v1/ventas/ordenes")
      .send({ evento_id: evento.id, categoria_id: evento.categoriaId, cantidad, ...extra });
  }

  async function ordenCreada(usuario: UsuarioDePrueba, evento: EventoALaVenta, cantidad: number, extra = {}): Promise<Orden> {
    const respuesta = await crearOrden(usuario, evento, cantidad, extra);
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(201);
    const orden = OrdenSchema.parse(respuesta.body);
    ordenes.push(orden.id);
    return orden;
  }

  function pagar(usuario: UsuarioDePrueba, ordenId: string, metodo = "yape") {
    return api(app, usuario.token).post(`/api/v1/ventas/ordenes/${ordenId}/pagar`).send({ metodo });
  }

  function validar(usuario: UsuarioDePrueba, eventoId: string, qr: string) {
    return api(app, usuario.token).post(`/api/v1/acceso/eventos/${eventoId}/validar`).send({ qr });
  }

  async function vendidas(eventoId: string): Promise<number> {
    const { data, error } = await clienteAdminDePrueba().from("ventas_evento_cupos").select("vendidas").eq("evento_id", eventoId);
    expect(error).toBeNull();
    return (data ?? []).reduce((suma, c) => suma + Number(c.vendidas), 0);
  }

  async function filaOrden(id: string) {
    const { data, error } = await clienteAdminDePrueba().from("ventas_ordenes").select("*").eq("id", id).single();
    expect(error).toBeNull();
    return data as Record<string, unknown>;
  }

  it("evento no vendible: inexistente, pendiente o sin publicar → 404; categoría ajena → 400", async () => {
    const pendiente = await alta(2);
    const sinPublicar = await alta(2);
    expect((await api(app, admin.token).patch(`/api/v1/eventos/${sinPublicar.id}/aprobar`)).status).toBe(200);
    for (const evento of [{ id: randomUUID(), categoriaId: randomUUID() }, pendiente, sinPublicar]) {
      const respuesta = await crearOrden(comprador, evento, 1);
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
    }
    const ajena = await crearOrden(comprador, { id: a.id, categoriaId: b.categoriaId }, 1);
    expect(ajena.status).toBe(400);
    expect(ajena.body.error.codigo).toBe("CATEGORIA_NO_VALIDA");
    for (const cuerpo of [{ cantidad: 0 }, { cantidad: 11 }, { cantidad: 1.5 }]) {
      expect((await crearOrden(comprador, a, 1, cuerpo)).status).toBe(400);
    }
    expect((await api(app).post("/api/v1/ventas/ordenes").send({})).status).toBe(401);
    expect(await vendidas(a.id)).toBe(0);
  });

  it("crea la orden pendiente: reserva el cupo 10 minutos y calcula el total", async () => {
    const antes = Date.now();
    const orden = await ordenCreada(comprador, a, 2, { ref });
    expect(orden).toMatchObject({ estado: "pendiente", cantidad: 2, precio_unitario_centimos: PRECIO, total_centimos: 2 * PRECIO, ref });
    const expira = Date.parse(orden.expira_en) - antes;
    expect(expira).toBeGreaterThan(9 * 60_000);
    expect(expira).toBeLessThanOrEqual(10 * 60_000 + 5_000);
    expect(await vendidas(a.id)).toBe(2);
  });

  it("sin cupo: pedir más de lo que queda → 409 SIN_CUPO y nada cambia", async () => {
    const respuesta = await crearOrden(otroComprador, a, 2);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe("SIN_CUPO");
    expect(await vendidas(a.id)).toBe(2);
  });

  it("paga: orden pagada con comisión congelada, entradas con QR y un aviso pendiente en la bandeja", async () => {
    const ordenId = ordenes[0]!;
    const respuesta = await pagar(comprador, ordenId, "yape");
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);
    pagada = OrdenPagadaSchema.parse(respuesta.body);
    expect(pagada.orden).toMatchObject({ id: ordenId, estado: "pagada", metodo_pago: "yape" });
    expect(pagada.entradas).toHaveLength(2);
    for (const entrada of pagada.entradas) expect(verificarQr(entrada.qr, QR_SECRET)).toBe(entrada.id);

    const fila = await filaOrden(ordenId);
    expect(fila).toMatchObject({
      ref, metodo_pago: "yape", comision_modelo: "porcentaje", comision_valor: 500,
      comision_importe: calcularComision("porcentaje", 500, 2 * PRECIO, 2),
    });
    expect(fila.comision_importe).toBe(400);
    expect(await vendidas(a.id)).toBe(2);

    const { data: bandeja, error } = await clienteAdminDePrueba().from("notificaciones_bandeja")
      .select("telefono, plantilla, datos, adjunto_url, estado").eq("datos->>orden_id", ordenId);
    expect(error).toBeNull();
    expect(bandeja).toHaveLength(1);
    expect(bandeja![0]).toMatchObject({ telefono: "+51987654321", plantilla: "entrada_pagada", adjunto_url: null, estado: "pendiente" });
    expect(bandeja![0]!.datos.entradas).toEqual(pagada.entradas.map((e) => ({ id: e.id, qr: e.qr })));
  });

  it("cambiar la comisión vigente después no altera la orden pagada (AD-10)", async () => {
    const bd = clienteAdminDePrueba();
    const antes = await filaOrden(pagada.orden.id);
    expect((await bd.from("ventas_config_comision").update({ valor: 1000 }).eq("vigente", true)).error).toBeNull();
    try {
      const despues = await filaOrden(pagada.orden.id);
      expect(despues).toMatchObject({ comision_modelo: antes.comision_modelo, comision_valor: 500, comision_importe: 400 });
    } finally {
      expect((await bd.from("ventas_config_comision").update({ valor: 500 }).eq("vigente", true)).error).toBeNull();
    }
  });

  it("la comisión en Postgres sigue la misma regla que calcularComision", async () => {
    const bd = clienteAdminDePrueba();
    for (const [modelo, valor, total, cantidad] of [
      ["porcentaje", 500, 4010, 1], ["porcentaje", 500, 4009, 1], ["fijo_por_entrada", 150, 8000, 2], ["tarifa_evento", 9000, 8000, 2],
    ] as const) {
      const { data, error } = await bd.rpc("ventas_calcular_comision", { p_modelo: modelo, p_valor: valor, p_total: total, p_cantidad: cantidad });
      expect(error).toBeNull();
      expect(data).toBe(calcularComision(modelo, valor, total, cantidad));
    }
  });

  it("pago repetido → 409 ORDEN_NO_PENDIENTE; orden ajena → 404 ORDEN_NO_ENCONTRADA", async () => {
    const repetido = await pagar(comprador, pagada.orden.id);
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.codigo).toBe("ORDEN_NO_PENDIENTE");
    for (const id of [pagada.orden.id, randomUUID()]) {
      const ajena = await pagar(otroComprador, id);
      expect(ajena.status).toBe(404);
      expect(ajena.body.error.codigo).toBe("ORDEN_NO_ENCONTRADA");
    }
    expect((await pagar(comprador, pagada.orden.id, "efectivo")).status).toBe(400);
  });

  it("mis entradas: las propias, con evento, QR firmado y usada_en", async () => {
    const respuesta = await api(app, comprador.token).get("/api/v1/ventas/mis-entradas");
    expect(respuesta.status).toBe(200);
    const entradas = MisEntradasSchema.parse(respuesta.body);
    expect(entradas.map((e) => e.id).sort()).toEqual(pagada.entradas.map((e) => e.id).sort());
    for (const entrada of entradas) {
      expect(entrada).toMatchObject({ evento_id: a.id, usada_en: null, categoria: "General", evento: { id: a.id, titulo: "Peña de prueba" } });
      expect(entrada.evento.sede.direccion).toBe("Jr. Venta 1");
      expect(verificarQr(entrada.qr, QR_SECRET)).toBe(entrada.id);
    }
    const ajenas = await api(app, otroComprador.token).get("/api/v1/ventas/mis-entradas");
    expect(ajenas.status).toBe(200);
    expect(ajenas.body).toEqual([]);
  });

  it("valida en la puerta: acepta una vez y al segundo escaneo responde 409 ENTRADA_YA_USADA con usada_en", async () => {
    const [primera, segunda] = pagada.entradas as [OrdenPagada["entradas"][number], OrdenPagada["entradas"][number]];
    const aceptada = await validar(organizador, a.id, primera.qr);
    expect(aceptada.status, JSON.stringify(aceptada.body)).toBe(200);
    const resultado = ResultadoValidacionSchema.parse(aceptada.body);
    expect(resultado).toMatchObject({ resultado: "aceptada", entrada_id: primera.id, evento_id: a.id });

    const otraVez = await validar(organizador, a.id, primera.qr);
    expect(otraVez.status).toBe(409);
    expect(otraVez.body.error.codigo).toBe("ENTRADA_YA_USADA");
    expect(Date.parse(otraVez.body.error.detalles.usada_en)).toBe(Date.parse(resultado.usada_en));

    // Un admin valida en cualquier evento.
    expect((await validar(admin, a.id, segunda.qr)).status).toBe(200);
    const mias = MisEntradasSchema.parse((await api(app, comprador.token).get("/api/v1/ventas/mis-entradas")).body);
    expect(mias.every((e) => e.usada_en !== null)).toBe(true);
  });

  it("puerta: QR falso → 400, de otro evento → 409, organizador ajeno → 404, público → 403", async () => {
    const qr = pagada.entradas[0]!.qr;
    for (const falso of [firmarQr(pagada.entradas[0]!.id, "otro-secreto"), "basura", firmarQr(randomUUID(), QR_SECRET)]) {
      const respuesta = await validar(organizador, a.id, falso);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.codigo).toBe("QR_INVALIDO");
    }
    const deB = await eventoALaVenta(1);
    const otroEvento = await validar(organizador, deB.id, qr);
    expect(otroEvento.status).toBe(409);
    expect(otroEvento.body.error.codigo).toBe("ENTRADA_DE_OTRO_EVENTO");

    const ajeno = await validar(otroOrganizador, a.id, qr);
    expect(ajeno.status).toBe(404);
    expect(ajeno.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
    expect((await validar(organizador, randomUUID(), qr)).status).toBe(404);
    expect((await validar(comprador, a.id, qr)).status).toBe(403);
    expect((await api(app).post(`/api/v1/acceso/eventos/${a.id}/validar`).send({ qr })).status).toBe(401);
  });

  it("dos órdenes concurrentes por el último cupo: solo una queda pendiente", async () => {
    const compradores = [comprador, otroComprador];
    const respuestas = await Promise.all(compradores.map((u) => crearOrden(u, b, 1)));
    const estados = respuestas.map((r) => r.status).sort();
    expect(estados).toEqual([201, 409]);
    const perdedora = respuestas.find((r) => r.status === 409)!;
    expect(perdedora.body.error.codigo).toBe("SIN_CUPO");
    const i = respuestas.findIndex((r) => r.status === 201);
    ganadora = { id: respuestas[i]!.body.id as string, usuario: compradores[i]! };
    ordenes.push(ganadora.id);
    expect(await vendidas(b.id)).toBe(1);
  });

  it("pago tardío: 409 ORDEN_EXPIRADA, orden expirada, cupo devuelto y cobro anulado", async () => {
    const ordenId = ganadora.id;
    const bd = clienteAdminDePrueba();
    expect((await bd.from("ventas_ordenes").update({ expira_en: new Date(Date.now() - 60_000).toISOString() }).eq("id", ordenId)).error).toBeNull();
    const pasarela = app.get<PasarelaPago>(PASARELA_PAGO);
    const cobrar = vi.spyOn(pasarela, "cobrar");
    const anular = vi.spyOn(pasarela, "anular");
    try {
      const respuesta = await pagar(ganadora.usuario, ordenId, "tarjeta");
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe("ORDEN_EXPIRADA");
      expect(anular).toHaveBeenCalledWith((await cobrar.mock.results[0]!.value).referencia);
    } finally {
      cobrar.mockRestore();
      anular.mockRestore();
    }
    expect(await filaOrden(ordenId)).toMatchObject({ estado: "expirada", metodo_pago: null });
    expect(await vendidas(b.id)).toBe(0);
    const { count } = await bd.from("ventas_entradas").select("id", { count: "exact", head: true }).eq("orden_id", ordenId);
    expect(count).toBe(0);
  });

  it("vencimiento perezoso: una orden vencida libera su cupo al crear la siguiente", async () => {
    const vieja = await ordenCreada(comprador, b, 1);
    expect((await crearOrden(otroComprador, b, 1)).status).toBe(409);
    const bd = clienteAdminDePrueba();
    expect((await bd.from("ventas_ordenes").update({ expira_en: new Date(Date.now() - 1_000).toISOString() }).eq("id", vieja.id)).error).toBeNull();
    await ordenCreada(otroComprador, b, 1);
    expect((await filaOrden(vieja.id)).estado).toBe("expirada");
    expect(await vendidas(b.id)).toBe(1);
  });

  it("venta cerrada: si el evento ya empezó → 409 VENTA_CERRADA", async () => {
    const cerrado = await eventoALaVenta(2);
    const bd = clienteAdminDePrueba();
    expect((await bd.from("eventos_eventos").update({ inicio: new Date(Date.now() - 60_000).toISOString() }).eq("id", cerrado.id)).error).toBeNull();
    const respuesta = await crearOrden(comprador, cerrado, 1);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe("VENTA_CERRADA");
    expect(await vendidas(cerrado.id)).toBe(0);
  });

  it("ventasPorRef cuenta solo las órdenes pagadas (AD-8)", async () => {
    // Una pendiente y una expirada con el mismo ref no cuentan.
    const pendiente = await ordenCreada(otroComprador, a, 1, { ref });
    expect(pendiente.estado).toBe("pendiente");
    const bd = clienteAdminDePrueba();
    expect((await bd.from("ventas_ordenes").update({ expira_en: new Date(Date.now() - 1_000).toISOString() }).eq("id", pendiente.id)).error).toBeNull();
    const expiradaPorRpc = await bd.rpc("ventas_expirar_orden", { p_orden_id: pendiente.id });
    expect(expiradaPorRpc.data).toBe(true);
    await ordenCreada(otroComprador, a, 1, { ref });

    const ventas = app.get(VentasService);
    const otro = `${ref}x`;
    expect(await ventas.ventasPorRef([ref, otro, ref])).toEqual([
      { ref, ordenes: 1, entradas: 2, importe_centimos: 2 * PRECIO },
      { ref: otro, ordenes: 0, entradas: 0, importe_centimos: 0 },
    ]);
    expect(await ventas.ventasPorRef([])).toEqual([]);
  });

  it("una orden a menos de 10 minutos del inicio vence a la hora de inicio (AD-5)", async () => {
    const pronto = await eventoALaVenta(2);
    const inicio = new Date(Date.now() + 2 * 60_000).toISOString();
    expect((await clienteAdminDePrueba().from("eventos_eventos").update({ inicio }).eq("id", pronto.id)).error).toBeNull();
    const orden = await ordenCreada(comprador, pronto, 1);
    expect(Date.parse(orden.expira_en)).toBeLessThanOrEqual(Date.parse(inicio));
    expect(Date.parse(orden.expira_en)).toBe(Date.parse(inicio));
  });

  it("un ref vacío, sin texto o de más de 64 caracteres no rechaza la orden: queda sin ref (AD-8)", async () => {
    const evento = await eventoALaVenta(3);
    for (const valor of ["", "   ", "x".repeat(65)]) {
      const orden = await ordenCreada(comprador, evento, 1, { ref: valor });
      expect(orden.ref).toBeNull();
      expect((await filaOrden(orden.id)).ref).toBeNull();
    }
  });

  it("atomicidad del cupo: 10 RPC ventas_crear_orden en paralelo por el último cupo → una pasa, el resto SIN_CUPO", async () => {
    const evento = await eventoALaVenta(1);
    const bd = clienteAdminDePrueba();
    const { data: categoria, error } = await bd.from("eventos_categorias_precio")
      .select("seccion_id").eq("id", evento.categoriaId).single();
    expect(error).toBeNull();
    const seccionId = categoria!.seccion_id as string;
    const datos = {
      usuario_id: comprador.id, evento_id: evento.id, categoria_id: evento.categoriaId, seccion_id: seccionId,
      cantidad: 1, precio_unitario_centimos: PRECIO, inicio: "2030-11-21T01:00:00+00:00", aforo: 1, ref: null,
      cupos: [{ seccion_id: seccionId, capacidad: 1 }],
    };
    const resultados = await Promise.all(Array.from({ length: 10 }, () => bd.rpc("ventas_crear_orden", { p_datos: datos })));
    const exitos = resultados.filter((r) => !r.error);
    expect(exitos).toHaveLength(1);
    for (const r of resultados.filter((r) => r.error)) expect(r.error).toMatchObject({ code: "P0001", message: "SIN_CUPO" });
    expect(await vendidas(evento.id)).toBe(1);
    const { count } = await bd.from("ventas_ordenes").select("id", { count: "exact", head: true }).eq("evento_id", evento.id);
    expect(count).toBe(1);
  });

  it("el navegador no ve las tablas de ventas ni de notificaciones (AD-1)", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const { entornoDePrueba } = await import("./ayudas/supabase.js");
    const { url, clavePublica } = entornoDePrueba();
    const navegador = createClient(url, clavePublica, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const tabla of ["ventas_config_comision", "ventas_evento_cupos", "ventas_ordenes", "ventas_entradas", "notificaciones_bandeja"]) {
      const { data, error } = await navegador.from(tabla).select("*").limit(1);
      expect(error ?? data?.length === 0).toBeTruthy();
      expect(data ?? []).toEqual([]);
    }
    const { error } = await navegador.rpc("ventas_crear_orden", { p_datos: {} });
    expect(error).not.toBeNull();
  });
});
