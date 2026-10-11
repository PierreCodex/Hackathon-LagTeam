import { Injectable } from "@nestjs/common";

/** Tiempo límite por defecto de una llamada a Ollama. */
export const IA_TIEMPO_LIMITE_MS_POR_DEFECTO = 30_000;

/** Petición de chat a Ollama: instrucciones, mensaje y JSON Schema de la salida. */
export interface PeticionOllama {
  sistema: string;
  usuario: string;
  /** JSON Schema que Ollama usa para forzar la forma de la respuesta (`format`). */
  formato: Record<string, unknown>;
}

/** Tiempo límite de la IA (`IA_TIEMPO_LIMITE_MS`): un entero entre 1 y 2147483647; si no, 30 s. */
export function tiempoLimiteIa(env: NodeJS.ProcessEnv = process.env): number {
  const valor = Number(env.IA_TIEMPO_LIMITE_MS);
  return Number.isInteger(valor) && valor >= 1 && valor <= 2_147_483_647 ? valor : IA_TIEMPO_LIMITE_MS_POR_DEFECTO;
}

/** URL base de Ollama sin barras finales ni un `/api` final. */
export function urlBaseOllama(url: string | undefined): string | undefined {
  return url?.trim().replace(/\/+$/, "").replace(/\/api$/i, "").replace(/\/+$/, "") || undefined;
}

/**
 * Adaptador único de Ollama (AD-11): solo el módulo `ia` llama al proveedor.
 * `POST {OLLAMA_URL}/api/chat` sin streaming, con `format` y tiempo límite. Devuelve el JSON del
 * mensaje del modelo, o lanza: la función de IA que lo usa decide el respaldo.
 * Lee el entorno en cada llamada (el túnel puede cambiar de URL sin reiniciar).
 */
@Injectable()
export class AdaptadorOllama {
  async chat(peticion: PeticionOllama): Promise<unknown> {
    const url = urlBaseOllama(process.env.OLLAMA_URL);
    const modelo = process.env.OLLAMA_MODELO?.trim();
    if (!url || !modelo) throw new Error("Ollama no está configurado (OLLAMA_URL u OLLAMA_MODELO)");

    const respuesta = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        stream: false,
        format: peticion.formato,
        options: { temperature: 0.7 },
        messages: [
          { role: "system", content: peticion.sistema },
          { role: "user", content: peticion.usuario },
        ],
      }),
      signal: AbortSignal.timeout(tiempoLimiteIa()),
    });
    if (!respuesta.ok) throw new Error(`Ollama respondió HTTP ${respuesta.status}`);
    const cuerpo = (await respuesta.json()) as { message?: { content?: unknown } };
    const contenido = cuerpo?.message?.content;
    if (typeof contenido !== "string") throw new Error("Ollama respondió sin `message.content`");
    return JSON.parse(contenido) as unknown;
  }
}
