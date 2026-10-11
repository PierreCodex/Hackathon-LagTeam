import Link from "next/link";
import type { ReactNode } from "react";
import type { Sesion } from "@/lib/sesion";
import { IsotipoMarcaAgua, Logotipo } from "./marca";
import { PantallaSesion } from "./pantalla-sesion";

export type PantallaAccesoProps = {
  sesion: Sesion;
  /** Ruta de la página, para "Reintentar" si no se pudo leer el perfil. */
  rutaActual: string;
  /** Título de la pantalla (el único h1). */
  titulo: string;
  subtitulo: string;
  /** Enlace a la pantalla inversa ("¿No tienes cuenta? Regístrate" o "¿Ya tienes cuenta? Ingresa"). */
  enlaceInverso: { pregunta: string; texto: string; href: string };
  /** El formulario. */
  children: ReactNode;
};

/**
 * Pantalla de acceso (DESIGN.md · Pantalla de acceso), dentro de `Pantalla` con cabecera, pie y barra.
 * Desde 1024 px, dos mitades: el panel de marca carbón y el formulario a 480 px. En móvil, solo el formulario.
 * La cabecera va sin botones, para no tener dos botones rojos.
 */
export function PantallaAcceso({
  sesion,
  rutaActual,
  titulo,
  subtitulo,
  enlaceInverso,
  children,
}: PantallaAccesoProps) {
  return (
    // Sin botones solo sin sesión: con el perfil sin leer queda "Cuenta", para poder cerrar sesión.
    <PantallaSesion sesion={sesion} rutaActual={rutaActual} sinAccionesCabecera={sesion.tipo === "anonima"}>
      <div className="grid flex-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Panel de marca: sin flyer hasta que exista el catálogo. */}
        <div className="superficie-inversa relative hidden overflow-hidden rounded-md bg-surface-inverse text-ink-on-inverse lg:block">
          <IsotipoMarcaAgua className="-bottom-16 -left-20 w-[420px] opacity-[0.06]" />
          <div className="relative flex h-full flex-col items-center justify-center gap-7 p-12 text-center">
            <Logotipo variante="oscuro" className="h-16" />
            <p className="text-[44px] leading-[1.05] font-black">Crea y vende tu evento con IA</p>
            <p className="max-w-sm text-ink-on-inverse-secondary">
              Publica tu evento, genera sus piezas de difusión y vende entradas con mapa de butacas.
            </p>
          </div>
        </div>

        <section
          aria-labelledby="titulo-acceso"
          className="flex flex-col rounded-md border border-border-hairline bg-surface-raised px-4 pt-4 pb-8 lg:px-10 lg:pt-8 lg:pb-12"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <Link
              href="/"
              className="-ml-2 inline-flex min-h-12 items-center gap-1.5 rounded-sm px-2 font-bold text-ink-primary no-underline"
            >
              <span aria-hidden="true">‹</span> Volver
            </Link>
            <p className="flex items-center gap-2 text-meta text-ink-secondary">
              {enlaceInverso.pregunta}
              <Link
                href={enlaceInverso.href}
                className="inline-flex min-h-12 items-center rounded-full px-1 font-bold text-ink-primary no-underline"
              >
                <span className="rounded-full border border-ink-muted px-3.5 py-1.5">{enlaceInverso.texto}</span>
              </Link>
            </p>
          </div>
          <div className="mx-auto mt-6 flex w-full max-w-formulario flex-col gap-4 lg:mt-10">
            <Logotipo variante="claro" className="h-14 self-start" />
            <div className="flex flex-col gap-1">
              <h1 id="titulo-acceso" className="text-display">
                {titulo}
              </h1>
              <p className="text-ink-secondary">{subtitulo}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </PantallaSesion>
  );
}
