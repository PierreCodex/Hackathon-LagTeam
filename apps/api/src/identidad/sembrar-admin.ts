/**
 * Crea o actualiza la cuenta de administrador (idempotente).
 * Uso: `pnpm --filter @reto18/api sembrar:admin`, con `ADMIN_CORREO`, `ADMIN_CONTRASENA`
 * y `ADMIN_WHATSAPP` en `.env` (además de `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`).
 */
import { pathToFileURL } from "node:url";
import { RegistroSchema } from "@reto18/shared";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { TABLA_PERFILES } from "./identidad.service.js";

/** Mismas reglas que el registro (correo, contraseña ≥ 8 y WhatsApp normalizado a E.164). */
const DatosAdminSchema = RegistroSchema.pick({ correo: true, contrasena: true, whatsapp: true });
const VARIABLE: Record<string, string> = {
  correo: "ADMIN_CORREO",
  contrasena: "ADMIN_CONTRASENA",
  whatsapp: "ADMIN_WHATSAPP",
};

export interface DatosAdmin {
  correo: string;
  contrasena: string;
  whatsapp: string;
}

export function leerDatosAdmin(entorno: NodeJS.ProcessEnv): DatosAdmin {
  const resultado = DatosAdminSchema.safeParse({
    correo: entorno.ADMIN_CORREO,
    contrasena: entorno.ADMIN_CONTRASENA,
    whatsapp: entorno.ADMIN_WHATSAPP,
  });
  if (!resultado.success) {
    const fallos = resultado.error.issues.map(
      (i) => `${VARIABLE[String(i.path[0])] ?? i.path.join(".")}: ${i.message}`,
    );
    throw new Error(`Variables del admin no válidas:\n  ${fallos.join("\n  ")}`);
  }
  return resultado.data;
}

async function buscarPorCorreo(supabase: SupabaseClient, correo: string): Promise<User | null> {
  const porPagina = 1000;
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: porPagina });
    if (error) throw new Error(`No se pudo listar las cuentas: ${error.message}`);
    const usuario = data.users.find((u) => u.email?.toLowerCase() === correo);
    if (usuario) return usuario;
    if (data.users.length < porPagina) return null;
  }
}

/** Crea la cuenta (o actualiza su contraseña) y deja su perfil con rol `admin`. */
export async function sembrarAdmin(
  supabase: SupabaseClient,
  datos: DatosAdmin,
): Promise<{ id: string; creado: boolean }> {
  let usuario = await buscarPorCorreo(supabase, datos.correo);
  const creado = !usuario;

  if (usuario) {
    const { error } = await supabase.auth.admin.updateUserById(usuario.id, {
      password: datos.contrasena,
      email_confirm: true,
    });
    if (error) throw new Error(`No se pudo actualizar la cuenta: ${error.message}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: datos.correo,
      password: datos.contrasena,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`No se pudo crear la cuenta: ${error?.message ?? "sin usuario"}`);
    }
    usuario = data.user;
  }

  const { error } = await supabase
    .from(TABLA_PERFILES)
    .upsert({ id: usuario.id, rol: "admin", whatsapp: datos.whatsapp }, { onConflict: "id" });
  if (error) throw new Error(`No se pudo guardar el perfil del admin: ${error.message}`);

  return { id: usuario.id, creado };
}

async function principal(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const datos = leerDatosAdmin(process.env);
  const supabase = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { id, creado } = await sembrarAdmin(supabase, datos);
  console.log(`Admin ${creado ? "creado" : "actualizado"}: ${datos.correo} (${id})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  });
}
