import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import {
  ButacasVentaSchema,
  EventoCreadoSchema,
  MapaSedeSchema,
  type MapaSede,
  MisEntradasSchema,
  type OrdenPagada,
  OrdenPagadaSchema,
  OrdenSchema,
} from "@reto18/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { entradaDeCroquis } from "../fixtures/croquis.js";
import { BUCKET_FOTOS } from "../../src/eventos/archivos-eventos.js";
import { PASARELA_PAGO, type PasarelaPago } from "../../src/ventas/pasarela-pago.js";
import { verificarQr } from "../../src/ventas/qr.js";
import { crearAppDePrueba } from "./ayudas/app.js";
import { api } from "./ayudas/http.js";
import { clienteAdminDePrueba } from "./ayudas/supabase.js";
import { tokenPorRol, type UsuarioDePrueba } from "./ayudas/tokens.js";

const QR_SECRET = `secreto-de-prueba-${randomUUID()}`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const PRECIO = 6000;

describe("compra de una butaca numerada (historias 2.5/2.6/2.11, versión reducida) contra la BD de prueba", () => {
  let app: INestApplication;
  let organizador: UsuarioDePrueba;
  let comprador: UsuarioDePrueba;
  let otroComprador: UsuarioDePrueba;
  let admin: UsuarioDePrueba;
  const ordenes: string[] = [];
  let eventoId: string;
  let sede: MapaSede;
  let asientoId: string;

  beforeAll(async () => {
    process.env.QR_SECRET = QR_SECRET; // Se lee al construir la app.
    app = await crearAppDePrueba();
    [organizador, comprador, otroComprador, admin] = await Promise.all([
      tokenPorRol("organizador"), tokenPorRol("publico"), tokenPorRol("publico"), tokenPorRol("admin"),
    ]);

    // Sede numerada (croquis) con un evento aprobado y publicado, con precios en todos los asientos.
    const mapaCreado = await api(app, organizador.token).post("/api/v1/eventos/sedes")
      .send(entradaDeCroquis(`Teatro butacas ${randomUUID().slice(0, 8)}`));
    expect(mapaCreado.status, JSON.stringify(mapaCreado.body)).toBe(201);
    sede = MapaSedeSchema.parse(mapaCreado.body);
    asientoId = sede.secciones[0]!.filas[0]!.bloques[0]!.asientos[0]!.id;

    const alta = await api(app, organizador.token).post("/api/v1/eventos").field("datos", JSON.stringify({
      titulo: "Función con butacas", categoria: "teatro", descripcion: "Evento de prueba de compra de butacas.",
      inicio: "2030-11-20T20:00:00-05:00", aforo: 643, hay_musica: false,
      sede: { tipo: "existente", sede_id: sede.id },
      categorias: [{ nombre: "Única", precio_centimos: PRECIO }],
    })).attach("foto", PNG, "foto.png");
    expect(alta.status, JSON.stringify(alta.body)).toBe(201);
    const creado = EventoCreadoSchema.parse(alta.body);
    eventoId = creado.evento.id;
    const categoriaId = creado.categorias[0]!.id;

    // Un rango que cubre todo el croquis con la única categoría, para que publicar no falle por ASIENTOS_SIN_PRECIO.
    const rangos = sede.secciones.flatMap((seccion) =>
      seccion.tipo !== "numerada" ? [] : seccion.filas.map((fila) => {
        const numeros = fila.bloques.flatMap((b) => b.asientos.map((a) => a.numero));
        return { categoria_id: categoriaId, seccion: seccion.nombre, fila: fila.nombre, desde: Math.min(...numeros), hasta: Math.max(...numeros) };
      }),
    );
    expect((await api(app, organizador.token).put(`/api/v1/eventos/${eventoId}/precios`).send({ rangos })).status).toBe(200);

    expect((await api(app, admin.token).patch(`/api/v1/eventos/${eventoId}/aprobar`)).status).toBe(200);
    expect((await api(app, organizador.token).post(`/api/v1/eventos/${eventoId}/publicar`)).status).toBe(200);
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.QR_SECRET;
    const bd = clienteAdminDePrueba();
    if (ordenes.length) {
      expect((await bd.from("notificaciones_bandeja").delete().in("datos->>orden_id", ordenes)).error).toBeNull();
    }
    expect((await bd.from("eventos_eventos").delete().eq("organizador_id", organizador.id)).error).toBeNull();
    expect((await bd.from("eventos_sedes").delete().eq("creado_por", organizador.id)).error).toBeNull();
    const { data } = await bd.storage.from(BUCKET_FOTOS).list(organizador.id);
    const rutas = (data ?? []).map((f) => `${organizador.id}/${f.name}`);
    if (rutas.length) expect((await bd.storage.from(BUCKET_FOTOS).remove(rutas)).error).toBeNull();
  });

  function crearOrdenAsiento(usuario: UsuarioDePrueba, extra: Record<string, unknown> = {}) {
    return api(app, usuario.token).post("/api/v1/ventas/ordenes/asiento")
      .send({ evento_id: eventoId, asiento_id: asientoId, ...extra });
  }

  function pagar(usuario: UsuarioDePrueba, ordenId: string, metodo = "yape") {
    return api(app, usuario.token).post(`/api/v1/ventas/ordenes/${ordenId}/pagar`).send({ metodo });
  }

  async function filaButaca() {
    const { data, error } = await clienteAdminDePrueba().from("ventas_evento_asientos")
      .select("estado, orden_id, precio_centimos, categoria_id").eq("evento_id", eventoId).eq("asiento_id", asientoId).single();
    expect(error).toBeNull();
    return data as { estado: string; orden_id: string | null; precio_centimos: number; categoria_id: string };
  }

  it("GET mapa-venta y GET butacas: inventario asegurado con el precio resuelto, todas disponibles", async () => {
    const mapa = await api(app).get(`/api/v1/eventos/${eventoId}/mapa-venta`);
    expect(mapa.status, JSON.stringify(mapa.body)).toBe(200);
    expect(MapaSedeSchema.parse(mapa.body).id).toBe(sede.id);

    const respuesta = await api(app).get(`/api/v1/ventas/eventos/${eventoId}/butacas`);
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);
    const butacas = ButacasVentaSchema.parse(respuesta.body);
    expect(butacas.length).toBe(643);
    expect(butacas.every((b) => b.estado === "disponible" && b.precio_centimos === PRECIO)).toBe(true);
    const laNuestra = butacas.find((b) => b.asiento_id === asientoId);
    expect(laNuestra).toMatchObject({ seccion: "Platea baja", fila: "A", numero: 1 });

    // Pedirlo otra vez es idempotente: no duplica filas ni cambia el estado.
    const otraVez = await api(app).get(`/api/v1/ventas/eventos/${eventoId}/butacas`);
    expect(ButacasVentaSchema.parse(otraVez.body).length).toBe(643);
  });

  it("evento inexistente o pendiente (sin aprobar/publicar) → 404 EVENTO_NO_EXISTE/EVENTO_NO_ENCONTRADO", async () => {
    const pendiente = await api(app, organizador.token).post("/api/v1/eventos").field("datos", JSON.stringify({
      titulo: "Sin publicar", categoria: "teatro", descripcion: "Evento de prueba sin publicar.",
      inicio: "2030-11-20T20:00:00-05:00", aforo: 2, hay_musica: false,
      sede: { tipo: "nueva", nombre: `Patio ${randomUUID().slice(0, 8)}`, direccion: "Jr. Venta 1", distrito: "Piura", capacidad: 5 },
      categorias: [{ nombre: "General", precio_centimos: 1000 }],
    })).attach("foto", PNG, "foto.png");
    const idPendiente = EventoCreadoSchema.parse(pendiente.body).evento.id;

    for (const id of [randomUUID(), idPendiente]) {
      const mapaVenta = await api(app).get(`/api/v1/eventos/${id}/mapa-venta`);
      expect(mapaVenta.status).toBe(404);
      expect(mapaVenta.body.error.codigo).toBe("EVENTO_NO_EXISTE");
      const butacas = await api(app).get(`/api/v1/ventas/eventos/${id}/butacas`);
      expect(butacas.status).toBe(404);
      expect(butacas.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
      const orden = await api(app, comprador.token).post("/api/v1/ventas/ordenes/asiento").send({ evento_id: id, asiento_id: asientoId });
      expect(orden.status).toBe(404);
      expect(orden.body.error.codigo).toBe("EVENTO_NO_ENCONTRADO");
    }

    const bd = clienteAdminDePrueba();
    expect((await bd.from("eventos_eventos").delete().eq("id", idPendiente)).error).toBeNull();
  });

  it("asiento que no existe en el evento → 404 ASIENTO_NO_EXISTE", async () => {
    const respuesta = await crearOrdenAsiento(comprador, { asiento_id: randomUUID() });
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe("ASIENTO_NO_EXISTE");
    expect((await filaButaca()).estado).toBe("disponible");
  });

  it("crea la orden pendiente de la butaca sin cupo de zona general (seccion_id null) y sin tocar su estado", async () => {
    const antes = Date.now();
    const respuesta = await crearOrdenAsiento(comprador);
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(201);
    const orden = OrdenSchema.parse(respuesta.body);
    ordenes.push(orden.id);
    expect(orden).toMatchObject({
      evento_id: eventoId, asiento_id: asientoId, cantidad: 1,
      precio_unitario_centimos: PRECIO, total_centimos: PRECIO, estado: "pendiente",
    });
    const expira = Date.parse(orden.expira_en) - antes;
    expect(expira).toBeGreaterThan(9 * 60_000);
    expect(expira).toBeLessThanOrEqual(10 * 60_000 + 5_000);
    // La butaca sigue "disponible": la garantía de unicidad vive en el pago, no en crear la orden.
    expect(await filaButaca()).toMatchObject({ estado: "disponible", orden_id: null });

    const fila = await clienteAdminDePrueba().from("ventas_ordenes").select("seccion_id").eq("id", orden.id).single();
    expect(fila.data).toEqual({ seccion_id: null });
  });

  it(
    "dos órdenes pendientes de la MISMA butaca: la primera en pagar se la queda; " +
      "la segunda falla con 409 BUTACA_NO_DISPONIBLE y su cobro simulado se anula",
    async () => {
      const ordenGanadora = OrdenSchema.parse((await crearOrdenAsiento(comprador)).body);
      const ordenPerdedora = OrdenSchema.parse((await crearOrdenAsiento(otroComprador)).body);
      ordenes.push(ordenGanadora.id, ordenPerdedora.id);
      // Ambas coexisten como pendientes: no hay bloqueo temporal de la butaca (decisión del recorte).
      expect(ordenGanadora.id).not.toBe(ordenPerdedora.id);

      const pagada = await pagar(comprador, ordenGanadora.id, "yape");
      expect(pagada.status, JSON.stringify(pagada.body)).toBe(200);
      const ganadora: OrdenPagada = OrdenPagadaSchema.parse(pagada.body);
      expect(ganadora.orden).toMatchObject({ id: ordenGanadora.id, estado: "pagada", asiento_id: asientoId });
      expect(ganadora.entradas).toHaveLength(1);
      expect(ganadora.entradas[0]).toMatchObject({ asiento: { seccion: "Platea baja", fila: "A", numero: 1 } });
      expect(verificarQr(ganadora.entradas[0]!.qr, QR_SECRET)).toBe(ganadora.entradas[0]!.id);
      expect(await filaButaca()).toMatchObject({ estado: "vendida", orden_id: ordenGanadora.id });

      const pasarela = app.get<PasarelaPago>(PASARELA_PAGO);
      const anular = vi.spyOn(pasarela, "anular");
      try {
        const segundoPago = await pagar(otroComprador, ordenPerdedora.id, "tarjeta");
        expect(segundoPago.status).toBe(409);
        expect(segundoPago.body.error.codigo).toBe("BUTACA_NO_DISPONIBLE");
        expect(anular).toHaveBeenCalledOnce();
      } finally {
        anular.mockRestore();
      }
      // La butaca sigue vendida por la ganadora; la orden perdedora no quedó pagada ni generó entradas.
      expect(await filaButaca()).toMatchObject({ estado: "vendida", orden_id: ordenGanadora.id });
      const filaPerdedora = await clienteAdminDePrueba().from("ventas_ordenes").select("estado").eq("id", ordenPerdedora.id).single();
      expect(filaPerdedora.data).toEqual({ estado: "pendiente" });
      const { count } = await clienteAdminDePrueba().from("ventas_entradas").select("id", { count: "exact", head: true }).eq("orden_id", ordenPerdedora.id);
      expect(count).toBe(0);

      // Una tercera orden de la misma butaca ya la ve "vendida" (filtro rápido de UX).
      const tercera = await crearOrdenAsiento(comprador);
      expect(tercera.status).toBe(409);
      expect(tercera.body.error.codigo).toBe("BUTACA_NO_DISPONIBLE");

      const butacas = await api(app).get(`/api/v1/ventas/eventos/${eventoId}/butacas`);
      const laNuestra = ButacasVentaSchema.parse(butacas.body).find((b) => b.asiento_id === asientoId);
      expect(laNuestra?.estado).toBe("vendida");

      const mias = MisEntradasSchema.parse((await api(app, comprador.token).get("/api/v1/ventas/mis-entradas")).body);
      const propia = mias.find((e) => e.id === ganadora.entradas[0]!.id);
      expect(propia).toMatchObject({ asiento: { seccion: "Platea baja", fila: "A", numero: 1 } });
    },
  );

  it("venta cerrada: si el evento ya empezó → 409 VENTA_CERRADA, sin tocar la butaca", async () => {
    const otraSede = MapaSedeSchema.parse((await api(app, organizador.token).post("/api/v1/eventos/sedes")
      .send(entradaDeCroquis(`Teatro cerrado ${randomUUID().slice(0, 8)}`))).body);
    const otroAsiento = otraSede.secciones[0]!.filas[0]!.bloques[0]!.asientos[0]!.id;
    const alta = await api(app, organizador.token).post("/api/v1/eventos").field("datos", JSON.stringify({
      titulo: "Función cerrada", categoria: "teatro", descripcion: "Evento de prueba de venta cerrada.",
      inicio: "2030-11-20T20:00:00-05:00", aforo: 643, hay_musica: false,
      sede: { tipo: "existente", sede_id: otraSede.id },
      categorias: [{ nombre: "Única", precio_centimos: PRECIO }],
    })).attach("foto", PNG, "foto.png");
    const creado = EventoCreadoSchema.parse(alta.body);
    const otroEventoId = creado.evento.id;
    const categoriaId = creado.categorias[0]!.id;
    const rangos = otraSede.secciones.flatMap((seccion) =>
      seccion.tipo !== "numerada" ? [] : seccion.filas.map((fila) => {
        const numeros = fila.bloques.flatMap((b) => b.asientos.map((a) => a.numero));
        return { categoria_id: categoriaId, seccion: seccion.nombre, fila: fila.nombre, desde: Math.min(...numeros), hasta: Math.max(...numeros) };
      }),
    );
    expect((await api(app, organizador.token).put(`/api/v1/eventos/${otroEventoId}/precios`).send({ rangos })).status).toBe(200);
    expect((await api(app, admin.token).patch(`/api/v1/eventos/${otroEventoId}/aprobar`)).status).toBe(200);
    expect((await api(app, organizador.token).post(`/api/v1/eventos/${otroEventoId}/publicar`)).status).toBe(200);

    const bd = clienteAdminDePrueba();
    expect((await bd.from("eventos_eventos").update({ inicio: new Date(Date.now() - 60_000).toISOString() }).eq("id", otroEventoId)).error).toBeNull();

    const respuesta = await api(app, comprador.token).post("/api/v1/ventas/ordenes/asiento")
      .send({ evento_id: otroEventoId, asiento_id: otroAsiento });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe("VENTA_CERRADA");

    expect((await bd.from("eventos_eventos").delete().eq("id", otroEventoId)).error).toBeNull();
    expect((await bd.from("eventos_sedes").delete().eq("id", otraSede.id)).error).toBeNull();
  });

  it("sin sesión → 401; roles: cualquier cuenta con perfil puede crear la orden", async () => {
    expect((await api(app).post("/api/v1/ventas/ordenes/asiento").send({ evento_id: eventoId, asiento_id: asientoId })).status).toBe(401);
  });
});
