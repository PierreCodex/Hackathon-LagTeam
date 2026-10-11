import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { configSupabase } from "./config";

/**
 * Cliente de Supabase para componentes de cliente, con la sesión de las cookies.
 * Para Auth (leer el token y mandarlo a la API) y, desde la 2.11, para la lectura pública en vivo
 * de `ventas_evento_asientos` por Realtime (AD-1: solo `SELECT`; nunca otra tabla ni Storage).
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
