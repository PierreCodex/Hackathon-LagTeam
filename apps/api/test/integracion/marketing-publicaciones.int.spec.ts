import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { CODIGOS_MARKETING, PiezaSchema, PublicacionPiezaSchema } from "@reto18/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { UPLOADPOST_API } from "../../src/marketing/publicador-upload-post.js";
import { crearAppDePrueba } from "./ayudas/app.js";
import { api } from "./ayudas/http.js";
import { clienteAdminDePrueba } from "./ayudas/supabase.js";
import { tokenPorRol, type UsuarioDePrueba } from "./ayudas/tokens.js";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64");
const IA = {
  textos: { titular: "Marinera para todos", subtitulo: "La danza norteña nos reúne", llamado: "Separa tu entrada", descripcion: "Disfruta de una noche de marinera con tu familia." },
  paleta: { fondo: "#112233", texto: "#FFFFFF", acento: "#FFAA00" },
  campana: { publico: "Familias de Piura", reparto: [{ red: "instagram", soles: 40 }, { red: "facebook", soles: 20 }],
    resumen: "Comparte el flyer con tu familia.", calendario: [{ dias_antes: 2, hora: "19:00", accion: "Publica el flyer" }] },
};

describe("marketing: generación → PNG → publicación confirmada", () => {
  let app: INestApplication;
  let dueno: UsuarioDePrueba;
  let ajeno: UsuarioDePrueba;
  let publico: UsuarioDePrueba;
  const eventoId = randomUUID();
  const fetchReal = globalThis.fetch;
  let enviados: FormData[];
  let imagenes: string[];
  let respuestaVacia: boolean;

  beforeAll(async () => {
    app = await crearAppDePrueba();
    [dueno, ajeno, publico] = await Promise.all([tokenPorRol("organizador"), tokenPorRol("organizador"), tokenPorRol("publico")]);
    expect((await clienteAdminDePrueba().from("eventos_eventos").insert({
      id: eventoId, organizador_id: dueno.id, sede_id: "13100000-0000-4000-8000-000000000001",
      titulo: "Marinera de integración", descripcion: "Danza para familias de Piura.", categoria: "danza", distrito: "Piura",
      inicio: "2030-11-20T20:00:00-05:00", estado: "aprobado", aforo: 100,
    })).error).toBeNull();
  });

  beforeEach(() => {
    enviados = []; imagenes = []; respuestaVacia = false;
    vi.stubEnv("OLLAMA_URL", "http://ollama.test");
    vi.stubEnv("OLLAMA_MODELO", "modelo-prueba");
    vi.stubEnv("WEB_URL", "http://web.test");
    vi.stubEnv("UPLOADPOST_API_KEY", "clave-prueba");
    vi.stubEnv("UPLOADPOST_USER", "perfil-prueba");
    vi.stubEnv("UPLOADPOST_FACEBOOK_PAGE_ID", "pagina-prueba");
    // La app y Supabase son reales; solo se interceptan los proveedores y la plantilla web.
    vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (url === "http://ollama.test/api/chat") return Response.json({ message: { content: JSON.stringify(IA) } });
      if (url.startsWith("http://web.test/piezas/")) {
        imagenes.push(url);
        return new Response(PNG, { headers: { "content-type": "image/png" } });
      }
      if (url.startsWith(UPLOADPOST_API)) {
        if (url.endsWith("/upload_photos")) {
          enviados.push(init?.body as FormData);
          return Response.json(respuestaVacia ? {} : { success: true, request_id: "integracion-1" });
        }
        if (url.includes("/uploadposts/status?")) return Response.json({ status: "completed", results: [
          { platform: "instagram", success: true, post_url: "https://instagram.com/p/prueba" },
          { platform: "facebook", success: true, post_url: "https://facebook.com/prueba" },
        ] });
        throw new Error("Llamada de Upload-Post no prevista en la prueba");
      }
      return fetchReal(input, init);
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  afterAll(async () => {
    await app?.close();
    // Primero piezas y evento; después limpieza.ts borra los usuarios de prueba.
    const bd = clienteAdminDePrueba();
    expect((await bd.from("marketing_piezas").delete().eq("evento_id", eventoId)).error).toBeNull();
    expect((await bd.from("eventos_eventos").delete().eq("id", eventoId)).error).toBeNull();
  });

  async function generar() {
    const r = await api(app, dueno.token).post(`/api/v1/marketing/eventos/${eventoId}/piezas`);
    expect(r.status).toBe(201);
    return PiezaSchema.parse(r.body);
  }

  it("publica los textos de la pieza de IA, el PNG de su URL y el enlace almacenado", async () => {
    const pieza = await generar();
    expect(pieza.origen).toBe("ia");
    expect(pieza.textos).toEqual(IA.textos);
    const r = await api(app, dueno.token).post(`/api/v1/marketing/piezas/${pieza.id}/publicaciones`).send({ redes: ["instagram", "facebook"] });
    expect(r.status).toBe(201);
    const resultado = PublicacionPiezaSchema.parse(r.body);
    expect(resultado.redes.every((red) => red.ok)).toBe(true);
    expect(imagenes).toEqual([`http://web.test/piezas/${pieza.id}/4x5`]);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].get("title")).toContain(pieza.textos.titular);
    expect(enviados[0].get("title")).toContain(resultado.url_enlace);
    expect(Buffer.from(await (enviados[0].get("photos[]") as Blob).arrayBuffer())).toEqual(PNG);
    expect(enviados[0].getAll("platform[]")).toEqual(["instagram", "facebook"]);
    const guardado = await clienteAdminDePrueba().from("marketing_enlaces").select("pieza_id,organizador_id").eq("codigo", resultado.enlace.codigo).single();
    expect(guardado.data).toEqual({ pieza_id: pieza.id, organizador_id: dueno.id });
  });

  it("impide publicar sin sesión, con otro rol o con otro organizador, antes de tocar Upload-Post", async () => {
    const pieza = await generar();
    const ruta = `/api/v1/marketing/piezas/${pieza.id}/publicaciones`;
    for (const [token, estado] of [[undefined, 401], [publico.token, 403], [ajeno.token, 404]] as const) {
      expect((await api(app, token).post(ruta).send({ redes: ["instagram"] })).status).toBe(estado);
    }
    expect(enviados).toHaveLength(0);
    expect(imagenes).toHaveLength(0);
  });

  it("una aceptación sin resultados devuelve 502 sin confirmar y no reenvía la pieza", async () => {
    const pieza = await generar();
    respuestaVacia = true;
    const r = await api(app, dueno.token).post(`/api/v1/marketing/piezas/${pieza.id}/publicaciones`).send({ redes: ["facebook"] });
    expect(r.status).toBe(502);
    expect(r.body.error.codigo).toBe(CODIGOS_MARKETING.PUBLICACION_SIN_CONFIRMAR);
    expect(r.body.error.mensaje).toContain("antes de volver a publicar");
    expect(enviados).toHaveLength(1);
  });
});
