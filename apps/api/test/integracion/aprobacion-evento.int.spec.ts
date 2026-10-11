import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { ConstanciaEventoSchema, EventoRevisionSchema, ListaEventosRevisionSchema } from "@reto18/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ArchivosEventos, BUCKET_CONSTANCIAS } from "../../src/eventos/archivos-eventos.js";
import { SEDE_CROQUIS_ID } from "../fixtures/croquis.js";
import { crearAppDePrueba } from "./ayudas/app.js";
import { api } from "./ayudas/http.js";
import { clienteAdminDePrueba } from "./ayudas/supabase.js";
import { tokenPorRol, type UsuarioDePrueba } from "./ayudas/tokens.js";

const RUTA = "/api/v1/eventos";

describe("revisión administrativa HTTP y persistencia", () => {
  let app: INestApplication;
  let admin: UsuarioDePrueba;
  let organizador: UsuarioDePrueba;
  let otro: UsuarioDePrueba;
  let publico: UsuarioDePrueba;
  const archivos: string[] = [];

  beforeAll(async () => {
    app = await crearAppDePrueba();
    [admin, organizador, otro, publico] = await Promise.all([
      tokenPorRol("admin"), tokenPorRol("organizador"), tokenPorRol("organizador"), tokenPorRol("publico"),
    ]);
  });
  afterAll(async () => {
    await app?.close();
    const bd = clienteAdminDePrueba();
    const ids = [organizador, otro].filter(Boolean).map((u) => u.id);
    if (ids.length) expect((await bd.from("eventos_eventos").delete().in("organizador_id", ids)).error).toBeNull();
    if (archivos.length) expect((await bd.storage.from(BUCKET_CONSTANCIAS).remove(archivos)).error).toBeNull();
  });

  async function crear(cambios: Record<string, unknown> = {}) {
    const { data, error } = await clienteAdminDePrueba().from("eventos_eventos").insert({
      id: randomUUID(), organizador_id: organizador.id, sede_id: SEDE_CROQUIS_ID,
      titulo: "Evento de revisión", descripcion: "Evento creado para verificar decisiones administrativas.",
      categoria: "otro", distrito: "Piura", inicio: "2030-11-20T20:00:00-05:00", aforo: 100,
      ...cambios,
    }).select("*").single();
    expect(error).toBeNull();
    return EventoRevisionSchema.parse(data);
  }
  async function leer(id: string) {
    const { data, error } = await clienteAdminDePrueba().from("eventos_eventos").select("*").eq("id", id).single();
    expect(error).toBeNull();
    return EventoRevisionSchema.parse(data);
  }
  function actuar(token: string | undefined, id: string, accion: string, cuerpo: object = {}) {
    return api(app, token).patch(`${RUTA}/${id}/${accion}`).send(cuerpo);
  }

  it("aprueba, limpia motivo y persiste activar/desactivar destacado", async () => {
    const evento = await crear({ motivo_rechazo: "Dato anterior" });
    const respuesta = await actuar(admin.token, evento.id, "aprobar");
    expect(respuesta.status).toBe(200);
    expect(EventoRevisionSchema.parse(respuesta.body)).toMatchObject({ estado: "aprobado", motivo_rechazo: null, alerta_apdayc: null });
    expect(await leer(evento.id)).toMatchObject({ estado: "aprobado", motivo_rechazo: null });
    for (const destacado of [true, false]) {
      const cambio = await actuar(admin.token, evento.id, "destacado", { destacado });
      expect(cambio.status).toBe(200);
      expect(cambio.body.destacado).toBe(destacado);
      expect((await leer(evento.id)).destacado).toBe(destacado);
    }
  });

  it("rechaza y el motivo exacto aparece solo en los eventos de su organizador", async () => {
    const evento = await crear({ destacado: true });
    const ajeno = await crear({ organizador_id: otro.id });
    const motivo = "Falta la constancia de APDAYC.";
    const respuesta = await actuar(admin.token, evento.id, "rechazar", { motivo_rechazo: `  ${motivo}  ` });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ estado: "rechazado", motivo_rechazo: motivo, destacado: false });
    expect(await leer(evento.id)).toMatchObject({ estado: "rechazado", motivo_rechazo: motivo, destacado: false });
    const propios = await api(app, organizador.token).get(`${RUTA}/mis-eventos?organizador_id=${otro.id}`);
    expect(propios.status).toBe(200);
    const lista = ListaEventosRevisionSchema.parse(propios.body);
    expect(lista).toContainEqual(expect.objectContaining({ id: evento.id, motivo_rechazo: motivo }));
    expect(lista.every((e) => e.organizador_id === organizador.id)).toBe(true);
    expect(lista.some((e) => e.id === ajeno.id)).toBe(false);
    const ajenos = await api(app, otro.token).get(`${RUTA}/mis-eventos?organizador_id=${organizador.id}`);
    expect(ajenos.body.some((e: { id: string }) => e.id === evento.id)).toBe(false);
  });

  it("pendientes devuelve solo pendientes, incluye alerta y mantiene orden estable", async () => {
    const evento = await crear({ alerta_apdayc: "Revisar DJ" });
    const respuesta = await api(app, admin.token).get(`${RUTA}/pendientes`);
    expect(respuesta.status).toBe(200);
    const lista = ListaEventosRevisionSchema.parse(respuesta.body);
    expect(lista.every((e) => e.estado === "pendiente")).toBe(true);
    expect(lista).toContainEqual(expect.objectContaining({ id: evento.id, alerta_apdayc: "Revisar DJ", constancia_apdayc_url: null }));
    expect(lista.map((e) => e.id)).toEqual([...lista].sort((a, b) =>
      Date.parse(a.inicio) - Date.parse(b.inicio) || a.id.localeCompare(b.id)).map((e) => e.id));
  });

  it.each(["pendientes", "constancia", "aprobar", "rechazar", "destacado"])(
    "solo admin accede a %s", async (accion) => {
      const evento = await crear(accion === "destacado" ? { estado: "aprobado" } : {});
      const llamar = (token?: string) => accion === "pendientes" ? api(app, token).get(`${RUTA}/pendientes`)
        : accion === "constancia" ? api(app, token).get(`${RUTA}/${evento.id}/constancia`)
        : actuar(token, evento.id, accion, { motivo_rechazo: "Revisar", destacado: true });
      for (const usuario of [organizador, otro, publico]) expect((await llamar(usuario.token)).status).toBe(403);
      expect((await llamar()).status).toBe(401);
      expect(await leer(evento.id)).toEqual(evento);
      expect((await llamar(admin.token)).status).toBe(200);
    },
  );

  it("mis-eventos es exclusivo de organizador", async () => {
    for (const usuario of [admin, publico]) expect((await api(app, usuario.token).get(`${RUTA}/mis-eventos`)).status).toBe(403);
    expect((await api(app).get(`${RUTA}/mis-eventos`)).status).toBe(401);
  });

  it.each(["aprobar", "rechazar", "destacado", "constancia"])("UUID inválido/inexistente en %s → 400/404", async (accion) => {
    for (const [id, estado] of [["invalido", 400], [randomUUID(), 404]] as const) {
      const resultado = accion === "constancia" ? await api(app, admin.token).get(`${RUTA}/${id}/constancia`)
        : await actuar(admin.token, id, accion, { motivo_rechazo: "Revisar", destacado: false });
      expect(resultado.status).toBe(estado);
      expect(resultado.body.error.codigo).toBe(estado === 404 ? "EVENTO_NO_EXISTE" : "PETICION_INVALIDA");
    }
  });

  it.each([{}, { motivo_rechazo: " " }, { motivo_rechazo: "x".repeat(601) }, { motivo_rechazo: 42 }])(
    "rechazo inválido no modifica el evento %#", async (cuerpo) => {
      const evento = await crear();
      expect((await actuar(admin.token, evento.id, "rechazar", cuerpo)).status).toBe(400);
      expect(await leer(evento.id)).toEqual(evento);
    },
  );
  it.each([{}, { destacado: "false" }, { destacado: 0 }, { destacado: null }])(
    "destacado inválido no modifica el evento %#", async (cuerpo) => {
      const evento = await crear({ estado: "aprobado" });
      expect((await actuar(admin.token, evento.id, "destacado", cuerpo)).status).toBe(400);
      expect(await leer(evento.id)).toEqual(evento);
    },
  );

  it.each([
    ["aprobado", "aprobar"], ["aprobado", "rechazar"], ["rechazado", "aprobar"],
    ["rechazado", "rechazar"], ["pendiente", "destacado"], ["rechazado", "destacado"],
  ])("estado %s incompatible con %s → 409 sin cambios", async (estado, accion) => {
    const evento = await crear({ estado });
    const resultado = await actuar(admin.token, evento.id, accion, { motivo_rechazo: "No cambiar", destacado: true });
    expect(resultado.status).toBe(409);
    expect(resultado.body.error.codigo).toBe("ESTADO_EVENTO_INCOMPATIBLE");
    expect(await leer(evento.id)).toEqual(evento);
  });

  it("dos decisiones concurrentes: una gana y la otra no sobrescribe", async () => {
    const evento = await crear();
    const [aprobacion, rechazo] = await Promise.all([
      actuar(admin.token, evento.id, "aprobar"),
      actuar(admin.token, evento.id, "rechazar", { motivo_rechazo: "Falta programa" }),
    ]);
    expect([aprobacion.status, rechazo.status].sort()).toEqual([200, 409]);
    expect(await leer(evento.id)).toEqual(EventoRevisionSchema.parse(aprobacion.status === 200 ? aprobacion.body : rechazo.body));
  });

  it("constancia privada, firma temporal abre el PDF y nunca se persiste", async () => {
    const bd = clienteAdminDePrueba();
    const buffer = Buffer.from("%PDF-1.4\nconstancia de prueba\n%%EOF");
    const subida = await new ArchivosEventos(bd).subirConstancia(organizador.id, {
      buffer, size: buffer.length, mimetype: "application/pdf",
    }, "application/pdf");
    archivos.push(subida.ruta);
    const evento = await crear({ hay_musica: true, constancia_apdayc_url: subida.url });
    expect((await fetch(subida.url)).ok).toBe(false);
    const respuesta = await api(app, admin.token).get(`${RUTA}/${evento.id}/constancia`);
    expect(respuesta.status).toBe(200);
    const { url } = ConstanciaEventoSchema.parse(respuesta.body);
    expect(url).toBeTruthy();
    const descarga = await fetch(url!);
    expect(descarga.status).toBe(200);
    expect(Buffer.from(await descarga.arrayBuffer())).toEqual(buffer);
    const token = new URL(url!).searchParams.get("token")!;
    const claims = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
    expect(claims.exp - claims.iat).toBe(300);
    expect((await leer(evento.id)).constancia_apdayc_url).toBe(subida.url);
    expect((await fetch(subida.url)).ok).toBe(false);

    const ajeno = await crear({ organizador_id: otro.id, constancia_apdayc_url: subida.url });
    const denegada = await api(app, admin.token).get(`${RUTA}/${ajeno.id}/constancia`);
    expect(denegada.status).toBe(400);
    expect(denegada.body.error.codigo).toBe("ARCHIVO_NO_VALIDO");
  });

  it("constancia ausente devuelve null; objeto desaparecido devuelve 503", async () => {
    const evento = await crear();
    expect((await api(app, admin.token).get(`${RUTA}/${evento.id}/constancia`)).body).toEqual({ url: null });
    const ruta = `${organizador.id}/${randomUUID()}.pdf`;
    const url = clienteAdminDePrueba().storage.from(BUCKET_CONSTANCIAS).getPublicUrl(ruta).data.publicUrl
      .replace("/storage/v1/object/public/", "/storage/v1/object/");
    const sinObjeto = await crear({ constancia_apdayc_url: url });
    const respuesta = await api(app, admin.token).get(`${RUTA}/${sinObjeto.id}/constancia`);
    expect(respuesta.status).toBe(503);
    expect(respuesta.body.error.codigo).toBe("STORAGE_NO_DISPONIBLE");
  });
});
