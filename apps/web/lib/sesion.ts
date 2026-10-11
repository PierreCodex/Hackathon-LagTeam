import {
  CODIGOS_IDENTIDAD,
  PerfilSchema,
  type ErrorApi,
  type Perfil,
  type Rol as RolApi,
} from "@reto18/shared";
import { pedirApi, type OpcionesApi } from "./api";
import type { Rol as RolBarra } from "./navegacion";

/**
 * "Quién navega": una sola fuente para la cabecera, la barra y las guardas de rol.
 * El rol sale siempre del perfil de la API (`GET /identidad/perfil`), nunca del JWT (AD-3).
 * Este módulo no toca cookies ni Supabase: así se prueba sin navegador.
 */

export type Sesion =
  /** Sin sesión (o con un token que la API ya no acepta). */
  | { tipo: "anonima" }
  /** Sesión con perfil leído de la API. */
  | { tipo: "cuenta"; perfil: Perfil; rolBarra: RolBarra }
  /** Hay sesión pero no se pudo leer el perfil (API caída, sin perfil…). */
  | { tipo: "error"; error: ErrorApi };

/** Rol de la API → rol de la barra de la 1.7 (la API dice `admin`; la barra, `administrador`). */
const ROL_BARRA: Record<RolApi, RolBarra> = {
  publico: "publico",
  organizador: "organizador",
  admin: "administrador",
};

export function rolDeBarra(rol: RolApi): RolBarra {
  return ROL_BARRA[rol];
}

/** Portada de cada rol: adonde llega tras registrarse o iniciar sesión. */
const PORTADA: Record<RolApi, string> = {
  publico: "/",
  organizador: "/organizador",
  admin: "/admin",
};

export function portadaDeRol(rol: RolApi): string {
  return PORTADA[rol];
}

/** Para "Esta sección es para …". */
export const NOMBRE_PLURAL_ROL: Record<RolApi, string> = {
  publico: "el público",
  organizador: "organizadores",
  admin: "administradores",
};

/** Rutas privadas y el rol que piden. El resto de la web es pública. */
const RUTAS_POR_ROL: readonly { prefijo: string; rol: RolApi }[] = [
  { prefijo: "/organizador", rol: "organizador" },
  { prefijo: "/admin", rol: "admin" },
];

/** Rol que pide una ruta (`/organizador/...` → organizador), o `null` si es pública. */
export function rolDeRuta(ruta: string): RolApi | null {
  const encontrada = RUTAS_POR_ROL.find(
    ({ prefijo }) => ruta === prefijo || ruta.startsWith(`${prefijo}/`),
  );
  return encontrada?.rol ?? null;
}

/**
 * Lee el perfil con el token de la sesión.
 * - Sin token → anónima.
 * - Token que la API rechaza (`NO_AUTENTICADO`) → anónima: la sesión ya no vale.
 * - Otro error (`SIN_CONEXION`, `SIN_PERFIL`, `AUTH_NO_DISPONIBLE`…) → error, sin rol: nunca se adivina un menú.
 */
export async function resolverSesion(
  token: string | null | undefined,
  opciones: Pick<OpcionesApi, "apiUrl" | "fetchFn" | "tiempoLimiteMs"> = {},
): Promise<Sesion> {
  if (!token) {
    return { tipo: "anonima" };
  }
  const resultado = await pedirApi("identidad/perfil", PerfilSchema, {
    ...opciones,
    cabeceras: { Authorization: `Bearer ${token}` },
  });
  if (resultado.ok) {
    return { tipo: "cuenta", perfil: resultado.datos, rolBarra: rolDeBarra(resultado.datos.rol) };
  }
  if (resultado.error.codigo === CODIGOS_IDENTIDAD.NO_AUTENTICADO) {
    return { tipo: "anonima" };
  }
  return { tipo: "error", error: resultado.error };
}

/** Rol de la barra según la sesión: sin sesión, la de público; con error, ninguna. */
export function rolBarraDeSesion(sesion: Sesion): RolBarra | undefined {
  if (sesion.tipo === "anonima") return "publico";
  if (sesion.tipo === "cuenta") return sesion.rolBarra;
  return undefined;
}

export type Guarda =
  | { tipo: "permitido"; perfil: Perfil }
  | { tipo: "ingresar" }
  | { tipo: "sin-permiso"; rolRequerido: RolApi; portada: string }
  | { tipo: "error"; error: ErrorApi };

/** Decide qué ve una ruta que pide `rolRequerido` según la sesión. */
export function guardaDeRol(sesion: Sesion, rolRequerido: RolApi): Guarda {
  if (sesion.tipo === "anonima") return { tipo: "ingresar" };
  if (sesion.tipo === "error") return { tipo: "error", error: sesion.error };
  if (sesion.perfil.rol !== rolRequerido) {
    return { tipo: "sin-permiso", rolRequerido, portada: portadaDeRol(sesion.perfil.rol) };
  }
  return { tipo: "permitido", perfil: sesion.perfil };
}

/**
 * Ruta interna segura para volver tras entrar: empieza por `/`, no por `//` ni `/\`
 * (evita redirecciones abiertas a otro dominio). Si no vale, `null`.
 */
export function rutaInternaSegura(ruta: string | null | undefined): string | null {
  if (!ruta || !ruta.startsWith("/") || ruta.startsWith("//") || ruta.startsWith("/\\")) {
    return null;
  }
  // Los navegadores quitan tabuladores y saltos de línea: `/\t/malo.ejemplo` acabaría en otro dominio.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(ruta)) {
    return null;
  }
  // Además, resuelta contra un origen cualquiera debe quedarse en ese mismo origen.
  const ORIGEN = "https://origen.invalid";
  try {
    if (new URL(ruta, ORIGEN).origin !== ORIGEN) return null;
  } catch {
    return null;
  }
  // Volver a las pantallas de entrada no tiene sentido.
  if (rutaSinConsulta(ruta) === "/ingresar" || rutaSinConsulta(ruta) === "/registro") {
    return null;
  }
  return ruta;
}

function rutaSinConsulta(ruta: string): string {
  return ruta.split(/[?#]/, 1)[0] ?? ruta;
}

/** Adónde ir tras iniciar sesión: la ruta pedida si es segura; si no, la portada del rol. */
export function destinoTrasIngreso(siguiente: string | null | undefined, rol: RolApi): string {
  return rutaInternaSegura(siguiente) ?? portadaDeRol(rol);
}

/** `/ingresar?siguiente=<ruta>` para volver a la ruta pedida tras entrar. */
export function rutaIngresar(siguiente?: string | null): string {
  const segura = rutaInternaSegura(siguiente);
  return segura ? `/ingresar?siguiente=${encodeURIComponent(segura)}` : "/ingresar";
}

/** Estado de la sesión que ve `proxy.ts` (solo mira si hay sesión, no el rol). */
export type EstadoSesionProxy = "con-sesion" | "sin-sesion" | "desconocido";

/**
 * Qué hace el proxy con una petición: redirigir a `/ingresar` solo si la ruta es privada
 * y seguro que no hay sesión. Si Auth no responde ("desconocido"), deja pasar: la guarda
 * de la página decide y muestra el aviso. El rol lo comprueba la página con el perfil de la API.
 */
export function decidirProxy(
  ruta: string,
  consulta: string,
  estado: EstadoSesionProxy,
): { tipo: "seguir" } | { tipo: "redirigir"; destino: string } {
  if (estado !== "sin-sesion" || rolDeRuta(ruta) === null) {
    return { tipo: "seguir" };
  }
  return { tipo: "redirigir", destino: rutaIngresar(`${ruta}${consulta}`) };
}
