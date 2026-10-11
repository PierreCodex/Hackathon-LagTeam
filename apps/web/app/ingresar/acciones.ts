"use server";

import type { ErrorApi } from "@reto18/shared";
import { redirect } from "next/navigation";
import { CODIGO_SIN_CONEXION, MENSAJE_SIN_CONEXION } from "@/lib/api";
import { mensajeErrorIngreso } from "@/lib/formularios";
import { destinoTrasIngreso, resolverSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoIngreso = { error?: ErrorApi };

export type DatosIngreso = { correo: string; contrasena: string; siguiente?: string | null };

/**
 * Inicia sesión con Supabase Auth (AD-1), lee el perfil en la API y lleva a la ruta pedida
 * o a la portada del rol. Si no se puede leer el perfil, cierra la sesión recién abierta:
 * nunca se queda alguien dentro sin rol conocido.
 */
export async function ingresar(_previo: EstadoIngreso, datos: DatosIngreso): Promise<EstadoIngreso> {
  const supabase = await crearClienteServidor();
  if (!supabase) {
    return { error: { codigo: CODIGO_SIN_CONEXION, mensaje: MENSAJE_SIN_CONEXION } };
  }

  let token: string;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: datos.correo.trim().toLowerCase(),
      password: datos.contrasena,
    });
    if (error || !data.session) {
      return { error: mensajeErrorIngreso(error ?? {}) };
    }
    token = data.session.access_token;
  } catch {
    return { error: { codigo: CODIGO_SIN_CONEXION, mensaje: MENSAJE_SIN_CONEXION } };
  }

  const sesion = await resolverSesion(token);
  if (sesion.tipo !== "cuenta") {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return {
      error:
        sesion.tipo === "error"
          ? sesion.error
          : // La API rechazó el token recién emitido (p. ej. proyecto de Supabase mal configurado).
            {
              codigo: "SESION_NO_VALIDA",
              mensaje: "No pudimos validar tu sesión. Inténtalo de nuevo en unos minutos.",
            },
    };
  }

  redirect(destinoTrasIngreso(datos.siguiente, sesion.perfil.rol));
}
