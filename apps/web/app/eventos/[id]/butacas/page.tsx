import {
  ButacasVentaSchema,
  EventoPublicoSchema,
  MapaSedeSchema,
  type ButacaVenta,
  type ErrorApi,
  type EventoPublico,
  type MapaSede,
} from "@reto18/shared";
import type { Metadata } from "next";
import { MapaButacas } from "@/components/compra/mapa-butacas";
import { PantallaSesion } from "@/components/layout/pantalla-sesion";
import { Aviso, BotonEnlace } from "@/components/ui";
import { pedirApi } from "@/lib/api";

export const metadata: Metadata = { title: "Elige tu butaca · Reto 18" };

type Props = { params: Promise<{ id: string }> };

interface DatosButacas {
  evento?: EventoPublico;
  mapa?: MapaSede;
  butacas?: ButacaVenta[];
  error?: ErrorApi;
}

/**
 * Ficha pública (para el título y la sede), el mapa estructural y el estado inicial de las butacas,
 * en paralelo. `GET .../butacas` también asegura el inventario (idempotente): al cargar la pantalla,
 * las butacas de este evento ya tienen su fila en `ventas_evento_asientos` para que Realtime las siga.
 */
async function cargarDatos(id: string): Promise<DatosButacas> {
  const [evento, mapa, butacas] = await Promise.all([
    pedirApi(`eventos/${encodeURIComponent(id)}`, EventoPublicoSchema),
    pedirApi(`eventos/${encodeURIComponent(id)}/mapa-venta`, MapaSedeSchema),
    pedirApi(`ventas/eventos/${encodeURIComponent(id)}/butacas`, ButacasVentaSchema),
  ]);
  if (!evento.ok) return { error: evento.error };
  if (!mapa.ok) return { error: mapa.error };
  if (!butacas.ok) return { error: butacas.error };
  return { evento: evento.datos, mapa: mapa.datos, butacas: butacas.datos };
}

/**
 * Mapa de butacas (historia 2.11, versión reducida): se llega por URL directa, visible sin sesión
 * (AD-1 no exige entrar para VER el mapa, solo para comprar). "Comprar" sin sesión manda a `/ingresar`
 * y vuelve aquí (lo decide `MapaButacas`).
 */
// Siempre fresco: el estado de las butacas cambia con cada compra.
export const dynamic = "force-dynamic";

export default async function ElegirButaca({ params }: Props) {
  const { id } = await params;
  const ruta = `/eventos/${id}/butacas`;
  const { evento, mapa, butacas, error } = await cargarDatos(id);

  return (
    <PantallaSesion rutaActual={ruta} titulo={evento?.titulo ?? "Elige tu butaca"}>
      {!evento || !mapa || !butacas ? (
        <Aviso
          tipo="error"
          titulo="No pudimos cargar el mapa de butacas."
          accion={
            <BotonEnlace href={ruta} variante="secundario" prefetch={false}>
              Reintentar
            </BotonEnlace>
          }
        >
          {error?.mensaje}
        </Aviso>
      ) : (
        <MapaButacas
          eventoId={id}
          mapa={mapa}
          evento={evento}
          butacasIniciales={butacas}
          apiUrl={process.env.API_URL ?? ""}
        />
      )}
    </PantallaSesion>
  );
}
