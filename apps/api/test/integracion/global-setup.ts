import { createClient } from "@supabase/supabase-js";
import type { TestProject } from "vitest/node";
import {
  DOMINIO_USUARIOS_DE_PRUEBA,
  EntornoDePruebaInvalido,
  type EntornoDePrueba,
  prepararEntornoDePrueba,
} from "./entorno.js";

/**
 * Antes de cualquier prueba: comprueba que la BD de prueba es local y responde.
 * Si no, aborta la ejecución con el motivo y no se ejecuta ninguna prueba.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  let entorno: EntornoDePrueba;
  try {
    entorno = await prepararEntornoDePrueba();
  } catch (e) {
    if (e instanceof EntornoDePruebaInvalido) {
      console.error(`\n[test:int] ${e.message}\n`);
    }
    throw e;
  }
  project.provide("entornoDePrueba", entorno);

  // Red de seguridad al terminar: borra los usuarios de prueba que dejara una ejecución interrumpida.
  return async () => {
    const admin = createClient(entorno.url, entorno.claveServicio, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const restos = (data?.users ?? []).filter((u) =>
      u.email?.endsWith(`@${DOMINIO_USUARIOS_DE_PRUEBA}`),
    );
    await Promise.all(restos.map((u) => admin.auth.admin.deleteUser(u.id)));
  };
}
