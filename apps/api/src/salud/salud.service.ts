import { Inject, Injectable, Logger } from "@nestjs/common";
import { CODIGO_BD_NO_DISPONIBLE, type SaludRespuesta } from "@reto18/shared";
import { SUPABASE_CLIENTE, type ClienteSupabase } from "../supabase/supabase.module.js";

/** Tiempo límite de la consulta a la base de datos. */
export const TIEMPO_LIMITE_BD_MS = 3000;

class TiempoLimiteAgotado extends Error {}

@Injectable()
export class SaludService {
  private readonly logger = new Logger(SaludService.name);

  constructor(@Inject(SUPABASE_CLIENTE) private readonly supabase: ClienteSupabase) {}

  /** Consulta `public.salud()` en Postgres y devuelve el contrato de `GET /api/v1/salud`. */
  async comprobar(): Promise<SaludRespuesta> {
    if (!this.supabase) {
      return this.error("Supabase no está configurado en la API");
    }

    const controlador = new AbortController();
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const limite = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(() => {
        controlador.abort();
        rechazar(new TiempoLimiteAgotado());
      }, TIEMPO_LIMITE_BD_MS);
    });

    try {
      const { data, error } = await Promise.race([
        this.supabase.rpc("salud").abortSignal(controlador.signal),
        limite,
      ]);
      if (error) {
        this.logger.warn(`Supabase respondió con error: ${error.message}`);
        return this.error("La base de datos respondió con un error");
      }
      if (typeof data !== "string" || data.length === 0) {
        this.logger.warn("public.salud() no devolvió una hora");
        return this.error("La base de datos devolvió una respuesta inesperada");
      }
      return { api: "ok", bd: "ok", hora_bd: data };
    } catch (e) {
      if (e instanceof TiempoLimiteAgotado) {
        this.logger.warn(`Supabase no respondió en ${TIEMPO_LIMITE_BD_MS} ms`);
        return this.error(`La base de datos no respondió en ${TIEMPO_LIMITE_BD_MS / 1000} s`);
      }
      this.logger.warn(`Fallo al llamar a Supabase: ${e instanceof Error ? e.message : String(e)}`);
      return this.error("No se pudo conectar con la base de datos");
    } finally {
      clearTimeout(temporizador);
    }
  }

  private error(mensaje: string): SaludRespuesta {
    return { api: "ok", bd: "error", error: { codigo: CODIGO_BD_NO_DISPONIBLE, mensaje } };
  }
}
