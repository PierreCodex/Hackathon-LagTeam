import { ListaEventosRevisionSchema, type ErrorApi, type EventoRevision } from "@reto18/shared";
import { pedirApi } from "@/lib/api";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const ERROR_SIN_SESION: ErrorApi = {
  codigo: "SIN_SESION",
  mensaje: "Tu sesión se cerró. Recarga la página para ingresar de nuevo.",
};

/** Token de la sesión de quien navega (servidor), o `null`. */
export async function tokenDelServidor(): Promise<string | null> {
  const supabase = await crearClienteServidor();
  try {
    return (await supabase?.auth.getSession())?.data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Eventos del organizador (`GET /eventos/mis-eventos`, 1.5), ordenados por inicio, o el error para pintarlo. */
export async function cargarMisEventos(): Promise<{ eventos: EventoRevision[]; error?: ErrorApi }> {
  const token = await tokenDelServidor();
  if (!token) return { eventos: [], error: ERROR_SIN_SESION };
  const resultado = await pedirApi("eventos/mis-eventos", ListaEventosRevisionSchema, {
    cabeceras: { Authorization: `Bearer ${token}` },
  });
  return resultado.ok ? { eventos: resultado.datos } : { eventos: [], error: resultado.error };
}
