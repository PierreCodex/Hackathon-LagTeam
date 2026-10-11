import { MapaSedeSchema, PreciosEventoSchema, type ErrorApi, type MapaSede } from "@reto18/shared";
import type { Metadata } from "next";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { PizarraMapa } from "@/components/pizarra/pizarra-mapa";
import { Aviso, BotonEnlace } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { cargarMisEventos, tokenDelServidor } from "../../../datos-organizador";

export const metadata: Metadata = { title: "Mapa de la sede · Reto 18" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ evento?: string }> };

/**
 * Aforo y categorías del evento desde el que se arma el croquis (`?evento=`), o `undefined` si no se
 * encuentra entre los eventos del organizador o ya está publicado (la pizarra queda como antes).
 */
async function cargarObjetivo(eventoId: string | undefined) {
  if (!eventoId) return undefined;
  const { eventos } = await cargarMisEventos();
  const evento = eventos.find((e) => e.id === eventoId);
  const token = await tokenDelServidor();
  if (!evento || evento.publicado || !token) return undefined;
  const precios = await pedirApi(`eventos/${eventoId}/precios`, PreciosEventoSchema, {
    cabeceras: { Authorization: `Bearer ${token}` },
  });
  const categorias = precios.ok ? precios.datos.categorias.map((c) => c.nombre) : [];
  return { eventoId, aforo: evento.aforo, categorias };
}

/** Mapa de `GET .../mapa` con el token de la sesión, o el error para pintarlo con "Reintentar". */
async function cargarMapa(id: string): Promise<{ mapa?: MapaSede; error?: ErrorApi }> {
  const supabase = await crearClienteServidor();
  let token: string | undefined;
  try {
    token = (await supabase?.auth.getSession())?.data.session?.access_token;
  } catch {
    token = undefined;
  }
  if (!token) {
    return {
      error: { codigo: "SIN_SESION", mensaje: "Tu sesión se cerró. Recarga la página para ingresar de nuevo." },
    };
  }
  const resultado = await pedirApi(`eventos/sedes/${id}/mapa`, MapaSedeSchema, {
    cabeceras: { Authorization: `Bearer ${token}` },
  });
  return resultado.ok ? { mapa: resultado.datos } : { error: resultado.error };
}

async function ContenidoMapa({ id, ruta, eventoId }: { id: string; ruta: string; eventoId?: string }) {
  const [{ mapa, error }, objetivo] = await Promise.all([cargarMapa(id), cargarObjetivo(eventoId)]);
  if (!mapa) {
    return (
      <Aviso
        tipo="error"
        titulo="No pudimos cargar el mapa de la sede."
        accion={
          <BotonEnlace href={ruta} variante="secundario" prefetch={false}>
            Reintentar
          </BotonEnlace>
        }
      >
        {error?.mensaje}
      </Aviso>
    );
  }
  return <PizarraMapa modo="editar" sedeId={id} mapaInicial={mapa} apiUrl={process.env.API_URL ?? ""} objetivo={objetivo} />;
}

/**
 * Abre el mapa de una sede existente para editarlo (historia 2.9). `GET` nunca devuelve
 * `SEDE_AJENA`/`MAPA_CERRADO` (Design Notes): la pizarra siempre se abre editable y solo ofrece
 * duplicar si el guardado falla con esos códigos.
 */
export default async function MapaSedePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { evento } = await searchParams;
  const ruta = `/organizador/sedes/${id}/mapa${evento ? `?evento=${encodeURIComponent(evento)}` : ""}`;
  return (
    <GuardaRol rol="organizador" ruta={ruta} titulo="Mapa de la sede" destinoActivo="mis-eventos">
      {() => <ContenidoMapa id={id} ruta={ruta} eventoId={evento} />}
    </GuardaRol>
  );
}
