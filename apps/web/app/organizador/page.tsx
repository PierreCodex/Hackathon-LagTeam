import type { Metadata } from "next";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { cargarMisEventos } from "./datos-organizador";
import { ContenidoMisEventos } from "./fila-mis-eventos";

export const metadata: Metadata = { title: "Mis eventos · Reto 18" };

const RUTA = "/organizador";

async function ListaMisEventos() {
  const { eventos, error } = await cargarMisEventos();
  return <ContenidoMisEventos eventos={eventos} error={error} rutaActual={RUTA} apiUrl={process.env.API_URL ?? ""} />;
}

/** Mis eventos del organizador (1.8, 1.10): "Nuevo evento" y la lista con estado y motivo del rechazo. */
export default function PortadaOrganizador() {
  return (
    <GuardaRol rol="organizador" ruta={RUTA} titulo="Tus eventos" destinoActivo="mis-eventos">
      {() => <ListaMisEventos />}
    </GuardaRol>
  );
}
