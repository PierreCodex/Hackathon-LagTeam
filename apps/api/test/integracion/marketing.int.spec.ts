import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { JSON_SCHEMA_RESPUESTA_IA_TEXTOS_Y_CAMPANA, PiezaSchema } from "@reto18/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearAppDePrueba } from "./ayudas/app.js";
import { api } from "./ayudas/http.js";
import { clienteAdminDePrueba, clientePublicoDePrueba, entornoDePrueba } from "./ayudas/supabase.js";
import { tokenPorRol, type UsuarioDePrueba } from "./ayudas/tokens.js";

const SEDE_ID = "13100000-0000-4000-8000-000000000001";
const SEDE = { nombre: "Teatro de ejemplo de Piura", direccion: "Sede ficticia · centro de Piura" };
/** Evento aprobado de la semilla, de otro organizador. */
const EVENTO_AJENO = "13600000-0000-4000-8000-000000000001";
const INICIO = "2030-11-20T20:00:00-05:00";
const FOTO = "https://example.com/foto-prueba.png";
const TIEMPO_LIMITE_MS = 1500;

const RESPUESTA_IA = {
  textos: {
    titular: "La música de Piura suena fuerte",
    subtitulo: "Una noche con artistas de casa",
    llamado: "Separa tu entrada",
    descripcion: "Ven con tus amigos a disfrutar de la música piurana en vivo.",
  },
  paleta: { fondo: "#111111", texto: "#FFFFFF", acento: "#FFCC00" },
  campana: {
    publico: "Jóvenes de Piura de 18 a 35 años",
    reparto: [
      { red: "instagram", soles: 40 },
      { red: "facebook", soles: 20 },
    ],
    calendario: [
      { dias_antes: 5, hora: "19:00", accion: "Publicación en el feed" },
      { dias_antes: 1, hora: "19:00", accion: "Historia en Instagram" },
    ],
    resumen: "Invierte 60 soles: 40 en Instagram y 20 en Facebook.",
  },
};

type ModoOllama = "ok" | "lento" | "roto";

/** Ollama falso: un servidor HTTP local que imita `POST /api/chat`. */
class OllamaFalso {
  modo: ModoOllama = "ok";
  peticiones: Record<string, unknown>[] = [];
  private servidor!: Server;

  async iniciar(): Promise<string> {
    this.servidor = createServer(async (req, res) => {
      const cuerpo = JSON.parse(await leer(req)) as Record<string, unknown>;
      this.peticiones.push(cuerpo);
      if (this.modo === "lento") await new Promise((r) => setTimeout(r, TIEMPO_LIMITE_MS + 2000));
      if (res.destroyed) return;
      const contenido = this.modo === "roto" ? "{esto no es json" : JSON.stringify(RESPUESTA_IA);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ model: cuerpo.model, message: { role: "assistant", content: contenido }, done: true }));
    });
    await new Promise<void>((r) => this.servidor.listen(0, "127.0.0.1", r));
    return `http://127.0.0.1:${(this.servidor.address() as AddressInfo).port}`;
  }

  async cerrar(): Promise<void> {
    this.servidor.closeAllConnections();
    await new Promise<void>((r) => this.servidor.close(() => r()));
  }
}

function leer(req: IncomingMessage): Promise<string> {
  return new Promise((resolver, rechazar) => {
    let datos = "";
    req.on("data", (trozo) => (datos += trozo));
    req.on("end", () => resolver(datos));
    req.on("error", rechazar);
  });
}

/** Una URL donde no escucha nadie (Ollama apagado). */
async function urlApagada(): Promise<string> {
  const servidor = createServer();
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
  const { port } = servidor.address() as AddressInfo;
  await new Promise<void>((r) => servidor.close(() => r()));
  return `http://127.0.0.1:${port}`;
}

