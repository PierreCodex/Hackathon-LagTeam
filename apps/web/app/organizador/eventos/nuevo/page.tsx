import { SedeResumenSchema, type ErrorApi, type SedeResumen } from "@reto18/shared";
import type { Metadata } from "next";
import { z } from "zod";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { pedirApi } from "@/lib/api";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { FormularioAlta } from "./formulario-alta";

export const metadata: Metadata = { title: "Nuevo evento · Reto 18" };

const RUTA = "/organizador/eventos/nuevo";

/** Sedes de `GET /eventos/sedes` con el token de la sesión, o el error para pintarlo con "Reintentar". */
async function cargarSedes(): Promise<{ sedes: SedeResumen[]; error?: ErrorApi }> {
  const supabase = await crearClienteServidor();
  let token: string | undefined;
  try {
    token = (await supabase?.auth.getSession())?.data.session?.access_token;
  } catch {
    token = undefined;
  }
  if (!token) {
    return { sedes: [], error: { codigo: "SIN_SESION", mensaje: "Tu sesión se cerró. Recarga la página para ingresar de nuevo." } };
  }
  const resultado = await pedirApi("eventos/sedes", z.array(SedeResumenSchema), {
    cabeceras: { Authorization: `Bearer ${token}` },
  });
  return resultado.ok ? { sedes: resultado.datos } : { sedes: [], error: resultado.error };
}

async function ContenidoAlta({ idUsuario }: { idUsuario: string }) {
  const { sedes, error } = await cargarSedes();
  // El navegador envía el alta directo a la API (sin el límite de 4,5 MB de Vercel); la API es la única que escribe (AD-1).
  return <FormularioAlta apiUrl={process.env.API_URL ?? ""} sedes={sedes} errorSedes={error} rutaActual={RUTA} idUsuario={idUsuario} />;
}

/** Alta de evento del organizador (historia 1.9, Flow 1): formulario en cinco pasos. */
export default function NuevoEvento() {
  return (
    <GuardaRol rol="organizador" ruta={RUTA} titulo="Nuevo evento" destinoActivo="mis-eventos" ancho="formulario">
      {(perfil) => <ContenidoAlta idUsuario={perfil.id} />}
    </GuardaRol>
  );
}
