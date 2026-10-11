import { MapaSedeSchema, PreciosEventoSchema, type ErrorApi, type EventoRevision, type MapaSede, type PreciosEvento } from "@reto18/shared";
import type { Metadata } from "next";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { PizarraPrecios } from "@/components/pizarra/pizarra-precios";
import { Aviso, BotonEnlace } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { cargarMisEventos, tokenDelServidor } from "../../../datos-organizador";

export const metadata: Metadata = { title: "Precios del evento · Reto 18" };

type Props = { params: Promise<{ id: string }> };

type Carga =
  | { ok: true; evento: EventoRevision; mapa: MapaSede; precios: PreciosEvento }
  | { ok: false; error: ErrorApi };

const ERROR_EVENTO_NO_ENCONTRADO: ErrorApi = {
  codigo: "EVENTO_NO_EXISTE",
  mensaje: "No encontramos este evento entre tus eventos.",
};

/**
 * El evento (de `cargarMisEventos`, para su `sede_id` y si está `publicado`), el mapa de su sede
 * (`GET .../sedes/:id/mapa`, estructura de solo lectura, 2.9) y los precios (`GET .../:id/precios`, 2.4).
 */
async function cargarPantalla(eventoId: string): Promise<Carga> {
  const { eventos, error: errorEventos } = await cargarMisEventos();
  if (errorEventos) return { ok: false, error: errorEventos };
  const evento = eventos.find((e) => e.id === eventoId);
  if (!evento) return { ok: false, error: ERROR_EVENTO_NO_ENCONTRADO };

  const token = await tokenDelServidor();
  if (!token) {
    return {
      ok: false,
      error: { codigo: "SIN_SESION", mensaje: "Tu sesión se cerró. Recarga la página para ingresar de nuevo." },
    };
  }
  const cabeceras = { Authorization: `Bearer ${token}` };
  const [mapaResultado, preciosResultado] = await Promise.all([
    pedirApi(`eventos/sedes/${evento.sede_id}/mapa`, MapaSedeSchema, { cabeceras }),
    pedirApi(`eventos/${eventoId}/precios`, PreciosEventoSchema, { cabeceras }),
  ]);
  if (!mapaResultado.ok) return { ok: false, error: mapaResultado.error };
  if (!preciosResultado.ok) return { ok: false, error: preciosResultado.error };
  return { ok: true, evento, mapa: mapaResultado.datos, precios: preciosResultado.datos };
}

async function ContenidoPrecios({ eventoId, ruta }: { eventoId: string; ruta: string }) {
  const carga = await cargarPantalla(eventoId);
  if (!carga.ok) {
    return (
      <Aviso
        tipo="error"
        titulo="No pudimos abrir los precios de este evento."
        accion={
          <BotonEnlace href={ruta} variante="secundario" prefetch={false}>
            Reintentar
          </BotonEnlace>
        }
      >
        {carga.error.mensaje}
      </Aviso>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BotonEnlace href="/organizador" variante="secundario" className="self-start">
          ← Mis eventos
        </BotonEnlace>
        <h2 className="text-title [overflow-wrap:anywhere]">{carga.evento.titulo}</h2>
      </div>
      <PizarraPrecios
        eventoId={eventoId}
        mapa={carga.mapa}
        precios={carga.precios}
        apiUrl={process.env.API_URL ?? ""}
        soloLectura={carga.evento.publicado}
      />
    </div>
  );
}

/** Pizarra de precios de un evento (historia 2.10): pintar rangos de asientos con su categoría de precio. */
export default async function PreciosEventoPage({ params }: Props) {
  const { id } = await params;
  const ruta = `/organizador/eventos/${id}/precios`;
  return (
    <GuardaRol rol="organizador" ruta={ruta} titulo="Precios" destinoActivo="mis-eventos">
      {() => <ContenidoPrecios eventoId={id} ruta={ruta} />}
    </GuardaRol>
  );
}
