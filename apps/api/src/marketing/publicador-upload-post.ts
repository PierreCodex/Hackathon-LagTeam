import { Injectable } from "@nestjs/common";
import type { RedPublicacion, ResultadoRedPublicacion } from "@reto18/shared";

export const UPLOADPOST_API = "https://api.upload-post.com/api";
/** Tiempo límite de las consultas (perfil, página de Facebook) y de traer el PNG de la web. */
export const TIEMPO_LIMITE_CONSULTA_MS = 15_000;
/** Presupuesto total, incluida preparación, subida y confirmación asíncrona. */
export const TIEMPO_LIMITE_SUBIDA_MS = 120_000;
export const INTERVALO_CONSULTA_MS = 10_000;

/** El envío pudo aceptarse: no se debe recomendar repetirlo como si hubiera fallado. */
export class PublicacionSinConfirmar extends Error {}

/** Publicación de una foto en una o más redes. */
export interface PeticionPublicarFoto {
  redes: RedPublicacion[];
  /** URL pública del PNG de la pieza (la plantilla de la web, AD-12). */
  imagenUrl: string;
  texto: string;
  /** ISO 8601 con zona: si llega, se programa en lugar de publicar ya. */
  programarPara?: string;
}

/** Resultado por red: el que devuelve Upload-Post, normalizado. */
export interface ResultadoPublicarFoto {
  programada: boolean;
  redes: ResultadoRedPublicacion[];
}

/** Cuerpo de las respuestas de Upload-Post que se leen aquí (todo opcional: se lee con cuidado). */
interface RespuestaUploadPost {
  success?: boolean;
  message?: string;
  error?: string;
  job_id?: string;
  request_id?: string;
  status?: string;
  results?: Record<string, { success?: boolean; url?: string; post_url?: string; error?: string; message?: string }>;
  profiles?: { username: string }[];
  pages?: { id: string; name?: string }[];
}

/**
 * Adaptador único de Upload-Post (3.4): publica el flyer en Instagram y Facebook. Lee el entorno en
 * cada llamada (`UPLOADPOST_API_KEY`, y opcionales `UPLOADPOST_USER` y `UPLOADPOST_FACEBOOK_PAGE_ID`).
 * Lanza un `Error` con un mensaje legible si algo falla; `MarketingService` lo convierte en 502.
 */
@Injectable()
export class PublicadorUploadPost {
  configurado(): boolean {
    return Boolean(process.env.UPLOADPOST_API_KEY?.trim());
  }

  async publicarFoto(peticion: PeticionPublicarFoto): Promise<ResultadoPublicarFoto> {
    const hasta = Date.now() + TIEMPO_LIMITE_SUBIDA_MS;
    const imagen = await traerImagen(peticion.imagenUrl, hasta);
    const perfil = await this.perfil(hasta);
    const paginaFacebook = peticion.redes.includes("facebook") ? await this.paginaFacebook(perfil, hasta) : undefined;

    const fd = new FormData();
    fd.append("user", perfil);
    for (const red of peticion.redes) fd.append("platform[]", red);
    fd.append("title", peticion.texto);
    fd.append("description", peticion.texto);
    if (paginaFacebook) fd.append("facebook_page_id", paginaFacebook);
    if (peticion.programarPara) fd.append("scheduled_date", new Date(peticion.programarPara).toISOString());
    else fd.append("async_upload", "true");
    fd.append("photos[]", imagen, "pieza.png");

    try {
      let cuerpo = await this.pedir("/upload_photos", { method: "POST", body: fd }, hasta);
      if (peticion.programarPara) {
        if (cuerpo.success !== true || !texto(cuerpo.job_id)) {
          throw new Error("Upload-Post no confirmó la programación");
        }
        return leerResultado(cuerpo, peticion.redes, true);
      }
      const requestId = texto(cuerpo.request_id);
      if (requestId) {
        // Un request_id confirma recepción, no publicación. Nunca se repite el POST.
        do {
          cuerpo = await this.pedir(`/uploadposts/status?request_id=${encodeURIComponent(requestId)}`, {}, hasta);
          if (cuerpo.status === "completed" || cuerpo.status === "failed") break;
          await new Promise((resolver) => setTimeout(resolver, Math.min(INTERVALO_CONSULTA_MS, restante(hasta))));
        } while (restante(hasta) > 0);
      }
      const resultado = leerResultado(cuerpo, peticion.redes, false);
      if (!cuerpo.results && cuerpo.success !== false && cuerpo.status !== "failed") {
        throw new Error("Upload-Post respondió sin resultados de publicación");
      }
      return resultado;
    } catch (error) {
      const detalle = error instanceof Error ? error.message : "respuesta no válida";
      throw new PublicacionSinConfirmar(
        `No se pudo confirmar el envío (${detalle}). Revisa Upload-Post y tus redes antes de volver a publicar para evitar duplicados.`,
      );
    }
  }

