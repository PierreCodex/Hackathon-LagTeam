import Link from "next/link";
import type { ReactNode } from "react";
import { Aviso, BotonEnlace } from "@/components/ui";
import { clases } from "@/lib/clases";
import type { IconoDestino } from "@/lib/navegacion";
import { rolBarraDeSesion, type Sesion } from "@/lib/sesion";
import { obtenerSesion } from "@/lib/sesion-servidor";
import { Pantalla, type PantallaProps } from "./pantalla";

export type PantallaSesionProps = {
  titulo?: string;
  /** Destino activo; solo se marca si está en la barra del rol. */
  destinoActivo?: IconoDestino;
  /** Ruta a la que vuelve "Reintentar" si no se pudo leer el perfil. */
  rutaActual: string;
  /** Sesión ya leída (si la página la necesita); si no, se lee aquí. */
  sesion?: Sesion;
  /** Ancho del contenido (ver `Pantalla`). */
  ancho?: PantallaProps["ancho"];
  /** Sin acción en la cabecera (acceso y registro). */
  sinAccionesCabecera?: boolean;
  children?: ReactNode;
};

/**
 * Acción de la cabecera. Sin sesión: "Registrarse" (inverso, solo desde 1024 px) e "Ingresar" (primario).
 * Con cuenta: su inicial y su correo (el correo solo desde 1024 px), que llevan a `/cuenta`.
 * Con el perfil sin leer: "Cuenta", para poder cerrar sesión.
 */
export function AccionCabeceraSesion({ sesion, activa }: { sesion: Sesion; activa?: boolean }) {
  if (sesion.tipo === "anonima") {
    return (
      <>
        <BotonEnlace href="/registro" variante="inverso" className="max-lg:hidden">
          Registrarse
        </BotonEnlace>
        <BotonEnlace href="/ingresar">Ingresar</BotonEnlace>
      </>
    );
  }
  if (sesion.tipo === "error") {
    return (
      <BotonEnlace href="/cuenta" variante="inverso" aria-current={activa ? "page" : undefined}>
        Cuenta
      </BotonEnlace>
    );
  }
  const correo = sesion.perfil.correo;
  return (
    <Link
      href="/cuenta"
      aria-label={`Tu cuenta: ${correo}`}
      aria-current={activa ? "page" : undefined}
      className={clases(
        "relative flex min-h-12 min-w-12 items-center justify-center gap-2.5 rounded-md text-meta text-ink-on-inverse no-underline",
        // En /cuenta, desde 1024 px, el mismo subrayado rojo de 3 px que el destino activo del menú (al pie de la cabecera).
        activa && "lg:after:absolute lg:after:inset-x-0 lg:after:-bottom-2.5 lg:after:h-[3px] lg:after:bg-accent lg:after:content-['']",
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-inverse-raised font-bold"
      >
        {correo.charAt(0).toUpperCase()}
      </span>
      <span aria-hidden="true" className="hidden max-w-64 truncate lg:block">
        {correo}
      </span>
    </Link>
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
 * sin sesión, menú y barra de público e "Ingresar"; con sesión, el menú y la barra de su rol y su cuenta;
 * si el perfil no se pudo leer, un aviso con "Reintentar" y ningún menú ni barra.
 */
export async function PantallaSesion({
  titulo,
  destinoActivo,
  rutaActual,
  sesion: sesionDada,
  ancho,
  sinAccionesCabecera,
  children,
}: PantallaSesionProps) {
  const sesion = sesionDada ?? (await obtenerSesion());
  return (
    <Pantalla
      titulo={titulo}
      rol={rolBarraDeSesion(sesion)}
      destinoActivo={destinoActivo}
      conSesion={sesion.tipo !== "anonima"}
      ancho={ancho}
      sinAccionesCabecera={sinAccionesCabecera}
      accionCabecera={<AccionCabeceraSesion sesion={sesion} activa={destinoActivo === "cuenta"} />}
    >
      <AvisoSesion sesion={sesion} rutaActual={rutaActual} />
      {children}
    </Pantalla>
  );
}