describe("marketing: pieza de un evento con IA o respaldo", () => {
  let app: INestApplication;
  let organizador: UsuarioDePrueba;
  let publico: UsuarioDePrueba;
  let admin: UsuarioDePrueba;
  const ollama = new OllamaFalso();
  let urlOllama: string;
  const entornoOriginal = {
    OLLAMA_URL: process.env.OLLAMA_URL,
    OLLAMA_MODELO: process.env.OLLAMA_MODELO,
    IA_TIEMPO_LIMITE_MS: process.env.IA_TIEMPO_LIMITE_MS,
  };
  const eventos = {
    aprobado: randomUUID(),
    gratuito: randomUUID(),
    pendiente: randomUUID(),
    rechazado: randomUUID(),
    /** Aprobado, pero ya empezó. */
    pasado: randomUUID(),
    /** Aprobado; una prueba lo pasa a `rechazado` después de generar su pieza. */
    se_rechaza: randomUUID(),
  };

  beforeAll(async () => {
    app = await crearAppDePrueba();
    urlOllama = await ollama.iniciar();
    [organizador, publico, admin] = await Promise.all([
      tokenPorRol("organizador"),
      tokenPorRol("publico"),
      tokenPorRol("admin"),
    ]);
    const bd = clienteAdminDePrueba();
    const filas = Object.entries(eventos).map(([clave, id]) => ({
      id,
      organizador_id: organizador.id,
      sede_id: SEDE_ID,
      titulo: `Noche de música piurana (${clave})`,
      descripcion: "Concierto de artistas locales para toda la familia.",
      categoria: "musica",
      distrito: "Piura",
      inicio: clave === "pasado" ? "2020-01-10T20:00:00-05:00" : INICIO,
      estado: clave === "pendiente" || clave === "rechazado" ? clave : "aprobado",
      aforo: 100,
      foto_url: clave === "aprobado" ? FOTO : null,
    }));
    expect((await bd.from("eventos_eventos").insert(filas)).error).toBeNull();
    const categorias = [
      ...[6000, 4000, 5000].map((precio, i) => ({ nombre: `Zona ${i + 1}`, precio, evento: eventos.aprobado })),
      ...[0, 0].map((precio, i) => ({ nombre: `Libre ${i + 1}`, precio, evento: eventos.gratuito })),
      { nombre: "General", precio: 2000, evento: eventos.pendiente },
      { nombre: "General", precio: 2000, evento: eventos.rechazado },
    ].map((c) => ({
      evento_id: c.evento,
      sede_id: SEDE_ID,
      nombre: c.nombre,
      color: "#123456",
      precio_centimos: c.precio,
    }));
    expect((await bd.from("eventos_categorias_precio").insert(categorias)).error).toBeNull();
  });

  beforeEach(() => {
    process.env.OLLAMA_URL = urlOllama;
    process.env.OLLAMA_MODELO = "modelo-prueba";
    process.env.IA_TIEMPO_LIMITE_MS = String(TIEMPO_LIMITE_MS);
    ollama.modo = "ok";
    ollama.peticiones = [];
  });

  // Corre antes que el de `limpieza.ts` (los hooks son una pila): los eventos (y sus piezas, en
  // cascada) referencian `auth.users` sin cascada y hay que borrarlos antes que a los usuarios.
  afterAll(async () => {
    await app?.close();
    await ollama.cerrar();
    for (const [clave, valor] of Object.entries(entornoOriginal)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
    const bd = clienteAdminDePrueba();
    if (organizador) {
      expect((await bd.from("marketing_piezas").delete().eq("organizador_id", organizador.id)).error).toBeNull();
      expect((await bd.from("eventos_eventos").delete().eq("organizador_id", organizador.id)).error).toBeNull();
    }
  });

  const generar = (eventoId: string, token: string | undefined = organizador.token) =>
    api(app, token).post(`/api/v1/marketing/eventos/${eventoId}/piezas`);

  async function filaGuardada(id: string) {
    const { data, error } = await clienteAdminDePrueba()
      .from("marketing_piezas")
      .select("evento_id, organizador_id, origen, textos, paleta, campana")
      .eq("id", id)
      .single();
    expect(error).toBeNull();
    return data!;
  }

  it("con Ollama respondiendo: 201, origen ia, guardada, y datos de la BD (fecha, sede, precio mínimo, foto)", async () => {
    const respuesta = await generar(eventos.aprobado);

    expect(respuesta.status).toBe(201);
    const pieza = PiezaSchema.parse(respuesta.body);
    expect(pieza.origen).toBe("ia");
    expect(pieza.evento_id).toBe(eventos.aprobado);
    expect(pieza.textos).toEqual(RESPUESTA_IA.textos);
    expect(pieza.paleta).toEqual(RESPUESTA_IA.paleta);
    expect(pieza.campana.presupuesto_total_soles).toBe(60);
    expect(pieza.campana.calendario.map((p) => p.fecha)).toEqual(["2030-11-15", "2030-11-19"]);
    expect(pieza.datos).toEqual({
      evento_id: eventos.aprobado,
      titulo: "Noche de música piurana (aprobado)",
      inicio: expect.any(String),
      sede: SEDE.nombre,
      direccion: SEDE.direccion,
      distrito: "Piura",
      precio_minimo_centimos: 4000,
      foto_url: FOTO,
    });
    expect(new Date(pieza.datos.inicio).getTime()).toBe(new Date(INICIO).getTime());

    const fila = await filaGuardada(pieza.id);
    expect(fila).toEqual({
      evento_id: eventos.aprobado,
      organizador_id: organizador.id,
      origen: "ia",
      textos: pieza.textos,
      paleta: pieza.paleta,
      campana: pieza.campana,
    });

    expect(ollama.peticiones).toHaveLength(1);
    expect(ollama.peticiones[0]).toMatchObject({
      model: "modelo-prueba",
      stream: false,
      format: JSON.parse(JSON.stringify(JSON_SCHEMA_RESPUESTA_IA_TEXTOS_Y_CAMPANA)),
    });
  });

  it("GET /marketing/piezas/:id sin sesión devuelve la misma pieza; id desconocido → 404 PIEZA_NO_ENCONTRADA", async () => {
    const creada = await generar(eventos.aprobado);
    expect(creada.status).toBe(201);

    const leida = await api(app).get(`/api/v1/marketing/piezas/${creada.body.id}`);
    expect(leida.status).toBe(200);
    expect(leida.body).toEqual(creada.body);

    for (const id of [randomUUID(), "no-es-un-uuid"]) {
      const falta = await api(app).get(`/api/v1/marketing/piezas/${id}`);
      expect(falta.status).toBe(404);
      expect(falta.body).toEqual({ error: { codigo: "PIEZA_NO_ENCONTRADA", mensaje: expect.any(String) } });
    }
  });

  it("con Ollama apagado: 201 con origen respaldo antes del tiempo límite más 1 s, con los datos reales", async () => {
    process.env.OLLAMA_URL = await urlApagada();
    const antes = Date.now();
    const respuesta = await generar(eventos.aprobado);

    expect(Date.now() - antes).toBeLessThan(TIEMPO_LIMITE_MS + 1000);
    expect(respuesta.status).toBe(201);
    const pieza = PiezaSchema.parse(respuesta.body);
    expect(pieza.origen).toBe("respaldo");
    expect(pieza.textos.subtitulo).toContain("miércoles 20 de noviembre, 20:00");
    expect(pieza.textos.subtitulo).toContain(SEDE.nombre);
    expect(pieza.textos.descripcion).toContain("S/ 40.00");
    expect(pieza.campana.presupuesto_total_soles).toBe(50);
    expect(pieza.datos.precio_minimo_centimos).toBe(4000);
    expect((await filaGuardada(pieza.id)).origen).toBe("respaldo");
  });

  it("con Ollama lento (más del tiempo límite): 201 con origen respaldo antes del tiempo límite más 1 s", async () => {
    ollama.modo = "lento";
    const antes = Date.now();
    const respuesta = await generar(eventos.aprobado);

    expect(Date.now() - antes).toBeLessThan(TIEMPO_LIMITE_MS + 1000);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.origen).toBe("respaldo");
    expect(ollama.peticiones).toHaveLength(1);
  });

  it("con respuesta inválida de la IA o sin OLLAMA_URL: 201 con origen respaldo", async () => {
    ollama.modo = "roto";
    const rota = await generar(eventos.aprobado);
    expect(rota.status).toBe(201);
    expect(rota.body.origen).toBe("respaldo");

    delete process.env.OLLAMA_URL;
    const sinUrl = await generar(eventos.aprobado);
    expect(sinUrl.status).toBe(201);
    expect(sinUrl.body.origen).toBe("respaldo");
  });

  it("evento gratuito: precio mínimo 0 y «Entrada libre», con IA y con respaldo", async () => {
    const conIa = await generar(eventos.gratuito);
    expect(conIa.status).toBe(201);
    expect(conIa.body).toMatchObject({ origen: "ia", datos: { precio_minimo_centimos: 0, foto_url: null } });
    expect(conIa.body.textos.llamado).toBe("Entrada libre");

    delete process.env.OLLAMA_URL;
    const respaldo = await generar(eventos.gratuito);
    expect(respaldo.body).toMatchObject({ origen: "respaldo", datos: { precio_minimo_centimos: 0 } });
    expect(respaldo.body.textos.llamado).toBe("Entrada libre");
    expect(respaldo.body.textos.descripcion).toContain("Entrada libre");
  });

  it("evento ajeno o inexistente: 404 EVENTO_NO_ENCONTRADO, sin llamar a la IA", async () => {
    for (const id of [EVENTO_AJENO, randomUUID(), "no-es-un-uuid"]) {
      const respuesta = await generar(id);
      expect(respuesta.status).toBe(404);
      expect(respuesta.body).toEqual({ error: { codigo: "EVENTO_NO_ENCONTRADO", mensaje: expect.any(String) } });
    }
    expect(ollama.peticiones).toHaveLength(0);
  });

  it("evento pendiente o rechazado: 409 EVENTO_NO_APROBADO", async () => {
    for (const id of [eventos.pendiente, eventos.rechazado]) {
      const respuesta = await generar(id);
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe("EVENTO_NO_APROBADO");
    }
    expect(ollama.peticiones).toHaveLength(0);
  });

  it("rol equivocado: 403 SIN_PERMISO; sin token: 401", async () => {
    for (const usuario of [publico, admin]) {
      const respuesta = await generar(eventos.aprobado, usuario.token);
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.codigo).toBe("SIN_PERMISO");
    }
    const sinToken = await api(app).post(`/api/v1/marketing/eventos/${eventos.aprobado}/piezas`);
    expect(sinToken.status).toBe(401);
  });

  it("evento aprobado que ya empezó: 409 EVENTO_FINALIZADO, sin llamar a la IA", async () => {
    const respuesta = await generar(eventos.pasado);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({ error: { codigo: "EVENTO_FINALIZADO", mensaje: expect.any(String) } });
    expect(ollama.peticiones).toHaveLength(0);
  });

  it("si el evento deja de estar aprobado, GET de su pieza → 404 PIEZA_NO_ENCONTRADA", async () => {
    const creada = await generar(eventos.se_rechaza);
    expect(creada.status).toBe(201);
    expect((await api(app).get(`/api/v1/marketing/piezas/${creada.body.id}`)).status).toBe(200);

    const cambio = await clienteAdminDePrueba()
      .from("eventos_eventos")
      .update({ estado: "rechazado", motivo_rechazo: "Prueba" })
      .eq("id", eventos.se_rechaza);
    expect(cambio.error).toBeNull();

    const leida = await api(app).get(`/api/v1/marketing/piezas/${creada.body.id}`);
    expect(leida.status).toBe(404);
    expect(leida.body).toEqual({ error: { codigo: "PIEZA_NO_ENCONTRADA", mensaje: expect.any(String) } });
  });

  it("AD-1: anon y authenticated no pueden leer ni escribir marketing_piezas", async () => {
    const { url, clavePublica } = entornoDePrueba();
    const autenticado: SupabaseClient = createClient(url, clavePublica, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${publico.token}` } },
    });
    for (const cliente of [clientePublicoDePrueba(), autenticado]) {
      const lectura = await cliente.from("marketing_piezas").select("*");
      expect(lectura.error?.code).toBe("42501");
      const insercion = await cliente.from("marketing_piezas").insert({ id: randomUUID() });
      expect(insercion.error?.code).toBe("42501");
    }
  });
});
