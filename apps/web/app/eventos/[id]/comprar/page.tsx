import { EventoPublicoSchema, type ErrorApi, type EventoPublico } from "@reto18/shared";
import type { Metadata } from "next";
import { PantallaSesion } from "@/components/layout/pantalla-sesion";
import { FormularioCompra } from "@/components/compra/formulario-compra";
import { Aviso, BotonEnlace, Tarjeta } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { fechaPieza } from "@/lib/pieza";
import { obtenerSesion } from "@/lib/sesion-servidor";

export const metadata: Metadata = { title: "Comprar entradas · Reto 18" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Ficha pública del evento (`GET /eventos/:id`, ya construida en la 1.6): sin auth, igual para todos. */
async function cargarEvento(id: string): Promise<{ evento?: EventoPublico; error?: ErrorApi }> {
  const resultado = await pedirApi(`eventos/${encodeURIComponent(id)}`, EventoPublicoSchema);
  return resultado.ok ? { evento: resultado.datos } : { error: resultado.error };
}

/**
 * Checkout de zona general (historia 8, Flow 2): se llega por URL directa, sin catálogo (1.11) ni
 * ficha completa todavía. Visible sin sesión (AD-1 no exige entrar para VER el checkout, solo para
 * comprar); "Comprar" sin sesión manda a `/ingresar` y vuelve aquí (lo decide `FormularioCompra`).
 */
export default async function ComprarEntrada({ params, searchParams }: Props) {
  const { id } = await params;
  const consulta = await searchParams;
  const refCrudo = consulta.ref;
  const refCampana = typeof refCrudo === "string" && refCrudo !== "" ? refCrudo : undefined;
  const ruta = refCampana
    ? `/eventos/${id}/comprar?ref=${encodeURIComponent(refCampana)}`
    : `/eventos/${id}/comprar`;

  const [{ evento, error }, sesion] = await Promise.all([cargarEvento(id), obtenerSesion()]);
  const whatsappInicial = sesion.tipo === "cuenta" ? sesion.perfil.whatsapp : undefined;

  return (
    <PantallaSesion sesion={sesion} rutaActual={ruta} titulo={evento?.titulo ?? "Comprar entradas"} ancho="formulario">
      {!evento ? (
        <Aviso
          tipo="error"
          titulo="No pudimos cargar el evento."
          accion={
            <BotonEnlace href={ruta} variante="secundario" prefetch={false}>
              Reintentar
            </BotonEnlace>
          }
        >
          {error?.mensaje}
        </Aviso>
      ) : (
        <div className="flex flex-col gap-6">
          <Tarjeta como="section" aria-labelledby="titulo-datos-evento-compra" className="flex flex-col gap-1">
            <h2 id="titulo-datos-evento-compra" className="sr-only">
              Datos del evento
            </h2>
            <p className="text-ink-secondary">{fechaPieza(evento.inicio)}</p>
            <p>
              {evento.sede.nombre} · {evento.distrito}
            </p>
          </Tarjeta>
          <FormularioCompra
            apiUrl={process.env.API_URL ?? ""}
            evento={evento}
            refCampana={refCampana}
            whatsappInicial={whatsappInicial}
            ruta={ruta}
          />
        </div>
      )}
    </PantallaSesion>
  );
}
