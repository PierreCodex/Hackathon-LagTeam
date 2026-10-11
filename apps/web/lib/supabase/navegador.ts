import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { configSupabase } from "./config";

/**
 * Cliente de Supabase para componentes de cliente, con la sesión de las cookies.
 * Solo para Auth (AD-1): se usa para leer el token y mandarlo a la API, nunca para tablas ni Storage.
 * Devuelve `null` si faltan las variables públicas de Supabase.
 */
export function crearClienteNavegador(): SupabaseClient | null {
  const config = configSupabase();
  if (!config) return null;
  return createBrowserClient(config.url, config.clavePublica);
}

/** Token de la sesión del navegador, o `null` si no hay sesión. */
export async function tokenDelNavegador(): Promise<string | null> {
  const supabase = crearClienteNavegador();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
