import { type ErrorApi, type VentasOrganizador, VentasOrganizadorSchema } from "@reto18/shared";
import type { Metadata } from "next";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { Aviso, BotonEnlace, Tarjeta } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { soles } from "@/lib/catalogo";
import { anchoBarra } from "@/lib/tablero";
import { ERROR_SIN_SESION, tokenDelServidor } from "../datos-organizador";

export const metadata: Metadata = { title: "Ventas · Reto 18" };

const RUTA = "/organizador/ventas";

const ETIQUETA_RED: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  x: "X",
};

const fecha = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" });

/** Ventas del organizador (`GET /negocio/mis-ventas`) con el token de la sesión. Se piden en cada visita. */
async function cargarVentas(): Promise<{ ventas?: VentasOrganizador; error?: ErrorApi }> {
  const token = await tokenDelServidor();
  if (!token) return { error: ERROR_SIN_SESION };
  const resultado = await pedirApi("negocio/mis-ventas", VentasOrganizadorSchema, {
    cabeceras: { Authorization: `Bearer ${token}` },
  });
  return resultado.ok ? { ventas: resultado.datos } : { error: resultado.error };
}

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <Tarjeta>
      <p className="text-sm text-ink-secondary">{etiqueta}</p>
      <p className="mt-1 text-2xl font-bold text-ink-primary">{valor}</p>
      {detalle ? <p className="mt-1 text-sm text-ink-secondary">{detalle}</p> : null}
    </Tarjeta>
  );
}

function Actualizar() {
  return (
    <BotonEnlace href={RUTA} variante="secundario" prefetch={false}>
      Actualizar
    </BotonEnlace>
  );
}

async function ContenidoVentas() {
  const { ventas, error } = await cargarVentas();
  if (!ventas) {
    return (
      <Aviso tipo="error" titulo="No pudimos cargar tus ventas." accion={<Actualizar />}>
        {error?.mensaje}
      </Aviso>
    );
  }
  const r = ventas.resumen;
  const maximoPieza = Math.max(0, ...ventas.piezas.map((p) => p.importe_centimos));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-ink-secondary">Entradas pagadas de tus eventos y qué pieza de marketing trajo cada venta.</p>
        <Actualizar />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Ventas" valor={soles(r.importe_centimos)} detalle={`${r.ordenes} compras`} />
        <Indicador etiqueta="Entradas vendidas" valor={String(r.entradas)} />
        <Indicador etiqueta="Clics en tus enlaces" valor={String(r.clics)} />
        <Indicador
          etiqueta="Recibirás"
          valor={soles(Math.max(0, r.neto_centimos))}
          detalle={`Tras ${soles(r.comision_centimos)} de comisión`}
        />
      </div>

      <Tarjeta como="section">
        <h2 className="text-lg font-bold text-ink-primary">Ventas por pieza</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Cada compra hecha desde el enlace de una pieza se le asigna a esa pieza.
        </p>
        {ventas.piezas.length === 0 ? (
          <p className="mt-3 text-ink-secondary">
            Aún no tienes enlaces rastreables. Créalos desde Marketing para medir qué pieza vende más.
          </p>
        ) : null}
        <ul className="mt-3 space-y-4">
          {ventas.piezas.map((p) => (
            <li key={p.pieza_id}>
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-bold text-ink-primary">Pieza de {p.titulo_evento}</span>
                <span className="text-ink-secondary">
                  {soles(p.importe_centimos)} · {p.entradas} entradas · {p.clics} clics
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-border-hairline">
                <div className="h-2 rounded-full bg-accent" style={{ width: `${anchoBarra(p.importe_centimos, maximoPieza)}%` }} />
              </div>
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {p.enlaces.map((e) => (
                  <li key={e.codigo} className="rounded-md border border-border-hairline px-2 py-1 text-ink-secondary">
                    {e.red ? ETIQUETA_RED[e.red] ?? e.red : "Sin red"}
                    {e.zona ? ` · ${e.zona}` : ""}: {e.entradas} entradas, {e.clics} clics
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {ventas.sin_enlace.ordenes > 0 ? (
          <p className="mt-4 text-sm text-ink-secondary">
            Sin enlace (catálogo o enlace directo): {soles(ventas.sin_enlace.importe_centimos)} · {ventas.sin_enlace.entradas}{" "}
            entradas
          </p>
        ) : null}
      </Tarjeta>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-ink-primary">Por evento</h2>
        {ventas.eventos.length === 0 ? (
          <Tarjeta>
            <p className="text-ink-secondary">Cuando te aprueben un evento, verás aquí sus ventas.</p>
          </Tarjeta>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-2">
          {ventas.eventos.map((e) => (
            <Tarjeta key={e.evento_id} como="article">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold text-ink-primary">{e.titulo}</h3>
                <span className="text-sm text-ink-secondary">{fecha.format(new Date(e.inicio))}</span>
              </div>
              <p className="mt-1 text-sm text-ink-secondary">
                {soles(e.importe_centimos)} · {e.entradas} de {e.aforo} entradas
                {e.asistentes > 0 ? ` · ${e.asistentes} asistieron` : ""}
              </p>
              <div className="mt-2 h-2 rounded-full bg-border-hairline">
                <div className="h-2 rounded-full bg-price-3" style={{ width: `${anchoBarra(e.entradas, e.aforo)}%` }} />
              </div>
              {e.por_categoria.length > 0 ? (
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="text-ink-secondary">
                    <tr>
                      <th className="py-1 pr-2 font-medium">Categoría</th>
                      <th className="py-1 pr-2 text-right font-medium">Entradas</th>
                      <th className="py-1 text-right font-medium">Ventas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.por_categoria.map((c) => (
                      <tr key={c.clave} className="border-t border-border-hairline">
                        <td className="py-1 pr-2 text-ink-primary">{c.clave}</td>
                        <td className="py-1 pr-2 text-right">{c.entradas}</td>
                        <td className="py-1 text-right">{soles(c.importe_centimos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-3 text-sm text-ink-secondary">Todavía sin ventas.</p>
              )}
            </Tarjeta>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Panel de ventas del organizador (bloque B del recorte final, historias 4.1 y 4.4). */
export default function PaginaVentas() {
  return (
    <GuardaRol rol="organizador" ruta={RUTA} titulo="Ventas" destinoActivo="ventas">
      {() => <ContenidoVentas />}
    </GuardaRol>
  );
}
