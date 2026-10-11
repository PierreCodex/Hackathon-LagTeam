import { ServiceUnavailableException } from "@nestjs/common";
import { CODIGOS_MARKETING } from "@reto18/shared";
import { describe, expect, it, vi } from "vitest";
import type { EventoParaPieza, EventosService } from "../eventos/eventos.service.js";
import type { IaService } from "../ia/ia.service.js";
import { respaldoTextosYCampana } from "../ia/funciones/textos-y-campana.js";
import type { ClienteSupabase } from "../supabase/supabase.module.js";
import { MarketingService } from "./marketing.service.js";

const ORGANIZADOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EVENTO = "11111111-1111-4111-8111-111111111111";
const PIEZA = "22222222-2222-4222-8222-222222222222";

const EVENTO_APROBADO: EventoParaPieza = {
  id: EVENTO,
  organizador_id: ORGANIZADOR,
  estado: "aprobado",
  titulo: "Noche de música piurana",
  descripcion: "Concierto.",
  categoria: "musica",
  inicio: "2030-11-21T01:00:00+00:00",
  distrito: "Piura",
  foto_url: null,
  sede: { nombre: "Teatro", direccion: "Jr. Prueba 123" },
  precio_minimo_centimos: 4000,
};

type Respuesta = { data: unknown; error: { message: string } | null };

/** Cliente simulado: `single` responde al insert y `maybeSingle` a la lectura. */
function servicio(cliente: { insert?: Respuesta; lectura?: Respuesta } | null) {
  const consulta = {
    insert: () => consulta,
    select: () => consulta,
    eq: () => consulta,
    abortSignal: () => consulta,
    single: async () => cliente?.insert,
    maybeSingle: async () => cliente?.lectura,
  };
  const supabase = cliente ? ({ from: () => consulta } as unknown as ClienteSupabase) : null;
  const eventos = { datosParaPieza: vi.fn(async () => EVENTO_APROBADO) };
  const ia = {
    textosYCampana: vi.fn(async () => ({ origen: "respaldo" as const, valor: respaldoTextosYCampana({
      ...EVENTO_APROBADO,
      sede: "Teatro",
      direccion: "Jr. Prueba 123",
    }) })),
  };
  return {
    marketing: new MarketingService(supabase, eventos as unknown as EventosService, ia as unknown as IaService),
    eventos,
    ia,
  };
}

async function esperar503(promesa: Promise<unknown>) {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ServiceUnavailableException);
  expect((error as ServiceUnavailableException).getResponse()).toMatchObject({ codigo: CODIGOS_MARKETING.BD_NO_DISPONIBLE });
}

describe("MarketingService: 503 BD_NO_DISPONIBLE", () => {
  it("si falla el insert de la pieza en generarPieza", async () => {
    const { marketing, ia } = servicio({ insert: { data: null, error: { message: "caída" } } });
    await esperar503(marketing.generarPieza(ORGANIZADOR, EVENTO));
    expect(ia.textosYCampana).toHaveBeenCalledOnce();
  });

  it("si falla la lectura (maybeSingle) en obtenerPieza", async () => {
    const { marketing, eventos } = servicio({ lectura: { data: null, error: { message: "caída" } } });
    await esperar503(marketing.obtenerPieza(PIEZA));
    expect(eventos.datosParaPieza).not.toHaveBeenCalled();
  });

  it("si el cliente de Supabase es null (sin configurar), en las dos rutas", async () => {
    const { marketing, eventos, ia } = servicio(null);
    await esperar503(marketing.generarPieza(ORGANIZADOR, EVENTO));
    await esperar503(marketing.obtenerPieza(PIEZA));
    expect(eventos.datosParaPieza).not.toHaveBeenCalled();
    expect(ia.textosYCampana).not.toHaveBeenCalled();
  });
});
