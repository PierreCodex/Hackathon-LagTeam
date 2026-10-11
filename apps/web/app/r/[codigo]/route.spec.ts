import { CODIGOS_MARKETING } from "@reto18/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pedirApi } from "@/lib/api";
import { dynamic, GET, HEAD } from "./route";

vi.mock("@/lib/api", () => ({ pedirApi: vi.fn() }));

const pedir = vi.mocked(pedirApi);
const EVENTO = "11111111-1111-4111-8111-111111111111";
const llamar = (codigo: string) =>
  GET(new Request(`https://web.example/r/${codigo}`), { params: Promise.resolve({ codigo }) });

// Casos de `/r/:codigo` de la tabla de la historia 3.2.
describe("GET /r/:codigo (3.2)", () => {
  beforeEach(() => pedir.mockReset());

  it("es dinámica: cada visita cuenta", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("código válido: registra el clic y responde 307 a la ficha con ?ref", async () => {
    pedir.mockResolvedValue({ ok: true, datos: { codigo: "aZ09bY18", evento_id: EVENTO } });
    const res = await llamar("aZ09bY18");
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe(`https://web.example/eventos/${EVENTO}?ref=aZ09bY18`);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(pedir).toHaveBeenCalledWith("marketing/enlaces/aZ09bY18/clics", expect.anything(), {
      metodo: "POST",
      tiempoLimiteMs: 3000,
    });
  });

  it("formato inválido: 307 al catálogo sin llamar a la API", async () => {
    for (const codigo of ["corto", "demasiado-largo", "abc%24efgh", "abcd.efg"]) {
      const res = await llamar(codigo);
      expect(res.status).toBe(307);
      expect(res.headers.get("Location")).toBe("https://web.example/");
    }
    expect(pedir).not.toHaveBeenCalled();
  });

  it("código desconocido o API caída: 307 al catálogo, sin pantalla de error", async () => {
    for (const codigo of [CODIGOS_MARKETING.ENLACE_NO_ENCONTRADO, "SIN_CONEXION", "RESPUESTA_INVALIDA", "BD_NO_DISPONIBLE"]) {
      pedir.mockResolvedValueOnce({ ok: false, error: { codigo, mensaje: "falla" } });
      const res = await llamar("aZ09bY18");
      expect(res.status).toBe(307);
      expect(res.headers.get("Location")).toBe("https://web.example/");
    }
  });

  it("HEAD: 307 al catálogo sin registrar clic", async () => {
    const res = HEAD(new Request("https://web.example/r/aZ09bY18", { method: "HEAD" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("https://web.example/");
    expect(pedir).not.toHaveBeenCalled();
  });

  it("bot de vista previa: 307 al catálogo sin registrar clic", async () => {
    for (const ua of [
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "WhatsApp/2.23.20.0",
      "Twitterbot/1.0",
      "TelegramBot (like TwitterBot)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0)",
    ]) {
      const res = await GET(new Request("https://web.example/r/aZ09bY18", { headers: { "user-agent": ua } }), {
        params: Promise.resolve({ codigo: "aZ09bY18" }),
      });
      expect(res.status, ua).toBe(307);
      expect(res.headers.get("Location")).toBe("https://web.example/");
    }
    expect(pedir).not.toHaveBeenCalled();
  });
});
