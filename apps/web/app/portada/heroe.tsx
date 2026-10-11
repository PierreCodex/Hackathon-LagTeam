"use client";

import type { EventoPublico } from "@reto18/shared";
import Link from "next/link";
import { useState } from "react";
import { BotonEnlace } from "@/components/ui";
import { clases } from "@/lib/clases";
import { categoriasDeZonaGeneral } from "@/lib/compra";
import { etiquetaCategoria, rutaComprar, textoPrecio } from "@/lib/catalogo";
import { fechaPieza } from "@/lib/pieza";
import { ImagenEvento } from "./tarjeta-evento";

const FLECHA =
  "absolute top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-ink-on-inverse-secondary text-ink-on-inverse hover:border-ink-on-inverse";

/** Héroe manual con los destacados (DESIGN.md): flechas y puntos, sin avance automático. */
export function Heroe({ eventos }: { eventos: EventoPublico[] }) {
  const [indice, setIndice] = useState(0);
  const evento = eventos[indice];
  if (!evento) return null;
  const varios = eventos.length > 1;
  const ir = (paso: number) => setIndice((i) => (i + paso + eventos.length) % eventos.length);
  const precio = textoPrecio(evento);

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Eventos destacados"
      className="superficie-inversa relative grid overflow-hidden rounded-md bg-surface-inverse text-ink-on-inverse md:grid-cols-2"
    >
      <div className="relative flex flex-col justify-center gap-3 px-6 py-8 md:px-16" aria-live="polite">
        <p className="text-meta tracking-wide text-ink-on-inverse-secondary">
          {evento.destacado ? "Destacado · " : ""}
          {etiquetaCategoria(evento.categoria)}
        </p>
        <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-bold [overflow-wrap:anywhere]">
          <Link href={`/eventos/${evento.id}`} className="text-ink-on-inverse no-underline hover:underline">
            {evento.titulo}
          </Link>
        </h2>
        <p className="text-meta text-ink-on-inverse-secondary">
          {fechaPieza(evento.inicio)} · {evento.sede.nombre}, {evento.distrito}
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          {categoriasDeZonaGeneral(evento.categorias).length > 0 ? (
            <BotonEnlace href={rutaComprar(evento.id)}>Comprar entradas</BotonEnlace>
          ) : (
            <BotonEnlace href={`/eventos/${evento.id}`}>Ver evento</BotonEnlace>
          )}
          {precio && <p className="text-meta">{precio}</p>}
        </div>
        {varios && (
          <div className="flex gap-1.5 pt-2">
            {eventos.map((e, i) => (
              <button
                key={e.id}
                type="button"
                aria-label={`Ver destacado ${i + 1} de ${eventos.length}`}
                aria-current={i === indice ? "true" : undefined}
                onClick={() => setIndice(i)}
                className={clases("h-1.5 rounded-full", i === indice ? "w-5 bg-ink-on-inverse" : "w-1.5 bg-ink-on-inverse-secondary")}
              />
            ))}
          </div>
        )}
        {varios && (
          <>
            <button type="button" aria-label="Destacado anterior" className={clases(FLECHA, "left-3")} onClick={() => ir(-1)}>
              ‹
            </button>
            <button type="button" aria-label="Destacado siguiente" className={clases(FLECHA, "right-3")} onClick={() => ir(1)}>
              ›
            </button>
          </>
        )}
      </div>
      <ImagenEvento evento={evento} className="min-h-56 md:min-h-80">
        <p aria-hidden="true" className="absolute inset-x-5 bottom-5 text-title font-bold text-ink-on-inverse">
          {evento.titulo}
        </p>
      </ImagenEvento>
    </section>
  );
}
