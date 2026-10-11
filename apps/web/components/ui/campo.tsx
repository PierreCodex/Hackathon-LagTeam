import type { InputHTMLAttributes, ReactNode } from "react";
import { clases } from "@/lib/clases";

export type CampoProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  /** Clases del contenedor (etiqueta + campo + mensajes), no del `<input>`. */
  className?: string;
  /** Obligatorio: une la etiqueta, la ayuda y el error con el campo. */
  id: string;
  /** Etiqueta visible encima del campo (nunca solo placeholder). */
  etiqueta: string;
  /** Texto de ayuda opcional bajo el campo. */
  ayuda?: string;
  /** Mensaje de error que explica qué corregir. Se asocia con aria-describedby. */
  error?: string;
  /** Botón dentro del campo, a la derecha (p. ej. mostrar u ocultar la contraseña). */
  accesorio?: ReactNode;
};

/** Campo de texto de 48 px con etiqueta visible y error asociado (DESIGN.md · Campo). */
export function Campo({ id, etiqueta, ayuda, error, accesorio, className, ...resto }: CampoProps) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const describedBy = [idError, idAyuda].filter(Boolean).join(" ") || undefined;

  return (
    <div className={clases("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-meta text-ink-primary">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={clases(
            // Borde de 1 px #BDBFC1; al enfocar, 2 px en tinta (el relleno compensa el grosor).
            "h-12 w-full min-w-0 rounded-sm border bg-surface-raised px-3 text-body text-ink-primary",
            "placeholder:text-ink-secondary focus:border-2 focus:px-[11px]",
            "disabled:cursor-not-allowed disabled:text-ink-muted",
            accesorio ? "pr-12 focus:pr-12" : undefined,
            error ? "border-state-error" : "border-ink-on-inverse-secondary focus:border-ink-primary",
          )}
          {...resto}
        />
        {accesorio && <div className="absolute inset-y-0 right-0 flex items-center">{accesorio}</div>}
      </div>
      {error && (
        <p id={idError} className="flex items-start gap-2 text-meta text-state-error">
          <span aria-hidden="true">✕</span>
          <span>{error}</span>
        </p>
      )}
      {ayuda && (
        <p id={idAyuda} className="text-meta text-ink-secondary">
          {ayuda}
        </p>
      )}
    </div>
  );
}
