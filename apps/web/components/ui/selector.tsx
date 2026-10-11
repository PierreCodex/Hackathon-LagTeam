import type { SelectHTMLAttributes } from "react";
import { clases } from "@/lib/clases";
import { describirCampo, MensajesCampo } from "./mensajes-campo";

export type OpcionSelector = { valor: string; etiqueta: string };

export type SelectorProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className" | "children"> & {
  /** Clases del contenedor (etiqueta + selector + mensajes). */
  className?: string;
  /** Obligatorio: une la etiqueta, la ayuda y el error con el selector. */
  id: string;
  etiqueta: string;
  opciones: readonly OpcionSelector[];
  /** Primera opción vacía ("Elige…"); se elige cuando el valor es "". */
  textoVacio?: string;
  ayuda?: string;
  error?: string;
};

/** Selector nativo de 48 px con el mismo aspecto que `Campo`. */
export function Selector({ id, etiqueta, opciones, textoVacio, ayuda, error, className, ...resto }: SelectorProps) {
  return (
    <div className={clases("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-meta text-ink-primary">
        {etiqueta}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describirCampo(id, ayuda, error)}
        className={clases(
          "h-12 w-full min-w-0 rounded-sm border bg-surface-raised px-3 text-body text-ink-primary",
          "focus:border-2 focus:px-[11px] disabled:cursor-not-allowed disabled:text-ink-muted",
          error ? "border-state-error" : "border-ink-on-inverse-secondary focus:border-ink-primary",
        )}
        {...resto}
      >
        {textoVacio !== undefined && <option value="">{textoVacio}</option>}
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
      <MensajesCampo id={id} ayuda={ayuda} error={error} />
    </div>
  );
}
