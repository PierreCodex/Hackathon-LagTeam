import { MapaSedeSchema, type ErrorApi, type MapaSede } from "@reto18/shared";
import type { Metadata } from "next";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { PizarraMapa } from "@/components/pizarra/pizarra-mapa";
import { Aviso, BotonEnlace } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Mapa de la sede · Reto 18" };

type Props = { params: Promise<{ id: string }> };

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

async function ContenidoMapa({ id, ruta }: { id: string; ruta: string }) {
  const { mapa, error } = await cargarMapa(id);
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
  return <PizarraMapa modo="editar" sedeId={id} mapaInicial={mapa} apiUrl={process.env.API_URL ?? ""} />;
}

/**
 * Abre el mapa de una sede existente para editarlo (historia 2.9). `GET` nunca devuelve
 * `SEDE_AJENA`/`MAPA_CERRADO` (Design Notes): la pizarra siempre se abre editable y solo ofrece
 * duplicar si el guardado falla con esos códigos.
 */
export default async function MapaSedePage({ params }: Props) {
  const { id } = await params;
  const ruta = `/organizador/sedes/${id}/mapa`;
  return (
    <GuardaRol rol="organizador" ruta={ruta} titulo="Mapa de la sede" destinoActivo="mis-eventos">
      {() => <ContenidoMapa id={id} ruta={ruta} />}
    </GuardaRol>
  );
}
