import type { ButtonHTMLAttributes } from "react";
import { clases } from "@/lib/clases";

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Filtro aplicado: borde y texto blancos y punto rojo. Se anuncia con aria-pressed. */
  activo?: boolean;
};

/**
 * Chip de filtro de 32 px (DESIGN.md · Chip). El área táctil se amplía a 48 px
 * con un pseudo-elemento, sin cambiar el aspecto.
 */
export function Chip({ activo = false, className, children, type = "button", ...resto }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={activo}
      className={clases(
        "relative inline-flex h-8 shrink-0 items-center gap-2 rounded-full border bg-surface-overlay px-3",
        "text-meta whitespace-nowrap",
        "after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']",
        activo ? "border-ink-primary text-ink-primary" : "border-transparent text-ink-secondary",
        className,
      )}
      {...resto}
    >
      {activo && <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />}
      {children}
    </button>
  );
}
