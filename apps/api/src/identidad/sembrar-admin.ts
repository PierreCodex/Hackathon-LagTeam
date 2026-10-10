/**
 * Crea o actualiza la cuenta de administrador (idempotente).
 * Uso: `pnpm --filter @reto18/api sembrar:admin`, con `ADMIN_CORREO`, `ADMIN_CONTRASENA` y
 * `ADMIN_WHATSAPP` en `.env` (además de `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`).
 * Si el correo ya tiene otro rol, se niega; `… sembrar:admin -- --forzar` lo asciende igualmente.
 */
import { RegistroSchema } from "@reto18/shared";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { buscarCuentaPorCorreo } from "./cuentas.js";
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

export interface OpcionesSembrado {
  /** Asciende a admin una cuenta que ya tiene otro rol (`--forzar`). */
  forzar?: boolean;
}

export interface ResultadoSembrado {
  id: string;
  creado: boolean;
  /** Rol que tenía la cuenta antes, si tenía perfil. */
  rolAnterior: string | null;
}

/** Crea la cuenta (o actualiza su contraseña) y deja su perfil con rol `admin`. */
export async function sembrarAdmin(
  supabase: SupabaseClient,
  datos: DatosAdmin,
  opciones: OpcionesSembrado = {},
): Promise<ResultadoSembrado> {
  const credenciales = { password: datos.contrasena, email_confirm: true };
  let usuario: User | null = await buscarCuentaPorCorreo(supabase, datos.correo);
  let creado = false;

  if (!usuario) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: datos.correo,
      ...credenciales,
    });
    if (data.user && !error) {
      usuario = data.user;
      creado = true;
    } else if (error?.code === "email_exists" || error?.code === "user_already_exists") {
      // Se creó entre la búsqueda y el alta: se busca otra vez y se actualiza.
      usuario = await buscarCuentaPorCorreo(supabase, datos.correo);
    } else {
      throw new Error(`No se pudo crear la cuenta: ${error?.message ?? "sin usuario"}`);
    }
    if (!usuario) throw new Error(`No se encuentra la cuenta de ${datos.correo}`);
  }

  const lectura = await supabase.from(TABLA_PERFILES).select("rol").eq("id", usuario.id).maybeSingle();
  if (lectura.error) throw new Error(`No se pudo leer el perfil: ${lectura.error.message}`);
  const rolAnterior = (lectura.data as { rol: string } | null)?.rol ?? null;
  if (rolAnterior && rolAnterior !== "admin" && !opciones.forzar) {
    throw new Error(
      `La cuenta ${datos.correo} ya existe con el rol "${rolAnterior}". ` +
        "Usa otro ADMIN_CORREO o repite con --forzar para hacerla admin.",
    );
  }

  if (!creado) {
    const { error } = await supabase.auth.admin.updateUserById(usuario.id, credenciales);
    if (error) throw new Error(`No se pudo actualizar la cuenta: ${error.message}`);
  }

  const { error } = await supabase
    .from(TABLA_PERFILES)
    .upsert({ id: usuario.id, rol: "admin", whatsapp: datos.whatsapp }, { onConflict: "id" });
  if (error) throw new Error(`No se pudo guardar el perfil del admin: ${error.message}`);

  return { id: usuario.id, creado, rolAnterior };
}

/** Ejecución desde la terminal (`sembrar-admin.cli.ts`): lee el entorno y los argumentos. */
export async function ejecutarSembrado(entorno: NodeJS.ProcessEnv, argumentos: string[]): Promise<string> {
  const url = entorno.SUPABASE_URL;
  const clave = entorno.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const datos = leerDatosAdmin(entorno);
  const supabase = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { id, creado, rolAnterior } = await sembrarAdmin(supabase, datos, {
    forzar: argumentos.includes("--forzar"),
  });
  const antes = rolAnterior && rolAnterior !== "admin" ? ` (antes era ${rolAnterior})` : "";
  return `Admin ${creado ? "creado" : "actualizado"}: ${datos.correo} (${id})${antes}`;
}
