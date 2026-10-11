"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";

const FLECHA = "grid size-8 place-items-center rounded-full border border-border-hairline bg-surface-raised text-ink-primary hover:border-ink-primary";

/** Fila de eventos con título, "Ver todos" y un carril que se desplaza en horizontal (flechas o deslizando). */
export function Carril({ id, titulo, verTodos, children }: { id: string; titulo: string; verTodos?: string; children: ReactNode }) {
  const carril = useRef<HTMLDivElement>(null);
  const mover = (sentido: 1 | -1) => {
    const el = carril.current;
    if (el) el.scrollBy({ left: sentido * el.clientWidth * 0.8, behavior: "smooth" });
  };
  return (
    <section aria-labelledby={`fila-${id}`} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 id={`fila-${id}`} className="text-title">
          {titulo}
        </h2>
        <div className="ml-auto flex items-center gap-3">
          {verTodos && (
            <Link href={verTodos} className="text-meta font-medium text-ink-primary decoration-accent decoration-2 underline-offset-4">
              Ver todos
            </Link>
          )}
          <div className="flex gap-2 max-sm:hidden">
            <button type="button" aria-label={`Anteriores de ${titulo}`} className={FLECHA} onClick={() => mover(-1)}>
              ‹
            </button>
            <button type="button" aria-label={`Siguientes de ${titulo}`} className={FLECHA} onClick={() => mover(1)}>
              ›
            </button>
          </div>
        </div>
      </div>
      <div ref={carril} className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
        {children}
      </div>
    </section>
  );
}
