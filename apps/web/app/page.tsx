import { ListaEventosPublicosSchema } from "@reto18/shared";
import { PantallaSesion } from "@/components/layout/pantalla-sesion";
import { Aviso, BotonEnlace, Tarjeta } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { armarFilas, distritosDe, eventosHeroe, instanteActual, leerFiltros, rutaCatalogo } from "@/lib/catalogo";
import { Carril } from "./portada/carril";
import { Heroe } from "./portada/heroe";
import { BandaOrganizadores, Buscador, FilaCategorias, LateralHeroe } from "./portada/secciones";
import { TarjetaEvento } from "./portada/tarjeta-evento";

// Los eventos publicados cambian: nunca se sirve una portada cacheada.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Portada pública (1.11, mockup de escritorio): eventos aprobados y publicados de `GET /eventos`. */
export default async function Inicio({ searchParams }: Props) {
  const ahora = instanteActual();
  const filtros = leerFiltros(await searchParams, ahora);
  // Todos los publicados (filas, héroe y distritos) y, si hay filtros, los que los cumplen.
  const [todos, filtrados] = await Promise.all([
    pedirApi(rutaCatalogo(), ListaEventosPublicosSchema),
    filtros.activos ? pedirApi(rutaCatalogo(filtros.consulta), ListaEventosPublicosSchema) : null,
  ]);
  const eventos = todos.ok ? todos.datos : [];
  const error = !todos.ok ? todos.error : filtrados && !filtrados.ok ? filtrados.error : null;

  return (
    <PantallaSesion destinoActivo="eventos" rutaActual="/">
      <h1 className="sr-only">Eventos culturales de Piura</h1>
      <Buscador valores={filtros.valores} distritos={distritosDe(eventos)} activos={filtros.activos} />

      {error ? (
        <Aviso
          tipo="error"
          titulo="No pudimos cargar los eventos."
          accion={
            <BotonEnlace href="/" variante="secundario" prefetch={false}>
              Reintentar
            </BotonEnlace>
          }
        >
          {error.mensaje}
        </Aviso>
      ) : filtrados?.ok ? (
        <section aria-labelledby="titulo-resultados" className="flex flex-col gap-3">
          <h2 id="titulo-resultados" className="text-title">
            Resultados <span className="text-ink-secondary">({filtrados.datos.length})</span>
          </h2>
          {filtrados.datos.length === 0 ? (
            <Tarjeta className="flex flex-col items-start gap-3">
              <p>No encontramos eventos con esos filtros.</p>
              <BotonEnlace href="/" variante="secundario">
                Ver todos los eventos
              </BotonEnlace>
            </Tarjeta>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {filtrados.datos.map((evento) => (
                <TarjetaEvento key={evento.id} evento={evento} />
              ))}
            </div>
          )}
        </section>
      ) : eventos.length === 0 ? (
        <Tarjeta className="flex flex-col items-start gap-2">
          <h2 className="text-title">Aún no hay eventos publicados</h2>
          <p className="text-ink-secondary">Vuelve pronto: los organizadores de Piura están preparando su programación.</p>
        </Tarjeta>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[3fr_1fr]">
            <Heroe eventos={eventosHeroe(eventos)} />
            <LateralHeroe />
          </div>
          <FilaCategorias activa={filtros.valores.categoria} />
          {armarFilas(eventos, ahora).map((fila) => (
            <Carril key={fila.id} id={fila.id} titulo={fila.titulo} verTodos={fila.verTodos}>
              {fila.eventos.map((evento) => (
                <TarjetaEvento key={evento.id} evento={evento} className="w-44 shrink-0 snap-start sm:w-52 lg:w-[calc((100%-4rem)/5)]" />
              ))}
            </Carril>
          ))}
        </>
      )}

      <BandaOrganizadores />
    </PantallaSesion>
  );
}
