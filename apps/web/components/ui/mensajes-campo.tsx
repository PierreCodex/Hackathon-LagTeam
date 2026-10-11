import type { ReactNode } from "react";

/** `aria-describedby` de un campo: primero el error, luego la ayuda. */
export function describirCampo(id: string, ayuda?: ReactNode, error?: string): string | undefined {
  return [error ? `${id}-error` : undefined, ayuda ? `${id}-ayuda` : undefined].filter(Boolean).join(" ") || undefined;
}

/** Error (con ✕) y ayuda bajo un campo, con los ids que usa `describirCampo`. */
export function MensajesCampo({ id, ayuda, error }: { id: string; ayuda?: ReactNode; error?: string }) {
  return (
    <>
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-2 text-meta text-state-error">
          <span aria-hidden="true">✕</span>
          <span>{error}</span>
        </p>
      )}
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-meta text-ink-secondary">
          {ayuda}
        </p>
      )}
    </>
  );
}
