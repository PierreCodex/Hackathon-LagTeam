import { AuthInvalidJwtError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClienteSupabase } from "../supabase/supabase.module.js";
import { TIEMPO_LIMITE_AUTH_MS, VerificadorToken } from "./verificador-token.js";

type RespuestaClaims = { data: { claims: Record<string, unknown> } | null; error: unknown };

/** Cliente simulado: solo `auth.getClaims(jwt)`. */
function clienteSimulado(respuesta: Promise<RespuestaClaims>) {
  const getClaims = vi.fn<(jwt: string) => Promise<RespuestaClaims>>(() => respuesta);
  return { cliente: { auth: { getClaims } } as unknown as ClienteSupabase, getClaims };
}

describe("VerificadorToken", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve id y correo de un token válido", async () => {
    const { cliente, getClaims } = clienteSimulado(
      Promise.resolve({ data: { claims: { sub: "u-1", email: "ana@ejemplo.pe" } }, error: null }),
    );

    const resultado = await new VerificadorToken(cliente).verificar("jwt-bueno");

    expect(getClaims).toHaveBeenCalledWith("jwt-bueno");
    expect(resultado).toEqual({
      estado: "valido",
      identidad: { id: "u-1", correo: "ana@ejemplo.pe" },
    });
  });

  it("marca inválido un token caducado o falso", async () => {
    const { cliente } = clienteSimulado(
      Promise.resolve({ data: null, error: new AuthInvalidJwtError("Invalid JWT signature") }),
    );

    expect(await new VerificadorToken(cliente).verificar("jwt-falso")).toEqual({
      estado: "invalido",
    });
  });

  it("marca inválido un JWT del proyecto sin cuenta (sin `sub`, p. ej. la clave anon)", async () => {
    const { cliente } = clienteSimulado(
      Promise.resolve({ data: { claims: { role: "anon" } }, error: null }),
    );

    expect(await new VerificadorToken(cliente).verificar("clave-anon")).toEqual({
      estado: "invalido",
    });
  });

  it("marca inválido si getClaims lanza un error que no es de red", async () => {
    const { cliente } = clienteSimulado(Promise.reject(new Error("Invalid alg claim")));

    expect(await new VerificadorToken(cliente).verificar("jwt-raro")).toEqual({
      estado: "invalido",
    });
  });

  it("distingue Auth caído (error de red) de un token inválido", async () => {
    const { cliente } = clienteSimulado(
      Promise.resolve({ data: null, error: new AuthRetryableFetchError("fetch failed", 0) }),
    );

    expect(await new VerificadorToken(cliente).verificar("jwt")).toEqual({
      estado: "no_disponible",
    });
  });

  it("devuelve no_disponible si Auth no responde en el tiempo límite", async () => {
    vi.useFakeTimers();
    const { cliente } = clienteSimulado(new Promise<RespuestaClaims>(() => {}));

    const pendiente = new VerificadorToken(cliente).verificar("jwt");
    await vi.advanceTimersByTimeAsync(TIEMPO_LIMITE_AUTH_MS);

    expect(TIEMPO_LIMITE_AUTH_MS).toBe(3000);
    expect(await pendiente).toEqual({ estado: "no_disponible" });
  });

  it("devuelve no_disponible si la API no tiene configurado Supabase", async () => {
    expect(await new VerificadorToken(null).verificar("jwt")).toEqual({
      estado: "no_disponible",
    });
  });
});
