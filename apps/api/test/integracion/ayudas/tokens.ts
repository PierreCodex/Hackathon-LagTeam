import { randomUUID } from "node:crypto";
import { DOMINIO_USUARIOS_DE_PRUEBA } from "../entorno.js";
import { clienteAdminDePrueba, clientePublicoDePrueba } from "./supabase.js";

/** Roles de la plataforma (AD-3). */
export type Rol = "admin" | "organizador" | "publico";

export interface UsuarioDePrueba {
  id: string;
  token: string;
}

const creados: string[] = [];

/**
 * Crea un usuario de Supabase Auth con `app_metadata.rol = rol`, inicia sesión con la clave
 * pública y devuelve su id y su JWT. Cada llamada crea un usuario distinto; se borran solos
 * al terminar cada archivo de pruebas (ver `limpieza.ts`).
 */
export async function tokenPorRol(rol: Rol): Promise<UsuarioDePrueba> {
  const admin = clienteAdminDePrueba();
  const email = `${rol}-${randomUUID()}@${DOMINIO_USUARIOS_DE_PRUEBA}`;
  const password = `Prueba-${randomUUID()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { rol },
  });
  if (error || !data.user) {
    throw new Error(`No se pudo crear el usuario de prueba (${rol}): ${error?.message}`);
  }
  creados.push(data.user.id);

  // Historia 1.2: aquí se añade el alta en `identidad_perfiles` con el mismo id y rol.

  const { data: sesion, error: errorSesion } =
    await clientePublicoDePrueba().auth.signInWithPassword({ email, password });
  if (errorSesion || !sesion.session) {
    throw new Error(
      `No se pudo iniciar sesión con el usuario de prueba (${rol}): ${errorSesion?.message}`,
    );
  }
  return { id: data.user.id, token: sesion.session.access_token };
}

/** Borra los usuarios que creó `tokenPorRol` en este archivo de pruebas. */
export async function borrarUsuariosDePrueba(): Promise<void> {
  const ids = creados.splice(0);
  if (ids.length === 0) return;
  const admin = clienteAdminDePrueba();
  await Promise.all(ids.map((id) => admin.auth.admin.deleteUser(id)));
}
