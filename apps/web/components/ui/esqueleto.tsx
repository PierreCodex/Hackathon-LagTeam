import type { ReactNode } from "react";
import { clases } from "@/lib/clases";

export type EsqueletoProps = {
  /** Tamaño y forma con utilidades (p. ej. "h-4 w-2/3" o "aspect-[4/5] w-full"). */
  className?: string;
};

/**
 * Bloque de carga con la forma final del contenido (EXPERIENCE.md · Cargando).
 * Es decorativo: el contenedor anuncia "Cargando…" (ver `EsqueletoGrupo`).
 * Con reducir movimiento no pulsa.
 */
export function Esqueleto({ className }: EsqueletoProps) {
  return (
    <div aria-hidden="true" className={clases("rounded-sm bg-border-hairline motion-safe:animate-pulse", className)} />
  );
}

export type EsqueletoGrupoProps = {
  /** Texto para lectores de pantalla. */
  etiqueta?: string;
  children: ReactNode;
  className?: string;
};

/** Agrupa esqueletos y anuncia la carga una sola vez. */
export function EsqueletoGrupo({ etiqueta = "Cargando…", children, className }: EsqueletoGrupoProps) {
  return (
    <div role="status" aria-busy="true" className={clases("flex flex-col gap-3", className)}>
      <span className="sr-only">{etiqueta}</span>
      {children}
    </div>
  );
}
