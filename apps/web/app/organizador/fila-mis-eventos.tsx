import type { ErrorApi, EventoRevision } from "@reto18/shared";
import { Aviso, BotonEnlace, Tarjeta } from "@/components/ui";
import { clases } from "@/lib/clases";
import { fechaPieza } from "@/lib/pieza";
import { ESTADO_EVENTO, textoEstadoOrganizador } from "@/lib/revision";

/** Un evento con su estado (símbolo y texto) y, si se rechazó, el motivo exacto. */
export function FilaMisEventos({ evento }: { evento: EventoRevision }) {
  const estado = ESTADO_EVENTO[evento.estado];
  return (
    <li>
      <Tarjeta como="article" className="flex flex-col gap-2">
        <h2 className="text-body font-bold [overflow-wrap:anywhere]">{evento.titulo}</h2>
        <p className="text-meta text-ink-secondary">
          {fechaPieza(evento.inicio)} · {evento.distrito}
        </p>
        <p className={clases("flex items-center gap-1 text-meta", estado.color)}>
          <span aria-hidden="true">{estado.simbolo}</span>
          <span>{textoEstadoOrganizador(evento)}</span>
        </p>
        {evento.estado === "rechazado" && evento.motivo_rechazo && (
          <div className="flex flex-col gap-1 border-t border-border-hairline pt-2">
            <h3 className="text-meta text-ink-secondary">Motivo del rechazo</h3>
            <p className="[overflow-wrap:anywhere]">{evento.motivo_rechazo}</p>
          </div>
        )}
      </Tarjeta>
    </li>
  );
}

export type ContenidoMisEventosProps = {
  eventos: EventoRevision[];
  /** Error al leer `GET /eventos/mis-eventos`: aviso con "Reintentar". */
  error?: ErrorApi;
  /** Ruta de la página, para "Reintentar". */
  rutaActual: string;
};

/** Mis eventos (1.10): "Nuevo evento" y, debajo, el error, el vacío o la lista. Sin datos propios. */
export function ContenidoMisEventos({ eventos, error, rutaActual }: ContenidoMisEventosProps) {
  return (
    <>
      <BotonEnlace href="/organizador/eventos/nuevo" className="self-start max-sm:w-full">
        Nuevo evento
      </BotonEnlace>
      {error ? (
        <Aviso
          tipo="error"
          titulo="No pudimos cargar tus eventos."
          accion={
            <BotonEnlace href={rutaActual} variante="secundario" prefetch={false}>
              Reintentar
            </BotonEnlace>
          }
        >
          {error.mensaje}
        </Aviso>
      ) : eventos.length === 0 ? (
        <Tarjeta como="section" aria-labelledby="titulo-vacio" className="flex flex-col gap-2">
          <h2 id="titulo-vacio" className="text-title">
            Aún no tienes eventos
          </h2>
          <p className="text-ink-secondary">Pulsa &quot;Nuevo evento&quot; y envíalo a aprobación.</p>
        </Tarjeta>
      ) : (
        <ul className="flex flex-col gap-3">
          {eventos.map((evento) => (
            <FilaMisEventos key={evento.id} evento={evento} />
          ))}
        </ul>
      )}
    </>
  );
}
