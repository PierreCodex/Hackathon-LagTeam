"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/** Cierra la sesión en este navegador (borra las cookies) y vuelve al inicio. */
export async function cerrarSesion(): Promise<void> {
  const supabase = await crearClienteServidor();
  if (supabase) {
    try {
      // `local`: borra la sesión de este navegador aunque Auth no responda.
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Sin red: las cookies se borran igualmente en el cliente de servidor.
    }
  }
  redirect("/");
}
