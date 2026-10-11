import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { clases } from "@/lib/clases";

export type VarianteBoton = "primario" | "secundario";

type PropsComunes = {
  /** Primario: el único botón rojo de la pantalla. Secundario: contorno gris, sin relleno. */
  variante?: VarianteBoton;
  /** Ocupa todo el ancho (lo normal en móvil para la acción principal). */
  anchoCompleto?: boolean;
};

function clasesBoton(variante: VarianteBoton, anchoCompleto: boolean | undefined) {
  return clases(
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-6 text-button",
    "select-none no-underline",
    variante === "primario"
      ? "bg-accent text-on-accent active:bg-accent-pressed"
      : "border border-ink-muted bg-transparent text-ink-primary active:bg-surface-overlay",
    // Deshabilitado: fondo overlay y texto apagado, sea cual sea la variante (DESIGN.md · Botón primario).
    "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-overlay disabled:text-ink-muted",
    "aria-disabled:pointer-events-none aria-disabled:border-transparent aria-disabled:bg-surface-overlay aria-disabled:text-ink-muted",
    anchoCompleto && "w-full",
  );
}

export type BotonProps = PropsComunes & ButtonHTMLAttributes<HTMLButtonElement>;

/** Botón de acción. 48 px de alto, foco blanco heredado de la base. */
export function Boton({
  variante = "primario",
  anchoCompleto,
  className,
  type = "button",
  ...resto
}: BotonProps) {
  return (
    <button type={type} className={clases(clasesBoton(variante, anchoCompleto), className)} {...resto} />
  );
}

export type BotonEnlaceProps = PropsComunes & ComponentProps<typeof Link>;

/** Enlace con aspecto de botón (navegar, "Reintentar" recargando la ruta). */
export function BotonEnlace({ variante = "primario", anchoCompleto, className, ...resto }: BotonEnlaceProps) {
  return <Link className={clases(clasesBoton(variante, anchoCompleto), className)} {...resto} />;
}
