import { PiezaSchema, type ErrorApi, type Pieza } from "@reto18/shared";
import type { Metadata } from "next";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { BotonEnlace } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { rutaMarketingEvento } from "@/lib/pieza";
import { cargarMisEventos } from "../../../datos-organizador";
import { PanelMarketing } from "./panel-marketing";

export const metadata: Metadata = { title: "Marketing del evento · Reto 18" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Pieza guardada (`?pieza=`), leída con `GET /marketing/piezas/:id`. Solo vale si es de este evento. */
async function cargarPieza(eventoId: string, piezaId: string | undefined): Promise<{ pieza?: Pieza; error?: ErrorApi }> {
  if (!piezaId) return {};
  const resultado = await pedirApi(`marketing/piezas/${encodeURIComponent(piezaId)}`, PiezaSchema);
  if (!resultado.ok) return { error: resultado.error };
  return resultado.datos.evento_id === eventoId ? { pieza: resultado.datos } : {};
}

async function ContenidoMarketing({ eventoId, piezaId }: { eventoId: string; piezaId: string | undefined }) {
  const [{ pieza, error }, { eventos }] = await Promise.all([cargarPieza(eventoId, piezaId), cargarMisEventos()]);
  // Solo para el título: si no se puede leer, la API decide al generar (dueño, aprobado, futuro).
  const titulo = eventos.find((e) => e.id === eventoId)?.titulo ?? pieza?.datos.titulo;
  return (
    <>
      <BotonEnlace href="/organizador/marketing" variante="secundario" className="self-start">
        ← Mis eventos
      </BotonEnlace>
      <PanelMarketing
        apiUrl={process.env.API_URL ?? ""}
        eventoId={eventoId}
        titulo={titulo}
        piezaInicial={pieza}
        errorPieza={error}
        rutaActual={rutaMarketingEvento(eventoId, pieza?.id)}
      />
    </>
  );
}

/** Marketing de un evento (3.8): genera la pieza (flyer 4:5 y campaña) y la vuelve a mostrar al recargar. */
export default async function MarketingEvento({ params, searchParams }: Props) {
  const { id } = await params;
  const consulta = await searchParams;
  const piezaId = typeof consulta.pieza === "string" && consulta.pieza !== "" ? consulta.pieza : undefined;
  const ruta = rutaMarketingEvento(id, piezaId);
  return (
    <GuardaRol rol="organizador" ruta={ruta} titulo="Marketing" destinoActivo="marketing">
      {() => <ContenidoMarketing eventoId={id} piezaId={piezaId} />}
    </GuardaRol>
  );
}
