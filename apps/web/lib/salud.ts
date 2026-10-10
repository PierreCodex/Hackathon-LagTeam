import { SaludRespuestaSchema, type SaludRespuesta } from "@reto18/shared";

const TIEMPO_LIMITE_API_MS = 5000;

export type Estado =
  | { tipo: "respuesta"; salud: SaludRespuesta }
  | { tipo: "api-caida"; motivo: string };

export type Resumen = {
  api: "ok" | "error";
  bd: "ok" | "error" | "?";
  detalle: string;
};

/** Llama a `GET /api/v1/salud`. Nunca lanza: una API caída es un estado más. */
export async function consultarSalud(
  apiUrl: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<Estado> {
  if (!apiUrl) {
    return { tipo: "api-caida", motivo: "Falta la variable API_URL en la web" };
  }

  let res: Response;
  try {
    res = await fetchFn(`${apiUrl.replace(/\/+$/, "")}/api/v1/salud`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIEMPO_LIMITE_API_MS),
    });
  } catch {
    return { tipo: "api-caida", motivo: "No se pudo conectar con la API" };
  }

  const inesperada: Estado = {
    tipo: "api-caida",
    motivo: `Respuesta inesperada de la API (HTTP ${res.status})`,
  };
  let cuerpo: unknown;
  try {
    cuerpo = await res.json();
  } catch {
    // Llegó respuesta pero no es JSON (p. ej. una página 502 de Railway).
    return inesperada;
  }
  const resultado = SaludRespuestaSchema.safeParse(cuerpo);
  return resultado.success ? { tipo: "respuesta", salud: resultado.data } : inesperada;
}

const formatoLima = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  dateStyle: "long",
  timeStyle: "medium",
});

function horaEnLima(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : `${formatoLima.format(fecha)} (hora de Lima)`;
}

/** Traduce el estado a lo que muestra la página: "API ok · BD ok" y su detalle. */
export function resumir(estado: Estado): Resumen {
  if (estado.tipo === "api-caida") {
    return { api: "error", bd: "?", detalle: estado.motivo };
  }
  if (estado.salud.bd === "ok") {
    return {
      api: "ok",
      bd: "ok",
      detalle: `Hora de la base de datos: ${horaEnLima(estado.salud.hora_bd)}`,
    };
  }
  return { api: "ok", bd: "error", detalle: estado.salud.error.mensaje };
}
