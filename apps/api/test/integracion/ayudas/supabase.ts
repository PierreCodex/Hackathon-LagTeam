import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import type { EntornoDePrueba } from "../entorno.js";

/** Entorno de la BD de prueba que validó `globalSetup` (siempre local). */
export function entornoDePrueba(): EntornoDePrueba {
  return inject("entornoDePrueba");
}

/** Cliente de Supabase con la clave de servicio de la BD de prueba. */
export function clienteAdminDePrueba(): SupabaseClient {
  const { url, claveServicio } = entornoDePrueba();
  return createClient(url, claveServicio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente de Supabase con la clave pública, como lo usa la web. */
export function clientePublicoDePrueba(): SupabaseClient {
  const { url, clavePublica } = entornoDePrueba();
  return createClient(url, clavePublica, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
