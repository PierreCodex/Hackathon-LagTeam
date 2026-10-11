"use server";

import { PerfilSchema, type ErrorApi, type RegistroEntrada } from "@reto18/shared";
import { redirect } from "next/navigation";
import { pedirApi } from "@/lib/api";
import { validarRegistro, type ErroresRegistro } from "@/lib/formularios";
import { destinoTrasIngreso } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoRegistro = {
  errores?: ErroresRegistro;
  error?: ErrorApi;
  /** La cuenta se creó pero no se pudo iniciar sesión: toca ir a "Ingresar". */
  cuentaCreada?: boolean;
};

export type DatosRegistro = { datos: RegistroEntrada; siguiente?: string | null };

const CODIGO_INGRESO_PENDIENTE = "INGRESO_PENDIENTE";

/**
 * Registro (1.8): valida con `RegistroSchema`, crea la cuenta en la API
 * (`POST /identidad/registro`, AD-1), inicia sesión con Supabase Auth y lleva a la portada del rol.
 */
export async function registrar(
  _previo: EstadoRegistro,
  { datos, siguiente }: DatosRegistro,
): Promise<EstadoRegistro> {
  const validacion = validarRegistro(datos);
  if (!validacion.ok) {
    return { errores: validacion.errores };
  }

  const creada = await pedirApi("identidad/registro", PerfilSchema, { cuerpo: validacion.datos });
  if (!creada.ok) {
    return { error: creada.error };
  }

  const pendiente: EstadoRegistro = {
    cuentaCreada: true,
    error: {
      codigo: CODIGO_INGRESO_PENDIENTE,
      mensaje: "Tu cuenta está creada, pero no pudimos iniciar tu sesión. Ingresa con tu correo y contraseña.",
    },
  };
  const supabase = await crearClienteServidor();
  if (!supabase) return pendiente;
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: creada.datos.correo,
      password: datos.contrasena,
    });
    if (error) return pendiente;
  } catch {
    return pendiente;
  }

  redirect(destinoTrasIngreso(siguiente, creada.datos.rol));
}
