import { CODIGOS_MARKETING } from "@reto18/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pedirApi } from "@/lib/api";
import { PIEZA } from "@/test/pieza-fixture";
import { GET } from "./route";

vi.mock("@/lib/api", () => ({ pedirApi: vi.fn() }));

const pedir = vi.mocked(pedirApi);
const llamar = (pieza: string, formato: string) =>
  GET(new Request(`http://web/piezas/${pieza}/${formato}`), { params: Promise.resolve({ pieza, formato }) });

// Casos del PNG de la tabla de la historia 3.8.
describe("GET /piezas/<id>/<formato> (3.8)", () => {
  beforeEach(() => pedir.mockReset());

  it("formato distinto de 4x5 → 404 sin leer la pieza", async () => {
    const res = await llamar("p1", "9x16");
    expect(res.status).toBe(404);
    expect(pedir).not.toHaveBeenCalled();
  });

  it("pieza inexistente → 404", async () => {
    pedir.mockResolvedValue({ ok: false, error: { codigo: CODIGOS_MARKETING.PIEZA_NO_ENCONTRADA, mensaje: "No existe" } });
    const res = await llamar("p1", "4x5");
    expect(res.status).toBe(404);
  });

  it("API caída → 503 sin caché", async () => {
    pedir.mockResolvedValue({ ok: false, error: { codigo: "SIN_CONEXION", mensaje: "Sin conexión" } });
    const res = await llamar("p1", "4x5");
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("pieza sin foto → PNG de 1080 × 1350 con caché corta", async () => {
    pedir.mockResolvedValue({ ok: true, datos: PIEZA });
    const res = await llamar(PIEZA.id, "4x5");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("max-age=60");
    const png = Buffer.from(await res.arrayBuffer());
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1350);
  });

  describe("foto WebP", () => {
    const WEBP = "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";
    afterEach(() => vi.unstubAllGlobals());

    it("pinta la foto WebP del evento (los organizadores pueden subir WebP)", async () => {
      pedir.mockResolvedValue({ ok: true, datos: PIEZA });
      const sinFoto = Buffer.from(await (await llamar(PIEZA.id, "4x5")).arrayBuffer());

      const fetchFoto = vi.fn(
        async () => new Response(Buffer.from(WEBP, "base64"), { headers: { "content-type": "image/webp" } }),
      );
      vi.stubGlobal("fetch", fetchFoto);
      pedir.mockResolvedValue({ ok: true, datos: { ...PIEZA, datos: { ...PIEZA.datos, foto_url: "https://fotos.example/evento.webp" } } });
      const res = await llamar(PIEZA.id, "4x5");

      expect(fetchFoto).toHaveBeenCalledWith("https://fotos.example/evento.webp", expect.anything());
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      const conFoto = Buffer.from(await res.arrayBuffer());
      expect(conFoto.equals(sinFoto)).toBe(false);
    });
  });
});
