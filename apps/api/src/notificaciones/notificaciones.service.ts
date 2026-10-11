import { Inject, Injectable, Logger } from "@nestjs/common";
import { SUPABASE_CLIENTE, type ClienteSupabase } from "../supabase/supabase.module.js";

export const TABLA_BANDEJA = "notificaciones_bandeja";
/** Tiempo límite del insert en la bandeja: un fallo de la bandeja nunca debe frenar una compra. */
export const TIEMPO_LIMITE_BANDEJA_MS = 5_000;

/** Aviso que otro módulo pide enviar por WhatsApp (AD-9). `telefono` en E.164. */
export interface AvisoWhatsapp {
  telefono: string;
  plantilla: string;
  datos: Record<string, unknown>;
  adjunto_url?: string | null;
}

/**
 * Servicio del módulo `notificaciones`. Es la única puerta a `notificaciones_*` (AD-2).
 * En esta historia solo encola: el envío por Evolution API y los reintentos son de la 2.2.
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(@Inject(SUPABASE_CLIENTE) private readonly supabase: ClienteSupabase) {}

  /**
   * Inserta el aviso `pendiente` en la bandeja de salida. Nunca lanza (AD-9): si falla, lo registra
   * y devuelve `false`, y la operación que lo originó sigue adelante.
   */
  async encolar(aviso: AvisoWhatsapp): Promise<boolean> {
    try {
      if (!this.supabase) throw new Error("Supabase no está configurado en la API");
      const { error } = await this.supabase
        .from(TABLA_BANDEJA)
        .insert({
          telefono: aviso.telefono,
          plantilla: aviso.plantilla,
          datos: aviso.datos,
          adjunto_url: aviso.adjunto_url ?? null,
        })
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BANDEJA_MS));
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      this.logger.error(
        `No se pudo encolar el aviso «${aviso.plantilla}»: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }
}
