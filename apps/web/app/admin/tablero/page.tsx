import { type ErrorApi, type Tablero, TableroSchema } from "@reto18/shared";
import type { Metadata } from "next";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { Aviso, BotonEnlace } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { ERROR_SIN_SESION, tokenDelServidor } from "../../organizador/datos-organizador";
import { PanelTablero } from "./panel-tablero";

export const metadata: Metadata = { title: "Tablero · Reto 18" };

const RUTA = "/admin/tablero";

/** Tablero (`GET /negocio/tablero`) con el token de la sesión, o el error para pintarlo. */
async function cargarTablero(): Promise<{ tablero?: Tablero; error?: ErrorApi }> {
  const token = await tokenDelServidor();
  if (!token) return { error: ERROR_SIN_SESION };
  const resultado = await pedirApi("negocio/tablero", TableroSchema, {
    cabeceras: { Authorization: `Bearer ${token}` },
  });
  return resultado.ok ? { tablero: resultado.datos } : { error: resultado.error };
}

async function ContenidoTablero() {
  const { tablero, error } = await cargarTablero();
  if (!tablero) {
    return (
      <Aviso
        tipo="error"
        titulo="No pudimos cargar el tablero."
        accion={
          <BotonEnlace href={RUTA} variante="secundario" prefetch={false}>
            Reintentar
          </BotonEnlace>
        }
      >
        {error?.mensaje}
      </Aviso>
    );
  }
  return <PanelTablero apiUrl={process.env.API_URL ?? ""} tablero={tablero} />;
}

/** Tablero del administrador (bloque C del recorte final): ventas, asistencia, público, comisión, liquidación y Excel. */
export default function PaginaTablero() {
  return (
    <GuardaRol rol="admin" ruta={RUTA} titulo="Tablero" destinoActivo="tablero">
      {() => <ContenidoTablero />}
    </GuardaRol>
  );
}
