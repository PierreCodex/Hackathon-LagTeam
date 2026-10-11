import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decidirProxy, type EstadoSesionProxy } from "./lib/sesion";
import { configSupabase } from "./lib/supabase/config";

/**
 * Proxy (antes `middleware`, Next 16): mantiene viva la sesión de Supabase (refresca el token
 * y reescribe las cookies) y manda a `/ingresar` a quien abre `/organizador` o `/admin` sin sesión,
 * antes de pintar. El rol lo comprueba la página con el perfil de la API (AD-3).
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  const config = configSupabase();
  let estado: EstadoSesionProxy = "sin-sesion";

  if (config) {
    const supabase = createServerClient(config.url, config.clavePublica, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(lista, cabeceras) {
          for (const { name, value } of lista) request.cookies.set(name, value);
          respuesta = NextResponse.next({ request });
          for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
          for (const [clave, valor] of Object.entries(cabeceras)) respuesta.headers.set(clave, valor);
        },
      },
    });
    try {
      // `getClaims` carga la sesión de las cookies y la refresca si caducó.
      const { data, error } = await supabase.auth.getClaims();
      estado = data?.claims ? "con-sesion" : error ? "desconocido" : "sin-sesion";
    } catch {
      estado = "desconocido";
    }
  }

  const decision = decidirProxy(request.nextUrl.pathname, request.nextUrl.search, estado);
  if (decision.tipo === "redirigir") {
    const redireccion = NextResponse.redirect(new URL(decision.destino, request.url));
    // Conserva las cookies que Supabase haya cambiado (p. ej. una sesión caducada que se borra).
    for (const cookie of respuesta.cookies.getAll()) redireccion.cookies.set(cookie);
    return redireccion;
  }
  return respuesta;
}

export const config = {
  // Todo menos archivos estáticos, imágenes optimizadas y archivos con extensión.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