  /** Perfil de Upload-Post: `UPLOADPOST_USER` o, si falta, el primero de la cuenta. */
  private async perfil(hasta: number): Promise<string> {
    const fijo = process.env.UPLOADPOST_USER?.trim();
    if (fijo) return fijo;
    const { profiles = [] } = await this.pedir("/uploadposts/users", {}, hasta);
    const perfil = profiles[0]?.username;
    if (!perfil) throw new Error("No hay perfiles en Upload-Post");
    return perfil;
  }

  /** Página de Facebook: `UPLOADPOST_FACEBOOK_PAGE_ID` o, si falta, la primera conectada al perfil. */
  private async paginaFacebook(perfil: string, hasta: number): Promise<string> {
    const fija = process.env.UPLOADPOST_FACEBOOK_PAGE_ID?.trim();
    if (fija) return fija;
    const { pages = [] } = await this.pedir(`/uploadposts/facebook/pages?profile=${encodeURIComponent(perfil)}`, {}, hasta);
    if (!pages[0]?.id) throw new Error("No hay una página de Facebook conectada al perfil de Upload-Post");
    return pages[0].id;
  }

  private async pedir(
    ruta: string,
    init: RequestInit,
    hasta: number,
  ): Promise<RespuestaUploadPost> {
    const respuesta = await fetch(`${UPLOADPOST_API}${ruta}`, {
      ...init,
      headers: { Authorization: `Apikey ${process.env.UPLOADPOST_API_KEY?.trim() ?? ""}` },
      signal: AbortSignal.timeout(init.method === "POST" ? restante(hasta) : Math.min(TIEMPO_LIMITE_CONSULTA_MS, restante(hasta))),
    });
    const cuerpo = objeto(await respuesta.json()) as RespuestaUploadPost;
    if (!respuesta.ok) throw new Error(texto(cuerpo.message) || texto(cuerpo.error) || `Upload-Post respondió HTTP ${respuesta.status}`);
    return cuerpo;
  }
}

/** Trae el PNG de la plantilla de la web; si no es una imagen, lanza. */
async function traerImagen(url: string, hasta: number): Promise<Blob> {
  const respuesta = await fetch(url, { signal: AbortSignal.timeout(Math.min(TIEMPO_LIMITE_CONSULTA_MS, restante(hasta))) });
  const tipo = respuesta.headers.get("content-type") ?? "";
  if (!respuesta.ok || !tipo.startsWith("image/")) {
    throw new Error(`No se pudo preparar la imagen de la pieza (HTTP ${respuesta.status})`);
  }
  return new Blob([await respuesta.arrayBuffer()], { type: tipo });
}

/**
 * Normaliza la respuesta de `upload_photos`. Programada: `{ success, job_id }`. Inmediata:
 * `{ results: { instagram: { success, url }, ... } }`; status devuelve results como array.
 * Solo una confirmación explícita por red permite anunciar que se publicó.
 */
export function leerResultado(
  cuerpo: unknown,
  redes: RedPublicacion[],
  programada: boolean,
): ResultadoPublicarFoto {
  const datos = objeto(cuerpo);
  const programacionConfirmada = programada && datos.success === true && Boolean(texto(datos.job_id));
  const estadoFinal = !datos.status || datos.status === "completed" || datos.status === "failed";
  return {
    programada: programacionConfirmada,
    redes: redes.map((red) => {
      const r = objeto(Array.isArray(datos.results)
        ? datos.results.find((fila) => objeto(fila).platform === red)
        : objeto(datos.results)[red]);
      const ok = programada ? programacionConfirmada : estadoFinal && r.success === true && r.skipped !== true
        && (!r.status || r.status === "completed");
      return {
        red,
        ok,
        url: ok ? urlPublicacion(r.url) || urlPublicacion(r.post_url) : null,
        error: ok ? null : texto(r.error) || texto(r.message) || texto(datos.message) || texto(datos.error)
          || "Upload-Post no confirmó la publicación en esta red. Revisa tus redes antes de repetir el envío.",
      };
    }),
  };
}

function restante(hasta: number): number {
  const ms = hasta - Date.now();
  if (ms <= 0) throw new Error("Se agotó el tiempo de confirmación");
  return ms;
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

function urlPublicacion(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch { return null; }
}
