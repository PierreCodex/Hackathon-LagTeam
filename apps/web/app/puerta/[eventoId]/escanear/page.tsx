import type { Metadata } from "next";
import { GuardaCuenta } from "@/components/layout/guarda-cuenta";
import { Escaner } from "@/components/puerta/escaner";

export const metadata: Metadata = { title: "Escanear entradas · Reto 18" };

type Props = { params: Promise<{ eventoId: string }> };

/**
 * Escáner de la puerta de un evento (historia 8, Flow 3): sesión de organizador dueño del evento
 * (403/404 lo decide la API) o admin -- la 2.1 no creó un rol `puerta` nuevo para esto. Se llega por
 * URL directa, igual que la pizarra de la 2.9.
 */
export default async function EscanearPuerta({ params }: Props) {
  const { eventoId } = await params;
  const ruta = `/puerta/${eventoId}/escanear`;
  return (
    <GuardaCuenta roles={["organizador", "admin"]} ruta={ruta} titulo="Escanear entradas" ancho="formulario">
      {() => <Escaner apiUrl={process.env.API_URL ?? ""} eventoId={eventoId} ruta={ruta} />}
    </GuardaCuenta>
  );
}
