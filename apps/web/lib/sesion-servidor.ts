import { cache } from "react";
import { resolverSesion, type Sesion } from "./sesion";
import { crearClienteServidor } from "./supabase/servidor";

/**
 * Sesión de quien navega, para componentes de servidor. Se calcula una vez por petición
 * (cabecera, barra y guarda comparten el resultado). El token lo valida la API al leer el perfil.
 */
export const obtenerSesion = cache(async (): Promise<Sesion> => {
  const supabase = await crearClienteServidor();
  if (!supabase) return { tipo: "anonima" };
  let token: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  } catch {
    token = undefined;
  }
  return resolverSesion(token);
});
