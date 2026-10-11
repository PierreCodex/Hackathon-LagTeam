import type { EstadoEvento, EventoRevision } from "@reto18/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { Aviso, BotonEnlace, Tarjeta } from "@/components/ui";
import { clases } from "@/lib/clases";
import { fechaPieza, rutaMarketingEvento } from "@/lib/pieza";
import { cargarMisEventos } from "../datos-organizador";

export const metadata: Metadata = { title: "Marketing · Reto 18" };

const RUTA = "/organizador/marketing";

/** Estado con símbolo y texto, nunca solo color (DESIGN.md). */
const ESTADO: Record<EstadoEvento, { simbolo: string; texto: string; color: string }> = {
  aprobado: { simbolo: "✓", texto: "Aprobado", color: "text-state-success" },
  pendiente: { simbolo: "…", texto: "Pendiente de aprobación", color: "text-state-warning" },
  rechazado: { simbolo: "✕", texto: "Rechazado", color: "text-state-error" },
};

function FilaEvento({ evento }: { evento: EventoRevision }) {
  const estado = ESTADO[evento.estado];
  const aprobado = evento.estado === "aprobado";
  return (
    <li>
      <Tarjeta como="article" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-body font-bold [overflow-wrap:anywhere]">{evento.titulo}</h2>
          <p className="text-meta text-ink-secondary">
            {fechaPieza(evento.inicio)} · {evento.distrito}
          </p>
          <p className={clases("flex items-center gap-1 text-meta", estado.color)}>
            <span aria-hidden="true">{estado.simbolo}</span>
            <span>{estado.texto}</span>
          </p>
        </div>
        {aprobado ? (
          <BotonEnlace href={rutaMarketingEvento(evento.id)} variante="secundario" className="shrink-0 max-sm:w-full">
            Preparar campaña
          </BotonEnlace>
        ) : (
          <p className="text-meta text-ink-secondary sm:max-w-56">
            {evento.estado === "pendiente"
              ? "Podrás preparar su campaña cuando el Club lo apruebe."
              : "Este evento no se publicará."}
          </p>
        )}
      </Tarjeta>
    </li>
  );
}

async function ListaMarketing() {
  const { eventos, error } = await cargarMisEventos();

  if (error) {
    return (
      <Aviso
        tipo="error"
        titulo="No pudimos cargar tus eventos."
        accion={
          <BotonEnlace href={RUTA} variante="secundario" prefetch={false}>
            Reintentar
          </BotonEnlace>
        }
      >
        {error.mensaje}
      </Aviso>
    );
  }

  if (eventos.length === 0) {
    return (
      <Tarjeta como="section" aria-labelledby="titulo-vacio" className="flex flex-col gap-4">
        <h2 id="titulo-vacio" className="text-title">
          Aún no tienes eventos
        </h2>
        <p className="text-ink-secondary">Crea tu primer evento y, cuando el Club lo apruebe, prepara aquí su campaña.</p>
        <BotonEnlace href="/organizador/eventos/nuevo" className="self-start max-sm:w-full">
          Nuevo evento
        </BotonEnlace>
      </Tarjeta>
    );
  }

  return (
    <>
      <p className="text-ink-secondary">
        Elige un evento aprobado para generar su flyer y su campaña con IA.{" "}
        <Link href="/organizador/eventos/nuevo" className="text-ink-primary underline">
          Nuevo evento
        </Link>
      </p>
      <ul className="flex flex-col gap-3">
        {eventos.map((evento) => (
          <FilaEvento key={evento.id} evento={evento} />
        ))}
      </ul>
    </>
  );
}

/** Marketing del organizador (3.8): sus eventos; solo los aprobados llevan a generar la pieza. */
export default function MarketingOrganizador() {
  return (
    <GuardaRol rol="organizador" ruta={RUTA} titulo="Marketing" destinoActivo="marketing">
      {() => <ListaMarketing />}
    </GuardaRol>
  );
}
