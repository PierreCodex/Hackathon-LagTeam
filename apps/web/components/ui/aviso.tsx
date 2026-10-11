import type { ReactNode } from "react";
import { clases } from "@/lib/clases";

export type TipoAviso = "exito" | "advertencia" | "error" | "info";

// Cada estado lleva símbolo y una etiqueta para lectores de pantalla: nunca solo color.
const ESTILOS: Record<TipoAviso, { borde: string; icono: string; simbolo: string; etiqueta: string }> = {
  exito: { borde: "border-l-state-success", icono: "text-state-success", simbolo: "✓", etiqueta: "Listo" },
  advertencia: { borde: "border-l-state-warning", icono: "text-state-warning", simbolo: "!", etiqueta: "Atención" },
  error: { borde: "border-l-state-error", icono: "text-state-error", simbolo: "✕", etiqueta: "Error" },
  info: { borde: "border-l-ink-secondary", icono: "text-ink-secondary", simbolo: "i", etiqueta: "Información" },
};

export type AvisoProps = {
  tipo: TipoAviso;
  /** Frase principal, corta y en trato de tú. */
  titulo: string;
  /** Detalle opcional (p. ej. el `mensaje` de la API tal cual). */
  children?: ReactNode;
  /** Acción opcional bajo el texto, normalmente "Reintentar" (un `BotonEnlace` o `Boton`). */
  accion?: ReactNode;
  className?: string;
};

/** Banda en overlay con borde izquierdo de 3 px del color del estado (DESIGN.md · Aviso). */
export function Aviso({ tipo, titulo, children, accion, className }: AvisoProps) {
  const estilo = ESTILOS[tipo];
  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      className={clases(
        "flex gap-3 rounded-sm border-l-[3px] bg-surface-overlay p-4",
        estilo.borde,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clases(
          "flex size-6 shrink-0 items-center justify-center rounded-full border text-meta font-bold",
          estilo.icono,
        )}
      >
        {estilo.simbolo}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-bold text-ink-primary [overflow-wrap:anywhere]">
          <span className="sr-only">{estilo.etiqueta}: </span>
          {titulo}
        </p>
        {children && <div className="text-meta text-ink-secondary [overflow-wrap:anywhere]">{children}</div>}
        {accion && <div className="mt-2">{accion}</div>}
      </div>
    </div>
  );
}
