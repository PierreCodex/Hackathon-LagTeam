import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { EventoCreadoSchema, EventoSchema, type MapaSede, type MapaSedeEntrada, MapaSedeSchema, SedeResumenSchema } from "@reto18/shared";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUCKET_FOTOS } from "../../src/eventos/archivos-eventos.js";
import { aEntrada, entradaDeCroquis, SEDE_CROQUIS_ID } from "../fixtures/croquis.js";
import { crearAppDePrueba } from "./ayudas/app.js";
import { api } from "./ayudas/http.js";
import { clienteAdminDePrueba, entornoDePrueba } from "./ayudas/supabase.js";
import { tokenPorRol, type UsuarioDePrueba } from "./ayudas/tokens.js";

const RUTA = "/api/v1/eventos";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

type SeccionNumerada = Extract<MapaSedeEntrada["secciones"][number], { tipo: "numerada" }>;

const nombreUnico = (base: string) => `${base} ${randomUUID().slice(0, 8)}`;
const zonaGeneral = (capacidad: number, orden = 1, nombre = "General") =>
  ({ nombre, orden, tipo: "general" as const, capacidad });
const soloGeneral = (capacidad: number): MapaSedeEntrada => ({
  nombre: nombreUnico("Patio de prueba"), direccion: "Jr. Prueba 123", distrito: "Castilla", secciones: [zonaGeneral(capacidad)],
});

