import { BadGatewayException, ServiceUnavailableException } from "@nestjs/common";
import { CODIGOS_MARKETING, type Enlace, type Pieza } from "@reto18/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventosService } from "../eventos/eventos.service.js";
import type { IaService } from "../ia/ia.service.js";
import type { ClienteSupabase } from "../supabase/supabase.module.js";
import type { VentasService } from "../ventas/ventas.service.js";
import { MarketingService, textoPorDefecto } from "./marketing.service.js";
import { leerResultado, type PublicadorUploadPost } from "./publicador-upload-post.js";

// Historia 3.4: "Publicar ahora" con Upload-Post simulado (el plan gratis da 10 llamadas al mes).

const ORGANIZADOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EVENTO = "11111111-1111-4111-8111-111111111111";
const PIEZA_ID = "22222222-2222-4222-8222-222222222222";
const CREADO = "2026-10-11T12:00:00.000+00:00";

const PIEZA: Pieza = {
  id: PIEZA_ID,
  evento_id: EVENTO,
  origen: "ia",
  textos: { titular: "Noche de marinera", subtitulo: "Baile norteño", llamado: "Separa tu entrada", descripcion: "Una noche." },
  paleta: { fondo: "#1A1A2E", texto: "#FFFFFF", acento: "#E94560" },
  campana: {
    publico: "Familias de Piura",
    reparto: [{ red: "instagram", soles: 60 }],
    resumen: "Campaña corta.",
    presupuesto_total_soles: 60,
    calendario: [{ dias_antes: 2, fecha: "2030-10-14", hora: "19:00", accion: "Publica el flyer" }],
  },
  datos: {
    evento_id: EVENTO,
    titulo: "Noche de marinera",
    inicio: "2030-10-16T20:00:00-05:00",
    sede: "Teatro Municipal",
    direccion: "Av. Grau 123",
    distrito: "Piura",
    precio_minimo_centimos: 2500,
    foto_url: null,
  },
  creado_en: CREADO,
};

const ENLACE: Enlace = { codigo: "aZ09bY18", evento_id: EVENTO, pieza_id: PIEZA_ID, red: null, zona: null, creado_en: CREADO };

function servicio({ configurado = true, publicar = vi.fn() } = {}) {
  const publicador = { configurado: () => configurado, publicarFoto: publicar };
  const marketing = new MarketingService(
    {} as unknown as ClienteSupabase,
    {} as unknown as EventosService,
    {} as unknown as IaService,
    {} as unknown as VentasService,
    publicador as unknown as PublicadorUploadPost,
  );
  const obtenerPieza = vi.spyOn(marketing, "obtenerPieza").mockResolvedValue(PIEZA);
  const crearEnlace = vi.spyOn(marketing, "crearEnlace").mockResolvedValue(ENLACE);
  return { marketing, publicar, obtenerPieza, crearEnlace };
}

describe("MarketingService.publicarPieza (3.4)", () => {
  beforeEach(() => vi.stubEnv("WEB_URL", "https://web.example/,http://localhost:3000"));
  afterEach(() => vi.unstubAllEnvs());

  it("publica el PNG 4:5 de la web con el texto de la pieza y el enlace rastreable", async () => {
    const publicar = vi.fn(async () => ({
      programada: false,
      redes: [
        { red: "instagram" as const, ok: true, url: "https://instagram.com/p/1", error: null },
        { red: "facebook" as const, ok: true, url: null, error: null },
      ],
    }));
    const { marketing, crearEnlace } = servicio({ publicar });
    const r = await marketing.publicarPieza(ORGANIZADOR, PIEZA_ID, { redes: ["instagram", "facebook"] });

    expect(crearEnlace).toHaveBeenCalledWith(ORGANIZADOR, PIEZA_ID, { red: undefined });
    const texto = `${textoPorDefecto(PIEZA)}\n\nEntradas: https://web.example/r/aZ09bY18`;
    expect(publicar).toHaveBeenCalledWith({
      redes: ["instagram", "facebook"],
      imagenUrl: `https://web.example/piezas/${PIEZA_ID}/4x5`,
      texto,
      programarPara: undefined,
    });
    expect(r).toMatchObject({ pieza_id: PIEZA_ID, url_enlace: "https://web.example/r/aZ09bY18", texto, programada: false });
    expect(r.redes).toHaveLength(2);
  });

  it("con una sola red, el enlace lleva esa red; respeta el texto propio y la programación", async () => {
    const publicar = vi.fn(async () => ({ programada: true, redes: [{ red: "facebook" as const, ok: true, url: null, error: null }] }));
    const { marketing, crearEnlace } = servicio({ publicar });
    await marketing.publicarPieza(ORGANIZADOR, PIEZA_ID, {
      redes: ["facebook"],
      texto: "Ven al teatro",
      programar_para: "2030-10-14T19:00:00-05:00",
    });
    expect(crearEnlace).toHaveBeenCalledWith(ORGANIZADOR, PIEZA_ID, { red: "facebook" });
    expect(publicar).toHaveBeenCalledWith(
      expect.objectContaining({ texto: "Ven al teatro\n\nEntradas: https://web.example/r/aZ09bY18", programarPara: "2030-10-14T19:00:00-05:00" }),
    );
  });

  it.each([
    ["sin UPLOADPOST_API_KEY", false, "https://web.example"],
    ["sin WEB_URL", true, ""],
  ])("%s: 503 PUBLICACION_NO_CONFIGURADA, sin crear enlace", async (_caso, configurado, web) => {
    vi.stubEnv("WEB_URL", web);
    const { marketing, crearEnlace, publicar } = servicio({ configurado });
    const error = await marketing.publicarPieza(ORGANIZADOR, PIEZA_ID, { redes: ["instagram"] }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({ codigo: CODIGOS_MARKETING.PUBLICACION_NO_CONFIGURADA });
    expect(crearEnlace).not.toHaveBeenCalled();
    expect(publicar).not.toHaveBeenCalled();
  });

  it("si Upload-Post falla: 502 PUBLICACION_FALLIDA con el motivo", async () => {
    const publicar = vi.fn(async () => {
      throw new Error("Límite mensual alcanzado");
    });
    const { marketing } = servicio({ publicar });
    const error = await marketing.publicarPieza(ORGANIZADOR, PIEZA_ID, { redes: ["instagram"] }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadGatewayException);
    const cuerpo = (error as BadGatewayException).getResponse() as { codigo: string; mensaje: string };
    expect(cuerpo.codigo).toBe(CODIGOS_MARKETING.PUBLICACION_FALLIDA);
    expect(cuerpo.mensaje).toContain("Límite mensual alcanzado");
  });
});

describe("leerResultado de Upload-Post", () => {
  it("lee el detalle por red", () => {
    const r = leerResultado(
      {
        success: true,
        results: { instagram: { success: true, url: "https://instagram.com/p/1" }, facebook: { success: false, error: "Token vencido" } },
      },
      ["instagram", "facebook"],
      false,
    );
    expect(r.redes).toEqual([
      { red: "instagram", ok: true, url: "https://instagram.com/p/1", error: null },
      { red: "facebook", ok: false, url: null, error: "Token vencido" },
    ]);
  });

  it("programada, sin detalle por red: vale el `success` general", () => {
    const r = leerResultado({ success: true, job_id: "j1" }, ["instagram"], true);
    expect(r).toEqual({ programada: true, redes: [{ red: "instagram", ok: true, url: null, error: null }] });
  });
});
