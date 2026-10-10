import { Global, Logger, Module } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Token de inyección del cliente de Supabase con la clave de servicio (AD-1). */
export const SUPABASE_CLIENTE = Symbol("SUPABASE_CLIENTE");

/** `null` si faltan las variables: la API arranca igual y la salud informa `bd: "error"`. */
export type ClienteSupabase = SupabaseClient | null;

function crearCliente(): ClienteSupabase {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    new Logger("Supabase").warn("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    return null;
  }
  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

@Global()
@Module({
  providers: [{ provide: SUPABASE_CLIENTE, useFactory: crearCliente }],
  exports: [SUPABASE_CLIENTE],
})
export class SupabaseModule {}