describe("mapa de la sede y publicación contra la BD de prueba", () => {
  let app: INestApplication;
  let lucia: UsuarioDePrueba;
  let pedro: UsuarioDePrueba;
  let publico: UsuarioDePrueba;
  let admin: UsuarioDePrueba;

  beforeAll(async () => {
    app = await crearAppDePrueba();
    [lucia, pedro, publico, admin] = await Promise.all([
      tokenPorRol("organizador"),
      tokenPorRol("organizador"),
      tokenPorRol("publico"),
      tokenPorRol("admin"),
    ]);
  });

  // Antes que `limpieza.ts`: eventos y sedes referencian a los usuarios de prueba.
  afterAll(async () => {
    await app?.close();
    const bd = clienteAdminDePrueba();
    const organizadores = [lucia, pedro].filter(Boolean).map((u) => u.id);
    expect((await bd.from("eventos_eventos").delete().in("organizador_id", organizadores)).error).toBeNull();
    expect((await bd.from("eventos_sedes").delete().in("creado_por", organizadores)).error).toBeNull();
    for (const id of organizadores) {
      const { data } = await bd.storage.from(BUCKET_FOTOS).list(id);
      const rutas = (data ?? []).map((f) => `${id}/${f.name}`);
      if (rutas.length) expect((await bd.storage.from(BUCKET_FOTOS).remove(rutas)).error).toBeNull();
    }
  });

  async function crearSede(usuario: UsuarioDePrueba, entrada: MapaSedeEntrada): Promise<MapaSede> {
    const respuesta = await api(app, usuario.token).post(`${RUTA}/sedes`).send(entrada);
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(201);
    return MapaSedeSchema.parse(respuesta.body);
  }

  async function leerMapa(sedeId: string, usuario: UsuarioDePrueba = lucia): Promise<MapaSede> {
    const respuesta = await api(app, usuario.token).get(`${RUTA}/sedes/${sedeId}/mapa`);
    expect(respuesta.status).toBe(200);
    return MapaSedeSchema.parse(respuesta.body);
  }

  async function sedesDe(usuario: UsuarioDePrueba) {
    const respuesta = await api(app, usuario.token).get(`${RUTA}/sedes`);
    expect(respuesta.status).toBe(200);
    return SedeResumenSchema.array().parse(respuesta.body);
  }

  /** Evento directo en la BD (como si lo hubiera revisado el admin en la 1.5). */
  async function crearEvento(organizador: UsuarioDePrueba, sedeId: string, aforo: number, estado = "aprobado"): Promise<string> {
    const { data, error } = await clienteAdminDePrueba().from("eventos_eventos").insert({
      organizador_id: organizador.id, sede_id: sedeId, titulo: "Evento de prueba", descripcion: "Evento de prueba del mapa.",
      categoria: "teatro", distrito: "Piura", inicio: "2030-11-20T20:00:00-05:00", estado, aforo,
      motivo_rechazo: estado === "rechazado" ? "Falta información" : null,
    }).select("id").single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  const publicar = (usuario: UsuarioDePrueba, eventoId: string) => api(app, usuario.token).post(`${RUTA}/${eventoId}/publicar`);
  const reemplazar = (usuario: UsuarioDePrueba, sedeId: string, entrada: unknown) =>
    api(app, usuario.token).put(`${RUTA}/sedes/${sedeId}/mapa`).send(entrada as object);

  it("crea la sede de los croquis (643 asientos) y leerla da exactamente lo enviado", async () => {
    const entrada = entradaDeCroquis(nombreUnico("Teatro de Lucía"));
    const creada = await crearSede(lucia, entrada);

    expect(aEntrada(creada)).toEqual(entrada);
    expect(await leerMapa(creada.id)).toEqual(creada);
    const asientos = creada.secciones.flatMap((s) => s.filas.flatMap((f) => f.bloques.flatMap((b) => b.asientos)));
    expect(asientos).toHaveLength(643);
    expect(new Set(asientos.map((a) => a.id)).size).toBe(643);

    // Aparece en la lista con su capacidad; propia solo para Lucía.
    expect(await sedesDe(lucia)).toContainEqual(expect.objectContaining({ id: creada.id, capacidad: 643, propia: true }));
    expect(await sedesDe(pedro)).toContainEqual(expect.objectContaining({ id: creada.id, capacidad: 643, propia: false }));
    const { data } = await clienteAdminDePrueba().from("eventos_sedes").select("creado_por, mapa_cerrado").eq("id", creada.id).single();
    expect(data).toEqual({ creado_por: lucia.id, mapa_cerrado: false });
  });

  it("sede mixta: la capacidad suma asientos y zona general, y la 1.4 puede usarla en un alta", async () => {
    const entrada = entradaDeCroquis(nombreUnico("Sede mixta"));
    entrada.secciones.push(zonaGeneral(80, 4, "Zona general"));
    const creada = await crearSede(lucia, entrada);

    expect(aEntrada(creada)).toEqual({ ...entrada, secciones: entrada.secciones.map((s, i) => (s.tipo === "general" ? { ...s, id: creada.secciones[i]!.id } : s)) });
    expect(await sedesDe(pedro)).toContainEqual(expect.objectContaining({ id: creada.id, capacidad: 723 }));

    const alta = await api(app, lucia.token).post(RUTA).field("datos", JSON.stringify({
      titulo: "Concierto en sede mixta", categoria: "musica", descripcion: "Concierto de prueba en una sede creada por la API.",
      inicio: "2030-11-20T20:00:00-05:00", aforo: 723, hay_musica: false,
      sede: { tipo: "existente", sede_id: creada.id }, categorias: [{ nombre: "General", precio_centimos: 2000 }],
    })).attach("foto", PNG, "foto.png");
    expect(alta.status, JSON.stringify(alta.body)).toBe(201);
    expect(EventoCreadoSchema.parse(alta.body).evento).toMatchObject({ sede_id: creada.id, publicado: false });
  });

  it("reemplaza el mapa (una fila añadida y un asiento quitado) y leerlo da exactamente lo enviado", async () => {
    const creada = await crearSede(lucia, entradaDeCroquis(nombreUnico("Teatro a corregir")));
    const nuevo = aEntrada(creada);
    const platea = nuevo.secciones[0] as SeccionNumerada;
    platea.filas.push({ nombre: "Z", orden: 99, bloques: [{ orden: 1, desplazamiento: 3, asientos: [{ numero: 1 }, { numero: 2 }, { numero: 5 }] }] });
    platea.filas[0]!.bloques[0]!.asientos.splice(4, 1);
    nuevo.direccion = "Nueva dirección";

    const respuesta = await reemplazar(lucia, creada.id, nuevo);

    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);
    const guardado = MapaSedeSchema.parse(respuesta.body);
    expect(aEntrada(guardado)).toEqual(nuevo);
    expect(await leerMapa(creada.id)).toEqual(guardado);
    expect(await sedesDe(lucia)).toContainEqual(expect.objectContaining({ id: creada.id, capacidad: 643 + 3 - 1 }));
  });

  it("sede ajena (de otro organizador o sembrada) → 403 SEDE_AJENA y nada cambia", async () => {
    const creada = await crearSede(lucia, soloGeneral(50));

    const ajena = await reemplazar(pedro, creada.id, soloGeneral(10));
    expect(ajena.status).toBe(403);
    expect(ajena.body.error.codigo).toBe("SEDE_AJENA");
    expect(await leerMapa(creada.id)).toEqual(creada);

    const antes = await leerMapa(SEDE_CROQUIS_ID);
    const sembrada = await reemplazar(lucia, SEDE_CROQUIS_ID, aEntrada(antes));
    expect(sembrada.status).toBe(403);
    expect(sembrada.body.error.codigo).toBe("SEDE_AJENA");
    expect(await leerMapa(SEDE_CROQUIS_ID)).toEqual(antes);
  });

  it("aprobado sin publicar se edita; publicar cierra el mapa (409 MAPA_CERRADO) y es idempotente", async () => {
    const creada = await crearSede(lucia, soloGeneral(100));
    const eventoId = await crearEvento(lucia, creada.id, 100);

    const corregida = await reemplazar(lucia, creada.id, { ...aEntrada(creada), secciones: [{ ...aEntrada(creada).secciones[0], capacidad: 150 }] });
    expect(corregida.status, JSON.stringify(corregida.body)).toBe(200);

    const publicado = await publicar(lucia, eventoId);
    expect(publicado.status, JSON.stringify(publicado.body)).toBe(200);
    expect(EventoSchema.parse(publicado.body)).toMatchObject({ id: eventoId, estado: "aprobado", publicado: true });
    const bd = clienteAdminDePrueba();
    const evento = await bd.from("eventos_eventos").select("publicado, publicado_en").eq("id", eventoId).single();
    expect(evento.data).toMatchObject({ publicado: true, publicado_en: expect.any(String) });
    const sede = await bd.from("eventos_sedes").select("mapa_cerrado").eq("id", creada.id).single();
    expect(sede.data).toEqual({ mapa_cerrado: true });
    // `propia` = "la puedes editar": con el mapa cerrado ya no lo es.
    expect(await sedesDe(lucia)).toContainEqual(expect.objectContaining({ id: creada.id, propia: false }));

    const otraVez = await publicar(lucia, eventoId);
    expect(otraVez.status).toBe(200);
    expect(otraVez.body).toEqual(publicado.body);
    const sinCambios = await bd.from("eventos_eventos").select("publicado_en").eq("id", eventoId).single();
    expect(sinCambios.data!.publicado_en).toBe(evento.data!.publicado_en);

    const cerrada = await reemplazar(lucia, creada.id, soloGeneral(500));
    expect(cerrada.status).toBe(409);
    expect(cerrada.body.error.codigo).toBe("MAPA_CERRADO");
    expect((await leerMapa(creada.id)).secciones[0]).toMatchObject({ capacidad: 150 });

    // Ajena y cerrada: manda SEDE_AJENA.
    const ajena = await reemplazar(pedro, creada.id, soloGeneral(500));
    expect(ajena.body.error.codigo).toBe("SEDE_AJENA");

    // Duplicarla da una copia propia y abierta.
    const copia = await api(app, lucia.token).post(`${RUTA}/sedes/${creada.id}/duplicar`).send({ nombre: nombreUnico("Copia") });
    expect(copia.status).toBe(201);
    const copiaId = MapaSedeSchema.parse(copia.body).id;
    expect((await reemplazar(lucia, copiaId, soloGeneral(500))).status).toBe(200);
  });

  it.each(["pendiente", "rechazado"])("publicar un evento %s → 409 EVENTO_NO_APROBADO y nada cambia", async (estado) => {
    const creada = await crearSede(lucia, soloGeneral(100));
    const eventoId = await crearEvento(lucia, creada.id, 100, estado);

    const respuesta = await publicar(lucia, eventoId);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe("EVENTO_NO_APROBADO");
    const bd = clienteAdminDePrueba();
    expect((await bd.from("eventos_eventos").select("publicado").eq("id", eventoId).single()).data).toEqual({ publicado: false });
    expect((await bd.from("eventos_sedes").select("mapa_cerrado").eq("id", creada.id).single()).data).toEqual({ mapa_cerrado: false });
  });

  it("publicar el evento de otro organizador → 403 EVENTO_AJENO", async () => {
    const creada = await crearSede(lucia, soloGeneral(100));
    const eventoId = await crearEvento(lucia, creada.id, 100);

    const respuesta = await publicar(pedro, eventoId);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe("EVENTO_AJENO");
    expect((await clienteAdminDePrueba().from("eventos_eventos").select("publicado").eq("id", eventoId).single()).data).toEqual({ publicado: false });
  });

  it("publicar cuando el mapa recortado ya no alcanza el aforo → 409 AFORO_SUPERA_SEDE", async () => {
    const creada = await crearSede(lucia, soloGeneral(100));
    const eventoId = await crearEvento(lucia, creada.id, 100);
    expect((await reemplazar(lucia, creada.id, { ...aEntrada(creada), secciones: [{ ...aEntrada(creada).secciones[0], capacidad: 60 }] })).status).toBe(200);

    const respuesta = await publicar(lucia, eventoId);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe("AFORO_SUPERA_SEDE");
    expect((await clienteAdminDePrueba().from("eventos_sedes").select("mapa_cerrado").eq("id", creada.id).single()).data).toEqual({ mapa_cerrado: false });
  });

  it("duplicar la sede sembrada o una de Lucía: copia de Pedro con ids nuevos, editable, y la original no cambia", async () => {
    for (const origenId of [SEDE_CROQUIS_ID, (await crearSede(lucia, entradaDeCroquis(nombreUnico("Teatro original")))).id]) {
      const original = await leerMapa(origenId);
      const nombre = nombreUnico("Copia de Pedro");

      const respuesta = await api(app, pedro.token).post(`${RUTA}/sedes/${origenId}/duplicar`).send({ nombre });

      expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(201);
      const copia = MapaSedeSchema.parse(respuesta.body);
      expect(copia.id).not.toBe(origenId);
      expect(aEntrada(copia)).toEqual({ ...aEntrada(original), nombre });
      const idsOriginales = new Set(original.secciones.flatMap((s) => [s.id, ...s.filas.flatMap((f) => [f.id, ...f.bloques.flatMap((b) => [b.id, ...b.asientos.map((a) => a.id)])])]));
      const idsCopia = copia.secciones.flatMap((s) => [s.id, ...s.filas.flatMap((f) => [f.id, ...f.bloques.flatMap((b) => [b.id, ...b.asientos.map((a) => a.id)])])]);
      expect(idsCopia.some((id) => idsOriginales.has(id))).toBe(false);
      expect(await sedesDe(pedro)).toContainEqual(expect.objectContaining({ id: copia.id, propia: true }));

      const editada = aEntrada(copia);
      (editada.secciones[0] as SeccionNumerada).filas.pop();
      const guardada = await reemplazar(pedro, copia.id, editada);
      expect(guardada.status, JSON.stringify(guardada.body)).toBe(200);
      expect(await leerMapa(origenId)).toEqual(original);
    }
  });

  it("el alta de la 1.4 con sede nueva la deja a nombre del organizador", async () => {
    const nombre = nombreUnico("Patio del alta");
    const alta = await api(app, lucia.token).post(RUTA).field("datos", JSON.stringify({
      titulo: "Feria del alta", categoria: "otro", descripcion: "Evento de prueba con una sede nueva desde el alta.",
      inicio: "2030-11-20T20:00:00-05:00", aforo: 40, hay_musica: false,
      sede: { tipo: "nueva", nombre, direccion: "Jr. Alta 1", distrito: "Piura", capacidad: 40 },
      categorias: [{ nombre: "General", precio_centimos: 0 }],
    })).attach("foto", PNG, "foto.png");
    expect(alta.status, JSON.stringify(alta.body)).toBe(201);
    const sedeId = EventoCreadoSchema.parse(alta.body).evento.sede_id;

    expect(await sedesDe(lucia)).toContainEqual(expect.objectContaining({ id: sedeId, nombre, propia: true }));
    expect(await sedesDe(pedro)).toContainEqual(expect.objectContaining({ id: sedeId, propia: false }));
    expect((await clienteAdminDePrueba().from("eventos_sedes").select("creado_por").eq("id", sedeId).single()).data).toEqual({ creado_por: lucia.id });
    const mapa = await leerMapa(sedeId);
    expect((await reemplazar(lucia, sedeId, { ...aEntrada(mapa), secciones: [{ ...aEntrada(mapa).secciones[0], capacidad: 45 }] })).status).toBe(200);
  });

  it("alta de Pedro en la sede abierta de Lucía → 403 SEDE_AJENA sin evento ni archivos; en la sembrada (cerrada) sí", async () => {
    const creada = await crearSede(lucia, soloGeneral(100));
    const bd = clienteAdminDePrueba();
    const altaEn = (sedeId: string) => api(app, pedro.token).post(RUTA).field("datos", JSON.stringify({
      titulo: "Alta en sede ajena", categoria: "teatro", descripcion: "Evento de prueba en una sede de otro organizador.",
      inicio: "2030-11-20T20:00:00-05:00", aforo: 50, hay_musica: false,
      sede: { tipo: "existente", sede_id: sedeId }, categorias: [{ nombre: "General", precio_centimos: 1000 }],
    })).attach("foto", PNG, "foto.png");
    const fotosDePedro = async () => (await bd.storage.from(BUCKET_FOTOS).list(pedro.id)).data ?? [];
    const antes = (await fotosDePedro()).length;

    const ajena = await altaEn(creada.id);

    expect(ajena.status).toBe(403);
    expect(ajena.body.error.codigo).toBe("SEDE_AJENA");
    expect(ajena.body.error.mensaje).toContain("duplícalo");
    expect((await bd.from("eventos_eventos").select("id").eq("sede_id", creada.id)).data).toEqual([]);
    expect(await fotosDePedro()).toHaveLength(antes);

    const sembrada = await altaEn(SEDE_CROQUIS_ID);
    expect(sembrada.status, JSON.stringify(sembrada.body)).toBe(201);
  });

  it("zona general con categorías: quitarla → 409 SECCION_EN_USO; conservarla por su id → 200", async () => {
    const creada = await crearSede(lucia, soloGeneral(100));
    const zonaId = creada.secciones[0]!.id;
    const eventoId = await crearEvento(lucia, creada.id, 100, "pendiente");
    const bd = clienteAdminDePrueba();
    expect((await bd.from("eventos_categorias_precio").insert({
      evento_id: eventoId, sede_id: creada.id, nombre: "General", color: "#059669", precio_centimos: 1000, seccion_id: zonaId,
    })).error).toBeNull();

    const sinId = await reemplazar(lucia, creada.id, { ...soloGeneral(100), nombre: creada.nombre });
    expect(sinId.status).toBe(409);
    expect(sinId.body.error.codigo).toBe("SECCION_EN_USO");
    expect(await leerMapa(creada.id)).toEqual(creada);

    const conId = await reemplazar(lucia, creada.id, {
      ...aEntrada(creada),
      secciones: [{ id: zonaId, nombre: "Patio", orden: 2, tipo: "general", capacidad: 120 }, zonaGeneral(30, 1, "Escenario")],
    });
    expect(conId.status, JSON.stringify(conId.body)).toBe(200);
    const mapa = MapaSedeSchema.parse(conId.body);
    expect(mapa.secciones.map((s) => [s.nombre, s.orden, s.capacidad])).toEqual([["Escenario", 1, 30], ["Patio", 2, 120]]);
    expect(mapa.secciones[1]!.id).toBe(zonaId);
    const categoria = await bd.from("eventos_categorias_precio").select("seccion_id").eq("evento_id", eventoId).single();
    expect(categoria.data).toEqual({ seccion_id: zonaId });
  });

  it("mapa inválido → 400 DATOS_INVALIDOS nombrando el campo, sin guardar nada", async () => {
    const entrada = entradaDeCroquis(nombreUnico("Teatro inválido"));
    (entrada.secciones[0] as SeccionNumerada).filas[0]!.bloques[1]!.asientos[0]!.numero = 1;

    const respuesta = await api(app, lucia.token).post(`${RUTA}/sedes`).send(entrada);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe("DATOS_INVALIDOS");
    expect(respuesta.body.error.mensaje).toContain("secciones.0.filas.0.bloques.1.asientos.0.numero:");
    expect((await clienteAdminDePrueba().from("eventos_sedes").select("id").eq("nombre", entrada.nombre)).data).toEqual([]);

    const creada = await crearSede(lucia, soloGeneral(10));
    const conFilas = await reemplazar(lucia, creada.id, { ...soloGeneral(10), secciones: [{ ...zonaGeneral(10), filas: [{ nombre: "A" }] }] });
    expect(conFilas.status).toBe(400);
    expect(conFilas.body.error.mensaje).toContain("secciones.0.filas:");
    expect((await api(app, lucia.token).post(`${RUTA}/sedes/${creada.id}/duplicar`).send({ nombre: "" })).body.error.codigo).toBe("DATOS_INVALIDOS");
    expect((await api(app, lucia.token).get(`${RUTA}/sedes/no-es-un-id/mapa`)).body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("sede o evento inexistente → 404 SEDE_NO_EXISTE / EVENTO_NO_EXISTE", async () => {
    const id = randomUUID();
    const respuestas = await Promise.all([
      api(app, lucia.token).get(`${RUTA}/sedes/${id}/mapa`),
      reemplazar(lucia, id, soloGeneral(10)),
      api(app, lucia.token).post(`${RUTA}/sedes/${id}/duplicar`).send({ nombre: "Copia" }),
    ]);
    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe("SEDE_NO_EXISTE");
    }
    const evento = await publicar(lucia, id);
    expect(evento.status).toBe(404);
    expect(evento.body.error.codigo).toBe("EVENTO_NO_EXISTE");
  });

  it("roles: público no lee ni escribe; admin lee pero no escribe; sin token → 401", async () => {
    const creada = await crearSede(lucia, soloGeneral(10));
    const eventoId = await crearEvento(lucia, creada.id, 10);

    expect((await api(app, admin.token).get(`${RUTA}/sedes/${creada.id}/mapa`)).status).toBe(200);
    for (const usuario of [publico, admin]) {
      expect((await api(app, usuario.token).post(`${RUTA}/sedes`).send(soloGeneral(10))).status).toBe(403);
      expect((await reemplazar(usuario, creada.id, soloGeneral(10))).status).toBe(403);
      expect((await api(app, usuario.token).post(`${RUTA}/sedes/${creada.id}/duplicar`).send({ nombre: "Copia" })).status).toBe(403);
      expect((await publicar(usuario, eventoId)).status).toBe(403);
    }
    expect((await api(app, publico.token).get(`${RUTA}/sedes/${creada.id}/mapa`)).status).toBe(403);
    expect((await api(app).get(`${RUTA}/sedes/${creada.id}/mapa`)).status).toBe(401);
    expect((await api(app).post(`${RUTA}/sedes`).send(soloGeneral(10))).status).toBe(401);
  });

  it("las funciones del mapa no se pueden ejecutar desde el navegador (AD-1)", async () => {
    const { url, clavePublica } = entornoDePrueba();
    const navegador = createClient(url, clavePublica, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${lucia.token}` } },
    });

    const llamadas = await Promise.all([
      navegador.rpc("eventos_guardar_mapa", { p_organizador: lucia.id, p_sede_id: null, p_mapa: soloGeneral(10) }),
      navegador.rpc("eventos_leer_mapa", { p_sede_id: SEDE_CROQUIS_ID }),
      navegador.rpc("eventos_duplicar_sede", { p_organizador: lucia.id, p_sede_id: SEDE_CROQUIS_ID, p_nombre: "Copia" }),
      navegador.rpc("eventos_publicar_evento", { p_organizador: lucia.id, p_evento_id: randomUUID() }),
      navegador.rpc("eventos_listar_sedes", { p_organizador: lucia.id }),
    ]);

    for (const { error } of llamadas) expect(error?.code).toBe("42501");
  });
});
