import type { ReactNode } from "react";
import { Aviso, BotonEnlace } from "@/components/ui";
import type { IconoDestino } from "@/lib/navegacion";
import { rolBarraDeSesion, type Sesion } from "@/lib/sesion";
import { obtenerSesion } from "@/lib/sesion-servidor";
import { Pantalla } from "./pantalla";

export type PantallaSesionProps = {
  titulo?: string;
  /** Destino activo; solo se marca si está en la barra del rol. */
  destinoActivo?: IconoDestino;
  /** Ruta a la que vuelve "Reintentar" si no se pudo leer el perfil. */
  rutaActual: string;
  /** Sesión ya leída (si la página la necesita); si no, se lee aquí. */
  sesion?: Sesion;
  children?: ReactNode;
};

/** Acción de la cabecera: "Ingresar" sin sesión; "Cuenta" con ella. */
export function AccionCabeceraSesion({ sesion }: { sesion: Sesion }) {
  return sesion.tipo === "anonima" ? (
    <BotonEnlace href="/ingresar" variante="secundario">
      Ingresar
    </BotonEnlace>
  ) : (
    <BotonEnlace href="/cuenta" variante="secundario">
      Cuenta
    </BotonEnlace>
  );
}

/** Aviso cuando hay sesión pero no se pudo leer el perfil: sin menú de ningún rol. */
export function AvisoSesion({ sesion, rutaActual }: { sesion: Sesion; rutaActual: string }) {
  if (sesion.tipo !== "error") return null;
  return (
    <Aviso
      tipo="error"
      titulo="No pudimos cargar tu cuenta."
      accion={
        <BotonEnlace href={rutaActual} variante="secundario" prefetch={false}>
          Reintentar
        </BotonEnlace>
      }
    >
      {sesion.error.mensaje}
    </Aviso>
  );
}

/**
 * `Pantalla` con la cabecera y la barra de la sesión real (historia 1.8):
 * sin sesión, barra de público e "Ingresar"; con sesión, la barra de su rol y "Cuenta";
 * si el perfil no se pudo leer, un aviso con "Reintentar" y ninguna barra.
 */
export async function PantallaSesion({
  titulo,
  destinoActivo,
  rutaActual,
  sesion: sesionDada,
  children,
}: PantallaSesionProps) {
  const sesion = sesionDada ?? (await obtenerSesion());
  return (
    <Pantalla
      titulo={titulo}
      rol={rolBarraDeSesion(sesion)}
      destinoActivo={destinoActivo}
      accionCabecera={<AccionCabeceraSesion sesion={sesion} />}
    >
      <AvisoSesion sesion={sesion} rutaActual={rutaActual} />
      {children}
    </Pantalla>
  );
}
