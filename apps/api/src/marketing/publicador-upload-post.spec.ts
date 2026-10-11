import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTERVALO_CONSULTA_MS, leerResultado, PublicacionSinConfirmar, PublicadorUploadPost, TIEMPO_LIMITE_SUBIDA_MS } from "./publicador-upload-post.js";

const PETICION = { redes: ["instagram", "facebook"] as ("instagram" | "facebook")[], imagenUrl: "http://web.test/pieza.png", texto: "Marinera en Piura\nEntradas: https://web.test/r/abcd1234" };
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const json = (valor: unknown) => Response.json(valor);

describe("PublicadorUploadPost: transferencia y confirmación", () => {
  beforeEach(() => {
    vi.stubEnv("UPLOADPOST_API_KEY", "clave-de-prueba");
    vi.stubEnv("UPLOADPOST_USER", "perfil-prueba");
    vi.stubEnv("UPLOADPOST_FACEBOOK_PAGE_ID", "pagina-prueba");
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

  it("permite una subida de 20 segundos dentro del presupuesto total", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new Error("Tiempo agotado")), ms);
      return controller.signal;
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(PNG, { headers: { "content-type": "image/png" } }))
      .mockImplementationOnce((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        setTimeout(() => resolve(json({ request_id: "subida-lenta" })), 20_000);
      }))
      .mockResolvedValueOnce(json({ status: "completed", results: [
        { platform: "instagram", success: true }, { platform: "facebook", success: true },
      ] }));
    vi.stubGlobal("fetch", fetchMock);
    const comprobar = expect(new PublicadorUploadPost().publicarFoto(PETICION))
      .resolves.toMatchObject({ redes: [{ ok: true }, { ok: true }] });
    await vi.advanceTimersByTimeAsync(20_000);
    await comprobar;
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  });

  it("envía los bytes del PNG y el texto, espera processing y confirma cada red sin repetir el POST", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(PNG, { headers: { "content-type": "image/png" } }))
      .mockResolvedValueOnce(json({ success: true, request_id: "peticion/1" }))
      .mockResolvedValueOnce(json({ status: "processing", results: [{ platform: "instagram", success: true, message: "Queued" }] }))
      .mockResolvedValueOnce(json({ status: "completed", results: [
        { platform: "instagram", success: true, post_url: "https://instagram.com/p/1" },
        { platform: "facebook", success: false, error: "Token vencido" },
      ] }));
    vi.stubGlobal("fetch", fetchMock);
    let terminado = false;
    const promesa = new PublicadorUploadPost().publicarFoto(PETICION).then((r) => { terminado = true; return r; });
    await vi.advanceTimersByTimeAsync(0);
    expect(terminado).toBe(false);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/upload_photos");
    const form = init.body as FormData;
    expect(form.getAll("platform[]")).toEqual(PETICION.redes);
    expect(form.get("title")).toBe(PETICION.texto);
    expect(form.get("facebook_page_id")).toBe("pagina-prueba");
    expect(form.get("async_upload")).toBe("true");
    expect(new Uint8Array(await (form.get("photos[]") as Blob).arrayBuffer())).toEqual(PNG);
    expect(fetchMock.mock.calls[2][0]).toContain("request_id=peticion%2F1");
    await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_MS);
    expect((await promesa).redes).toEqual([
      { red: "instagram", ok: true, url: "https://instagram.com/p/1", error: null },
      { red: "facebook", ok: false, url: null, error: "Token vencido" },
    ]);
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  });

  it("programa con job_id y fecha UTC, sin consultas de estado ni publicación inmediata", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(PNG, { headers: { "content-type": "image/png" } }))
      .mockResolvedValueOnce(json({ success: true, job_id: "job-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await new PublicadorUploadPost().publicarFoto({ ...PETICION, programarPara: "2030-11-15T19:00:00-05:00" });
    expect(r.programada).toBe(true);
    const form = fetchMock.mock.calls[1][1].body as FormData;
    expect(form.get("scheduled_date")).toBe("2030-11-16T00:00:00.000Z");
    expect(form.has("async_upload")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([{}, null, { success: true }])("respuesta de subida incompleta %j: no confirma y pide revisar redes", async (respuesta) => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(PNG, { headers: { "content-type": "image/png" } }))
      .mockResolvedValueOnce(json(respuesta)));
    await expect(new PublicadorUploadPost().publicarFoto(PETICION)).rejects.toThrow(PublicacionSinConfirmar);
  });

  it("JSON inválido después de enviar: error de confirmación, sin repetir el envío", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(PNG, { headers: { "content-type": "image/png" } }))
      .mockResolvedValueOnce(new Response("respuesta rota"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new PublicadorUploadPost().publicarFoto(PETICION)).rejects.toThrow("Revisa Upload-Post y tus redes");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("agota el presupuesto de confirmación sin reenviar aunque el proveedor siga procesando", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(PNG, { headers: { "content-type": "image/png" } }))
      .mockResolvedValueOnce(json({ success: true, request_id: "pendiente" }))
      .mockImplementation(async () => json({ status: "processing" }));
    vi.stubGlobal("fetch", fetchMock);
    const comprobar = expect(new PublicadorUploadPost().publicarFoto(PETICION)).rejects.toThrow("Revisa Upload-Post y tus redes");
    await vi.advanceTimersByTimeAsync(TIEMPO_LIMITE_SUBIDA_MS);
    await comprobar;
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  });

  it("una respuesta HTML de la plantilla no se envía como imagen", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("error", { headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new PublicadorUploadPost().publicarFoto(PETICION)).rejects.toThrow("preparar la imagen");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("confirmación explícita del proveedor", () => {
  it.each([{}, null, [], { success: true }, { success: true, results: {} }, { results: { instagram: {} } },
    { status: "processing", results: [{ platform: "instagram", success: true }] },
    { status: "completed", results: [{ platform: "instagram", success: true, skipped: true }] },
    { results: { instagram: { success: true, status: "retryable" } } },
  ])("no presenta éxito sin evidencia terminal por red: %j", (respuesta) => {
    expect(leerResultado(respuesta, ["instagram"], false).redes[0].ok).toBe(false);
  });
  it("no confirma programación sin job_id", () => {
    expect(leerResultado({ success: true }, ["facebook"], true)).toMatchObject({ programada: false, redes: [{ ok: false }] });
  });
  it("no convierte una URL insegura en enlace de publicación", () => {
    expect(leerResultado({ results: { instagram: { success: true, url: "javascript:alert(1)" } } }, ["instagram"], false).redes[0].url).toBeNull();
  });
});
