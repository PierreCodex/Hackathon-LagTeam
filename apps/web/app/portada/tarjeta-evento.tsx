import type { EventoPublico } from "@reto18/shared";
import Link from "next/link";
import type { ReactNode } from "react";
import { clases } from "@/lib/clases";
import { degradadoCategoria, fechaCorta, textoPrecio } from "@/lib/catalogo";

/** Foto del evento o, si no tiene, el degradado de su categoría (nunca un hueco vacío). */
export function ImagenEvento({
  evento,
  className,
  children,
}: {
  evento: Pick<EventoPublico, "foto_url" | "categoria">;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={clases("relative overflow-hidden bg-surface-inverse", className)}
      style={evento.foto_url ? undefined : { background: degradadoCategoria(evento.categoria) }}
    >
      {evento.foto_url && (
        // eslint-disable-next-line @next/next/no-img-element -- foto pública de Supabase Storage, de tamaño variable
        <img src={evento.foto_url} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      {children}
    </div>
  );
}

/** Tarjeta de evento de las filas y de los resultados (mockup de escritorio): lleva a la ficha. */
export function TarjetaEvento({ evento, className }: { evento: EventoPublico; className?: string }) {
  const precio = textoPrecio(evento);
  return (
    <Link
      href={`/eventos/${evento.id}`}
      className={clases(
        "group flex flex-col overflow-hidden rounded-md border border-border-hairline bg-surface-raised text-ink-primary no-underline hover:border-ink-muted",
        className,
      )}
    >
      <ImagenEvento evento={evento} className="aspect-[4/5]">
        <div className="absolute inset-0 bg-gradient-to-t from-surface-inverse/90 via-transparent to-transparent" />
        {evento.destacado && (
          <span className="absolute top-3 left-3 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-on-accent">
            Destacado
          </span>
        )}
        <p aria-hidden="true" className="absolute inset-x-3 bottom-3 text-title leading-tight font-bold text-ink-on-inverse">
          {evento.titulo}
        </p>
      </ImagenEvento>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="flex justify-between gap-2 text-meta text-ink-secondary">
          <span>{fechaCorta(evento.inicio)}</span>
          <span className="truncate">{evento.distrito}</span>
        </p>
        <h3 className="text-body font-medium [overflow-wrap:anywhere] group-hover:underline">{evento.titulo}</h3>
        {precio && (
          <p className="mt-auto pt-2 text-meta text-ink-secondary">
            {precio === "Gratis" ? (
              <strong className="text-ink-primary">Gratis</strong>
            ) : (
              <>
                Desde <strong className="text-ink-primary">{precio.replace("Desde ", "")}</strong>
              </>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}
