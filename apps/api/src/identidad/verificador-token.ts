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
        if (isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500) {
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
      // Errores que no son de red (algoritmo o clave extraños en un token falso): el token no vale.
      this.logger.warn(`Token rechazado: ${e instanceof Error ? e.message : String(e)}`);
      return { estado: "invalido" };
    } finally {
      clearTimeout(temporizador);
    }
  }
}
