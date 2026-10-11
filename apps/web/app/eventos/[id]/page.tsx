import { EventoIdSchema, EventoPublicoSchema } from "@reto18/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PantallaSesion } from "@/components/layout/pantalla-sesion";
import { Aviso, BotonEnlace, Tarjeta } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { categoriasDeZonaGeneral } from "@/lib/compra";
import { etiquetaCategoria, rutaComprar, soles, textoPrecio } from "@/lib/catalogo";
import { fechaPieza } from "@/lib/pieza";
import { ImagenEvento } from "../../portada/tarjeta-evento";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Evento publicado de `GET /eventos/:id` (1.6); 404 si no existe o aún no es público. Una llamada por petición. */
const cargarEvento = cache(async (id: string) => {
  if (!EventoIdSchema.safeParse(id).success) notFound();
  const resultado = await pedirApi(`eventos/${id}`, EventoPublicoSchema);
  if (!resultado.ok && resultado.error.codigo === "EVENTO_NO_EXISTE") notFound();
  return resultado;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resultado = await cargarEvento((await params).id);
  return { title: resultado.ok ? `${resultado.datos.titulo} · Reto 18` : "Evento · Reto 18" };
}

/** Ficha pública del evento (1.11): foto, fecha, sede, descripción, precios y el paso a la compra (2.8). */
export default async function FichaEvento({ params, searchParams }: Props) {
  const { id } = await params;
  const { ref } = await searchParams;
  const resultado = await cargarEvento(id);
  const ruta = `/eventos/${id}`;

  if (!resultado.ok) {
    return (
      <PantallaSesion titulo="Evento" destinoActivo="eventos" rutaActual={ruta}>
        <Aviso
          tipo="error"
          titulo="No pudimos cargar el evento."
          accion={
            <BotonEnlace href={ruta} variante="secundario" prefetch={false}>
              Reintentar
            </BotonEnlace>
          }
        >
          {resultado.error.mensaje}
        </Aviso>
      </PantallaSesion>
    );
  }

  const evento = resultado.datos;
  const precio = textoPrecio(evento);
  const categorias = [...evento.categorias].sort((a, b) => b.precio_centimos - a.precio_centimos);

  return (
    <PantallaSesion destinoActivo="eventos" rutaActual={ruta}>
      <article className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <ImagenEvento evento={evento} className="aspect-[4/3] rounded-md lg:aspect-auto lg:min-h-96" />
        <div className="flex flex-col gap-4">
          <p className="text-meta text-ink-secondary">
            {evento.destacado ? "Destacado · " : ""}
            {etiquetaCategoria(evento.categoria)}
          </p>
          <h1 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-bold [overflow-wrap:anywhere]">{evento.titulo}</h1>
          <dl className="grid gap-2 text-body">
            <div className="flex gap-2">
              <dt className="sr-only">Fecha</dt>
              <dd>{fechaPieza(evento.inicio)}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="sr-only">Lugar</dt>
              <dd className="font-medium">{evento.sede.nombre}</dd>
              <dd className="text-meta text-ink-secondary">
                {evento.sede.direccion} · {evento.distrito}
              </dd>
            </div>
          </dl>

          <Tarjeta como="section" aria-labelledby="titulo-precios" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="titulo-precios" className="text-body font-bold">
                Entradas
              </h2>
              {precio && <p className="text-meta text-ink-secondary">{precio} · IGV incluido</p>}
            </div>
            {categorias.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border-hairline">
                {categorias.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="size-3 rounded-full" style={{ background: c.color }} />
                      {c.nombre}
                    </span>
                    <strong>{c.precio_centimos === 0 ? "Gratis" : soles(c.precio_centimos)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-secondary">Los precios se publicarán pronto.</p>
            )}
            {categoriasDeZonaGeneral(categorias).length > 0 ? (
              <BotonEnlace href={rutaComprar(evento.id, ref)} anchoCompleto>
                Comprar entradas
              </BotonEnlace>
            ) : (
              categorias.length > 0 && (
                <Aviso tipo="info" titulo="La elección de butaca llega muy pronto.">
                  Este evento tiene butacas numeradas: podrás elegir la tuya en el mapa de la sala.
                </Aviso>
              )
            )}
          </Tarjeta>
        </div>
      </article>

      <section aria-labelledby="titulo-descripcion" className="flex max-w-3xl flex-col gap-2">
        <h2 id="titulo-descripcion" className="text-title">
          Sobre el evento
        </h2>
        <p className="whitespace-pre-line [overflow-wrap:anywhere]">{evento.descripcion}</p>
      </section>

      <BotonEnlace href="/" variante="secundario" className="self-start">
        Ver más eventos
      </BotonEnlace>
    </PantallaSesion>
  );
}
