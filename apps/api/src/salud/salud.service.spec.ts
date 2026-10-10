import { SaludRespuestaSchema } from "@reto18/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClienteSupabase } from "../supabase/supabase.module.js";
import { SaludService, TIEMPO_LIMITE_BD_MS } from "./salud.service.js";

type ResultadoRpc = { data: unknown; error: { message: string } | null };

/** Cliente de Supabase simulado: solo `rpc(nombre).abortSignal(señal)`. */
function clienteSimulado(resultado: Promise<ResultadoRpc>) {
  const abortSignal = vi.fn<(senal: AbortSignal) => Promise<ResultadoRpc>>(() => resultado);
  const rpc = vi.fn<(nombre: string) => { abortSignal: typeof abortSignal }>(() => ({
    abortSignal,
  }));
  return { cliente: { rpc } as unknown as ClienteSupabase, rpc, abortSignal };
}

describe("SaludService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve bd ok con la hora de Postgres cuando Supabase responde", async () => {
    const hora = "2026-10-10T21:00:00.123456+00:00";
    const { cliente, rpc } = clienteSimulado(Promise.resolve({ data: hora, error: null }));

    const respuesta = await new SaludService(cliente).comprobar();

    expect(rpc).toHaveBeenCalledWith("salud");
    expect(respuesta).toEqual({ api: "ok", bd: "ok", hora_bd: hora });
    expect(SaludRespuestaSchema.safeParse(respuesta).success).toBe(true);
  });

  it("devuelve bd error con BD_NO_DISPONIBLE cuando Supabase devuelve un error", async () => {
    const { cliente } = clienteSimulado(
      Promise.resolve({ data: null, error: { message: "Invalid API key" } }),
    );

    const respuesta = await new SaludService(cliente).comprobar();

    expect(respuesta).toMatchObject({
      api: "ok",
      bd: "error",
      error: { codigo: "BD_NO_DISPONIBLE" },
    });
    expect(SaludRespuestaSchema.safeParse(respuesta).success).toBe(true);
  });

  it("devuelve bd error cuando Supabase no responde dentro del tiempo límite", async () => {
    vi.useFakeTimers();
    const { cliente, abortSignal } = clienteSimulado(new Promise<ResultadoRpc>(() => {}));

    const pendiente = new SaludService(cliente).comprobar();
    await vi.advanceTimersByTimeAsync(TIEMPO_LIMITE_BD_MS);
    const respuesta = await pendiente;

    expect(TIEMPO_LIMITE_BD_MS).toBe(3000);
    expect(respuesta).toMatchObject({
      api: "ok",
      bd: "error",
      error: { codigo: "BD_NO_DISPONIBLE" },
    });
    const senal = abortSignal.mock.calls[0]?.[0];
    expect(senal?.aborted).toBe(true);
  });

  it("devuelve bd error si la API no tiene configurado Supabase", async () => {
    const respuesta = await new SaludService(null).comprobar();

    expect(respuesta).toMatchObject({ bd: "error", error: { codigo: "BD_NO_DISPONIBLE" } });
  });
});
