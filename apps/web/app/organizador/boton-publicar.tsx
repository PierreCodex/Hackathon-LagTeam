"use client";

import { EventoSchema, type ErrorApi } from "@reto18/shared";
import { useState } from "react";
import { Aviso, Boton } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { tokenDelNavegador } from "@/lib/supabase/navegador";

/**
 * "Publicar" de un evento aprobado (`POST /eventos/:id/publicar`): solo los eventos publicados salen en
 * el catálogo y se pueden comprar. Publicar cierra el mapa de la sede; si faltan precios, la API lo dice.
 */
export function BotonPublicar({ eventoId, apiUrl }: { eventoId: string; apiUrl: string }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorApi | null>(null);

  async function publicar() {
    if (enviando) return;
    if (!window.confirm("Al publicar, el evento sale a la venta y el mapa de butacas ya no se puede cambiar. ¿Publicar?")) return;
    setEnviando(true);
    setError(null);
    const token = await tokenDelNavegador();
    if (!token) {
      setEnviando(false);
      setError({ codigo: "SIN_SESION", mensaje: "Tu sesión se cerró. Recarga la página para ingresar de nuevo." });
      return;
    }
    const resultado = await pedirApi(`eventos/${eventoId}/publicar`, EventoSchema, {
      apiUrl,
      metodo: "POST",
      cabeceras: { Authorization: `Bearer ${token}` },
    });
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    window.location.reload();
  }

  return (
    <>
      <Boton onClick={() => void publicar()} disabled={enviando} className="self-start max-sm:w-full">
        {enviando ? "Publicando…" : "Publicar"}
      </Boton>
      {error && (
        <Aviso tipo="error" titulo="No pudimos publicar el evento.">
          {error.mensaje}
        </Aviso>
      )}
    </>
  );
}
