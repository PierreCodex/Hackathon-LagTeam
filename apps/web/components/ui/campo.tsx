import type { InputHTMLAttributes } from "react";
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
};

/** Campo de texto de 48 px con etiqueta visible y error asociado (DESIGN.md · Campo). */
export function Campo({ id, etiqueta, ayuda, error, className, ...resto }: CampoProps) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const describedBy = [idError, idAyuda].filter(Boolean).join(" ") || undefined;

  return (
    <div className={clases("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-meta text-ink-primary">
        {etiqueta}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clases(
          "h-12 w-full min-w-0 rounded-sm border bg-surface-raised px-3 text-body text-ink-primary",
          "placeholder:text-ink-secondary focus:border-ink-primary",
          "disabled:cursor-not-allowed disabled:text-ink-muted",
          error ? "border-state-error" : "border-ink-muted",
        )}
        {...resto}
      />
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
