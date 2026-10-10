import { Inject, Injectable, Logger } from "@nestjs/common";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { SUPABASE_CLIENTE, type ClienteSupabase } from "../supabase/supabase.module.js";

/** Tiempo límite de la validación del JWT (puede consultar JWKS o Auth). */
export const TIEMPO_LIMITE_AUTH_MS = 3000;

/** Identidad que garantiza un JWT válido de Supabase. El rol NO sale de aquí. */
export interface IdentidadToken {
  id: string;
  correo: string;
}

export type ResultadoVerificacion =
  | { estado: "valido"; identidad: IdentidadToken }
  | { estado: "invalido" }
  | { estado: "no_disponible" };

class TiempoLimiteAgotado extends Error {}

/** Valida el Bearer de Supabase con `auth.getClaims`. Aísla a Supabase para las pruebas. */
@Injectable()
export class VerificadorToken {
  private readonly logger = new Logger(VerificadorToken.name);

  constructor(@Inject(SUPABASE_CLIENTE) private readonly supabase: ClienteSupabase) {}

  async verificar(jwt: string): Promise<ResultadoVerificacion> {
    if (!this.supabase) {
      this.logger.warn("Supabase no está configurado: no se puede validar el token");
      return { estado: "no_disponible" };
    }

    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const limite = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(() => rechazar(new TiempoLimiteAgotado()), TIEMPO_LIMITE_AUTH_MS);
    });

    try {
      const { data, error } = await Promise.race([this.supabase.auth.getClaims(jwt), limite]);
      if (error) {
        if (authNoDisponible(error)) {
          this.logger.warn(`Auth no disponible al validar el token: ${error.message}`);
          return { estado: "no_disponible" };
        }
        return { estado: "invalido" };
      }
      const sub = data?.claims.sub;
      if (typeof sub !== "string" || sub.length === 0) {
        // Las claves anon y service_role también son JWT del proyecto, pero no son una cuenta.
        return { estado: "invalido" };
      }
      const correo = typeof data?.claims.email === "string" ? data.claims.email : "";
      return { estado: "valido", identidad: { id: sub, correo } };
    } catch (e) {
      if (e instanceof TiempoLimiteAgotado) {
        this.logger.warn(`Auth no respondió en ${TIEMPO_LIMITE_AUTH_MS} ms`);
        return { estado: "no_disponible" };
      }
      if (authNoDisponible(e)) {
        // Fallo de red al pedir las claves JWKS o al consultar Auth: no es culpa del token.
        this.logger.warn(`Auth no disponible al validar el token: ${String(e)}`);
        return { estado: "no_disponible" };
      }
      // Errores que no son de red (algoritmo o clave extraños en un token falso): el token no vale.
      this.logger.warn(`Token rechazado: ${e instanceof Error ? e.message : String(e)}`);
      return { estado: "invalido" };
    } finally {
      clearTimeout(temporizador);
    }
  }
}

/**
 * Error de Auth que no dice nada del token: red caída (`TypeError` de `fetch`),
 * límite de peticiones (429) o fallo del servidor (5xx). La web no debe cerrar la sesión por eso.
 */
export function authNoDisponible(error: unknown): boolean {
  if (error instanceof TypeError || isAuthRetryableFetchError(error)) return true;
  const estado = (error as { status?: unknown } | null)?.status;
  return typeof estado === "number" && (estado === 429 || estado >= 500);
}
