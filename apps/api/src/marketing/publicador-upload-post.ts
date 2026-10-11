import { Injectable } from "@nestjs/common";
import type { RedPublicacion, ResultadoRedPublicacion } from "@reto18/shared";

export const UPLOADPOST_API = "https://api.upload-post.com/api";
/** Tiempo límite de las consultas (perfil, página de Facebook) y de traer el PNG de la web. */
export const TIEMPO_LIMITE_CONSULTA_MS = 15_000;
/** Tiempo límite de la subida: Instagram y Facebook procesan la foto antes de responder. */
export const TIEMPO_LIMITE_SUBIDA_MS = 120_000;

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
    const imagen = await traerImagen(peticion.imagenUrl);
    const perfil = await this.perfil();
    const paginaFacebook = peticion.redes.includes("facebook") ? await this.paginaFacebook(perfil) : undefined;

    const fd = new FormData();
    fd.append("user", perfil);
    for (const red of peticion.redes) fd.append("platform[]", red);
    fd.append("title", peticion.texto);
    fd.append("description", peticion.texto);
    if (paginaFacebook) fd.append("facebook_page_id", paginaFacebook);
    if (peticion.programarPara) fd.append("scheduled_date", new Date(peticion.programarPara).toISOString());
    fd.append("photos[]", imagen, "pieza.png");

    const cuerpo = await this.pedir("/upload_photos", { method: "POST", body: fd }, TIEMPO_LIMITE_SUBIDA_MS);
    return leerResultado(cuerpo, peticion.redes, Boolean(peticion.programarPara));
  }

  /** Perfil de Upload-Post: `UPLOADPOST_USER` o, si falta, el primero de la cuenta. */
  private async perfil(): Promise<string> {
    const fijo = process.env.UPLOADPOST_USER?.trim();
    if (fijo) return fijo;
    const { profiles = [] } = await this.pedir("/uploadposts/users");
    const perfil = profiles[0]?.username;
    if (!perfil) throw new Error("No hay perfiles en Upload-Post");
    return perfil;
  }

  /** Página de Facebook: `UPLOADPOST_FACEBOOK_PAGE_ID` o, si falta, la primera conectada al perfil. */
  private async paginaFacebook(perfil: string): Promise<string | undefined> {
    const fija = process.env.UPLOADPOST_FACEBOOK_PAGE_ID?.trim();
    if (fija) return fija;
    const { pages = [] } = await this.pedir(`/uploadposts/facebook/pages?profile=${encodeURIComponent(perfil)}`);
    return pages[0]?.id;
  }

  private async pedir(
    ruta: string,
    init: RequestInit = {},
    tiempoLimiteMs = TIEMPO_LIMITE_CONSULTA_MS,
  ): Promise<RespuestaUploadPost> {
    const respuesta = await fetch(`${UPLOADPOST_API}${ruta}`, {
      ...init,
      headers: { Authorization: `Apikey ${process.env.UPLOADPOST_API_KEY?.trim() ?? ""}` },
      signal: AbortSignal.timeout(tiempoLimiteMs),
    });
    const cuerpo = (await respuesta.json().catch(() => ({}))) as RespuestaUploadPost;
    if (!respuesta.ok) throw new Error(cuerpo.message || cuerpo.error || `Upload-Post respondió HTTP ${respuesta.status}`);
    return cuerpo;
  }
}

/** Trae el PNG de la plantilla de la web; si no es una imagen, lanza. */
async function traerImagen(url: string): Promise<Blob> {
  const respuesta = await fetch(url, { signal: AbortSignal.timeout(TIEMPO_LIMITE_CONSULTA_MS) });
  const tipo = respuesta.headers.get("content-type") ?? "";
  if (!respuesta.ok || !tipo.startsWith("image/")) {
    throw new Error(`No se pudo preparar la imagen de la pieza (HTTP ${respuesta.status})`);
  }
  return new Blob([await respuesta.arrayBuffer()], { type: tipo });
}

/**
 * Normaliza la respuesta de `upload_photos`. Programada: `{ success, job_id }`. Inmediata:
 * `{ success, results: { instagram: { success, url }, ... } }`. Sin detalle por red, vale `success`.
 */
export function leerResultado(
  cuerpo: RespuestaUploadPost,
  redes: RedPublicacion[],
  programada: boolean,
): ResultadoPublicarFoto {
  const general = cuerpo.success !== false;
  return {
    programada,
    redes: redes.map((red) => {
      const r = cuerpo.results?.[red];
      const ok = r ? r.success !== false : general;
      return {
        red,
        ok,
        url: (ok && (r?.url || r?.post_url)) || null,
        error: ok ? null : r?.error || r?.message || cuerpo.message || cuerpo.error || "No se pudo publicar",
      };
    }),
  };
}
