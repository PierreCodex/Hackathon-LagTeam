import { ListaEventosRevisionSchema, type ErrorApi, type EventoRevision } from "@reto18/shared";
import type { Metadata } from "next";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { Aviso, BotonEnlace } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { ERROR_SIN_SESION, tokenDelServidor } from "../organizador/datos-organizador";
import { PanelAprobacion } from "./panel-aprobacion";

export const metadata: Metadata = { title: "Aprobar · Reto 18" };

const RUTA = "/admin";

/** Pendientes (`GET /eventos/pendientes`, 1.5) con el token de la sesión, o el error para pintarlo. */
async function cargarPendientes(): Promise<{ pendientes: EventoRevision[]; error?: ErrorApi }> {
  const token = await tokenDelServidor();
  if (!token) return { pendientes: [], error: ERROR_SIN_SESION };
  const resultado = await pedirApi("eventos/pendientes", ListaEventosRevisionSchema, {
    cabeceras: { Authorization: `Bearer ${token}` },
  });
  return resultado.ok ? { pendientes: resultado.datos } : { pendientes: [], error: resultado.error };
}

async function ContenidoAprobar() {
  const { pendientes, error } = await cargarPendientes();

  if (error) {
    return (
      <Aviso
        tipo="error"
        titulo="No pudimos cargar los eventos pendientes."
        accion={
          <BotonEnlace href={RUTA} variante="secundario" prefetch={false}>
            Reintentar
          </BotonEnlace>
        }
      >
        {error.mensaje}
      </Aviso>
    );
  }

  return (
    <>
      <p className="text-ink-secondary">
        Lee cada evento y su constancia de APDAYC. Aprueba, o rechaza con un motivo que el organizador verá.
      </p>
      <PanelAprobacion apiUrl={process.env.API_URL ?? ""} pendientes={pendientes} rutaActual={RUTA} />
    </>
  );
}

/** Aprobar (historia 1.10, Flow 4): pendientes, constancia, alerta de APDAYC, aprobar, rechazar y destacar. */
export default function PortadaAdmin() {
  return (
    <GuardaRol rol="admin" ruta={RUTA} titulo="Aprobar" destinoActivo="aprobar">
      {() => <ContenidoAprobar />}
    </GuardaRol>
  );
}
