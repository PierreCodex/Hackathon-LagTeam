import { ErrorApiSchema, type ErrorApi } from "@reto18/shared";
import { z, type ZodType } from "zod";

/**
 * Cliente HTTP común de la web. Sigue el patrón de `consultarSalud`:
 * nunca lanza; siempre devuelve un resultado que la pantalla puede pintar.
 */

export const TIEMPO_LIMITE_API_MS = 8000;

export const CODIGO_SIN_CONEXION = "SIN_CONEXION";
export const CODIGO_RESPUESTA_INVALIDA = "RESPUESTA_INVALIDA";

export const MENSAJE_SIN_CONEXION =
  "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
export const MENSAJE_RESPUESTA_INVALIDA =
  "Algo salió mal de nuestro lado. Inténtalo de nuevo en unos minutos.";

export type ResultadoApi<T> = { ok: true; datos: T } | { ok: false; error: ErrorApi };

export type OpcionesApi = {
  /** Base de la API. Por defecto `process.env.API_URL` (disponible en el servidor). */
  apiUrl?: string;
  /** Inyectable para pruebas. */
  fetchFn?: typeof fetch;
  /** Tiempo límite en milisegundos. */
  tiempoLimiteMs?: number;
  /** Método HTTP; por defecto GET (o POST si hay `cuerpo`). */
  metodo?: string;
  /** Se envía como JSON. */
  cuerpo?: unknown;
  /**
   * Se envía como multipart (p. ej. el alta de evento con su foto). Sin `Content-Type`:
   * lo pone `fetch` con el `boundary`. Si llega, `cuerpo` se ignora.
   */
  formulario?: FormData;
  /** Cabeceras adicionales (p. ej. Authorization cuando llegue la sesión, 1.8). */
  cabeceras?: Record<string, string>;
  /** Señal para cancelar desde la pantalla; se combina con el tiempo límite. */
  signal?: AbortSignal;
  /** Caché de fetch; por defecto `no-store`: los datos de eventos cambian. */
  cache?: RequestCache;
};

const CuerpoErrorSchema = z.object({ error: ErrorApiSchema });

const sinConexion = (): ResultadoApi<never> => ({
  ok: false,
  error: { codigo: CODIGO_SIN_CONEXION, mensaje: MENSAJE_SIN_CONEXION },
});

const respuestaInvalida = (): ResultadoApi<never> => ({
  ok: false,
  error: { codigo: CODIGO_RESPUESTA_INVALIDA, mensaje: MENSAJE_RESPUESTA_INVALIDA },
});

/** Une `API_URL` con `/api/v1` y la ruta: `urlApi("https://x/", "eventos")` → `https://x/api/v1/eventos`. */
export function urlApi(apiUrl: string, ruta: string): string {
  return `${apiUrl.replace(/\/+$/, "")}/api/v1/${ruta.replace(/^\/+/, "")}`;
}

/**
 * Llama a `API_URL/api/v1/<ruta>` y valida la respuesta con `esquema`.
 *
 * - 2xx que cumple el esquema → `{ ok: true, datos }`.
 * - 4xx/5xx con `{ error: { codigo, mensaje } }` → ese error tal cual.
 * - Respuesta fuera de contrato o sin JSON → `RESPUESTA_INVALIDA`.
 * - Sin red, tiempo límite o sin `API_URL` → `SIN_CONEXION`.
 */
export async function pedirApi<T>(
  ruta: string,
  esquema: ZodType<T>,
  opciones: OpcionesApi = {},
): Promise<ResultadoApi<T>> {
  const {
    apiUrl = process.env.API_URL,
    fetchFn = fetch,
    tiempoLimiteMs = TIEMPO_LIMITE_API_MS,
    cuerpo,
    formulario,
    cabeceras,
    signal,
    cache = "no-store",
  } = opciones;
  const conJson = formulario === undefined && cuerpo !== undefined;
  const metodo = opciones.metodo ?? (formulario === undefined && cuerpo === undefined ? "GET" : "POST");

  if (!apiUrl) {
    return sinConexion();
  }

  const tiempoLimite = AbortSignal.timeout(tiempoLimiteMs);
  let res: Response;
  try {
    res = await fetchFn(urlApi(apiUrl, ruta), {
      method: metodo,
      cache,
      headers: {
        Accept: "application/json",
        ...(conJson ? { "Content-Type": "application/json" } : {}),
        ...cabeceras,
      },
      body: formulario ?? (conJson ? JSON.stringify(cuerpo) : undefined),
      signal: signal ? AbortSignal.any([signal, tiempoLimite]) : tiempoLimite,
    });
  } catch {
    return sinConexion();
  }

  let texto: string;
  try {
    texto = await res.text();
  } catch {
    // Se cortó mientras llegaba el cuerpo (red o tiempo límite): es un problema de conexión.
    return sinConexion();
  }

  // Cuerpo vacío (204, o 200/201 de un manejador void de NestJS) → `undefined`.
  let json: unknown;
  if (texto.trim() !== "") {
    try {
      json = JSON.parse(texto);
    } catch {
      // Llegó respuesta pero no es JSON (p. ej. una página 502 del proxy).
      return respuestaInvalida();
    }
  }

  if (!res.ok) {
    const error = CuerpoErrorSchema.safeParse(json);
    return error.success ? { ok: false, error: error.data.error } : respuestaInvalida();
  }

  const datos = esquema.safeParse(json);
  return datos.success ? { ok: true, datos: datos.data } : respuestaInvalida();
}
