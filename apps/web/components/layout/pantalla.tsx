import type { ReactNode } from "react";
import { clases } from "@/lib/clases";
import type { IconoDestino, Rol } from "@/lib/navegacion";
import { BarraInferior } from "./barra-inferior";
import { Cabecera } from "./cabecera";

export type PantallaProps = {
  /** Título de la pantalla (h1 en estilo `title`). Opcional si la página pone el suyo. */
  titulo?: string;
  /** Acción a la derecha de la cabecera. */
  accionCabecera?: ReactNode;
  /** Rol para la barra inferior. Sin rol no se pinta barra. */
  rol?: Rol;
  /** Destino activo de la barra inferior. */
  destinoActivo?: IconoDestino;
  children: ReactNode;
};

/**
 * Esqueleto de toda pantalla: cabecera, contenido y barra inferior por rol.
 * Una columna con márgenes de 16 px; desde 768 px el contenido se centra a 480 px.
 */
export function Pantalla({ titulo, accionCabecera, rol, destinoActivo, children }: PantallaProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-20 focus:rounded-sm focus:bg-surface-overlay focus:p-3"
      >
        Saltar al contenido
      </a>
      <Cabecera accion={accionCabecera} />
      <main
        id="contenido"
        tabIndex={-1}
        className={clases(
          "mx-auto flex w-full flex-1 flex-col gap-4 px-margin-mobile py-4 outline-none md:max-w-contenido",
          // Hueco para que la barra fija no tape el final del contenido.
          rol && "pb-[calc(4rem+16px+env(safe-area-inset-bottom))]",
        )}
      >
        {titulo && <h1 className="text-title">{titulo}</h1>}
        {children}
      </main>
      {rol && <BarraInferior rol={rol} activo={destinoActivo} />}
    </div>
  );
}
