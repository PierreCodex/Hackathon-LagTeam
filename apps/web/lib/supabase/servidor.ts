import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { configSupabase } from "./config";

/**
 * Cliente de Supabase para componentes de servidor y Server Actions, con la sesión en cookies.
 * Solo para Auth (AD-1): nunca para leer ni escribir tablas. Uno nuevo por petición.
 * Devuelve `null` si faltan las variables públicas de Supabase.
 */
export async function crearClienteServidor(): Promise<SupabaseClient | null> {
  // Leer las cookies siempre, aunque falte la configuración: la página queda dinámica
  // y nunca se sirve una sesión prerenderizada.
  const almacen = await cookies();
  const config = configSupabase();
  if (!config) return null;
  return createServerClient(config.url, config.clavePublica, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll(lista) {
        try {
          for (const { name, value, options } of lista) {
            almacen.set(name, value, options);
          }
        } catch {
          // Desde un componente de servidor no se pueden escribir cookies: lo hace `proxy.ts`.
        }
      },
    },
  });
}
