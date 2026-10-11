import type { InputHTMLAttributes } from "react";
import { clases } from "@/lib/clases";
import { describirCampo, MensajesCampo } from "./mensajes-campo";

export type CampoArchivoProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className" | "type" | "value"> & {
  /** Clases del contenedor. */
  className?: string;
  /** Obligatorio: une la etiqueta, la ayuda y el error con el campo. */
  id: string;
  etiqueta: string;
  /** Nombre del archivo elegido, para mostrarlo bajo el campo (el `<input type="file">` no se puede rellenar). */
  nombreArchivo?: string;
  ayuda?: string;
  error?: string;
};

/**
 * Campo de archivo de 48 px con etiqueta visible y error asociado, con el aspecto de `Campo`.
 * El botón del selector de archivos lleva el estilo de un botón secundario.
 */
export function CampoArchivo({ id, etiqueta, nombreArchivo, ayuda, error, className, ...resto }: CampoArchivoProps) {
  return (
    <div className={clases("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-meta text-ink-primary">
        {etiqueta}
      </label>
      <input
        id={id}
        type="file"
        aria-invalid={error ? true : undefined}
        aria-describedby={describirCampo(id, ayuda, error)}
        className={clases(
          "min-h-12 w-full min-w-0 rounded-sm border bg-surface-raised p-1 text-meta text-ink-secondary",
          "file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-sm file:border file:border-ink-muted file:bg-transparent",
          "file:px-4 file:text-button file:text-ink-primary hover:file:border-ink-primary",
          "focus:border-2 focus:p-[3px]",
          error ? "border-state-error" : "border-ink-on-inverse-secondary focus:border-ink-primary",
        )}
        {...resto}
      />
      {/* El ✓ solo con un archivo válido: con error, manda el ✕. */}
      {nombreArchivo && !error && (
        <p className="text-meta text-ink-primary [overflow-wrap:anywhere]">
          <span aria-hidden="true">✓ </span>
          {nombreArchivo}
        </p>
      )}
      <MensajesCampo id={id} ayuda={ayuda} error={error} />
    </div>
  );
}
