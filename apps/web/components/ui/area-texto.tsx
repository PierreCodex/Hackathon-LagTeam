import type { TextareaHTMLAttributes } from "react";
import { clases } from "@/lib/clases";
import { describirCampo, MensajesCampo } from "./mensajes-campo";

export type AreaTextoProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className"> & {
  /** Clases del contenedor (etiqueta + área + mensajes). */
  className?: string;
  /** Obligatorio: une la etiqueta, la ayuda y el error con el área. */
  id: string;
  /** Etiqueta visible encima (nunca solo placeholder). */
  etiqueta: string;
  ayuda?: string;
  error?: string;
};

/** Área de texto con el mismo aspecto que `Campo`: etiqueta visible, error asociado y 48 px como mínimo. */
export function AreaTexto({ id, etiqueta, ayuda, error, className, rows = 4, ...resto }: AreaTextoProps) {
  return (
    <div className={clases("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-meta text-ink-primary">
        {etiqueta}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describirCampo(id, ayuda, error)}
        className={clases(
          "min-h-12 w-full min-w-0 rounded-sm border bg-surface-raised px-3 py-3 text-body text-ink-primary",
          "placeholder:text-ink-secondary focus:border-2 focus:px-[11px] focus:py-[11px]",
          "disabled:cursor-not-allowed disabled:text-ink-muted",
          error ? "border-state-error" : "border-ink-on-inverse-secondary focus:border-ink-primary",
        )}
        {...resto}
      />
      <MensajesCampo id={id} ayuda={ayuda} error={error} />
    </div>
  );
}
