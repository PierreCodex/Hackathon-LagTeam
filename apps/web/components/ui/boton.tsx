import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { clases } from "@/lib/clases";

export type VarianteBoton = "primario" | "secundario" | "inverso";

type PropsComunes = {
  /**
   * Primario: el único botón rojo de la pantalla. Secundario: contorno gris, sin relleno.
   * Inverso: contorno gris y texto blanco, para usar sobre carbón (cabecera, pie, panel de acceso).
   */
  variante?: VarianteBoton;
  /** Ocupa todo el ancho (lo normal en móvil para la acción principal). */
  anchoCompleto?: boolean;
};

const ESTILO_VARIANTE: Record<VarianteBoton, string> = {
  primario: "bg-accent text-on-accent hover:bg-accent-pressed active:bg-accent-pressed",
  secundario: "border border-ink-muted bg-transparent text-ink-primary hover:border-ink-primary active:bg-border-hairline",
  inverso:
    "border border-ink-muted bg-transparent text-ink-on-inverse hover:border-ink-on-inverse active:bg-surface-inverse-raised",
};

function clasesBoton(variante: VarianteBoton, anchoCompleto: boolean | undefined) {
  return clases(
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-6 text-button",
    "select-none no-underline",
    ESTILO_VARIANTE[variante],
    // Deshabilitado: línea fina de fondo y texto apagado, sea cual sea la variante (DESIGN.md · Botón primario).
    "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-border-hairline disabled:text-ink-muted",
    "aria-disabled:pointer-events-none aria-disabled:border-transparent aria-disabled:bg-border-hairline aria-disabled:text-ink-muted",
    anchoCompleto && "w-full",
  );
}

export type BotonProps = PropsComunes & ButtonHTMLAttributes<HTMLButtonElement>;

/** Botón de acción. 48 px de alto, foco visible heredado de la base (blanco sobre carbón). */
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
