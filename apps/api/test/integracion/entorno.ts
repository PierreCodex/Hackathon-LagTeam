import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** URL y claves de la BD de prueba (Supabase local). `globalSetup` las comparte con las pruebas. */
export interface EntornoDePrueba {
  url: string;
  claveServicio: string;
  clavePublica: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    entornoDePrueba: EntornoDePrueba;
  }
}

/** Dominio de los correos de los usuarios de prueba: permite limpiarlos sin tocar otros. */
export const DOMINIO_USUARIOS_DE_PRUEBA = "prueba.reto18.local";

const RAIZ_REPO = resolve(import.meta.dirname, "../../../..");

export const COMO_LEVANTARLA =
  "Levanta la BD de prueba con `pnpm db:start` en la raíz del repo (necesita Docker en marcha) " +
  "y vuelve a ejecutar `pnpm test:int`.";

export class EntornoDePruebaInvalido extends Error {
  override name = "EntornoDePruebaInvalido";
}

/** Ejecuta `supabase status -o env` con la CLI instalada en la raíz. Lanza si la BD no está arriba. */
export function leerStatusDeSupabase(): string {
  const cli = resolve(RAIZ_REPO, "node_modules/supabase/dist/supabase.js");
  if (!existsSync(cli)) {
    throw new EntornoDePruebaInvalido(
      "No se encuentra la CLI de Supabase. Ejecuta `pnpm install` en la raíz del repo.",
    );
  }
  return execFileSync(process.execPath, [cli, "status", "-o", "env", "--workdir", RAIZ_REPO], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });
}

/** Convierte la salida `CLAVE="valor"` de `supabase status -o env` en un objeto. */
export function analizarStatus(salida: string): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const linea of salida.split(/\r?\n/)) {
    const coincidencia = /^([A-Z0-9_]+)=(.*)$/.exec(linea.trim());
    if (coincidencia) {
      valores[coincidencia[1]] = coincidencia[2].replace(/^"(.*)"$/, "$1");
    }
  }
  return valores;
}

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1"]);

/** Solo se aceptan BD locales: nunca la del proyecto en la nube que comparte el equipo. */
export function exigirUrlLocal(url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new EntornoDePruebaInvalido(`La URL de la BD de prueba no es válida: "${url}".`);
  }
  if (!HOSTS_LOCALES.has(host)) {
    throw new EntornoDePruebaInvalido(
      `La BD de prueba debe ser local (localhost o 127.0.0.1) y apunta a "${host}". ` +
        "Las pruebas de integración se niegan a ejecutarse contra otra base de datos.",
    );
  }
}

export interface Dependencias {
  leerStatus: () => string;
  hacerFetch: typeof fetch;
}

/**
 * Obtiene y valida el entorno de la BD de prueba. No crea ni borra nada:
 * si algo falla, lanza `EntornoDePruebaInvalido` con el motivo y cómo arreglarlo.
 */
export async function prepararEntornoDePrueba(
  deps: Dependencias = { leerStatus: leerStatusDeSupabase, hacerFetch: fetch },
): Promise<EntornoDePrueba> {
  let salida: string;
  try {
    salida = deps.leerStatus();
  } catch (e) {
    if (e instanceof EntornoDePruebaInvalido) throw e;
    throw new EntornoDePruebaInvalido(`La BD de prueba no está levantada. ${COMO_LEVANTARLA}`);
  }

  const valores = analizarStatus(salida);
  const url = valores.API_URL;
  const claveServicio = valores.SERVICE_ROLE_KEY ?? valores.SECRET_KEY;
  const clavePublica = valores.ANON_KEY ?? valores.PUBLISHABLE_KEY;
  if (!url || !claveServicio || !clavePublica) {
    throw new EntornoDePruebaInvalido(
      `\`supabase status\` no devolvió la URL y las claves de la BD local. ${COMO_LEVANTARLA}`,
    );
  }

  exigirUrlLocal(url);

  try {
    const respuesta = await deps.hacerFetch(`${url}/auth/v1/health`, {
      headers: { apikey: clavePublica },
      signal: AbortSignal.timeout(5_000),
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  } catch {
    throw new EntornoDePruebaInvalido(`La BD de prueba en ${url} no responde. ${COMO_LEVANTARLA}`);
  }

  return { url, claveServicio, clavePublica };
}
