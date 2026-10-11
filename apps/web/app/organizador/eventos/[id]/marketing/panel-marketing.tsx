"use client";

import { CODIGOS_MARKETING, PiezaSchema, type ErrorApi, type Pieza } from "@reto18/shared";
import { useEffect, useRef, useState } from "react";
import { Aviso, Boton, BotonEnlace, Esqueleto, EsqueletoGrupo, Tarjeta } from "@/components/ui";
import { CODIGO_SIN_CONEXION, pedirApi } from "@/lib/api";
import { fechaCalendario, fechaPieza, nombreRed, rutaMarketingEvento, soles, textoPrecio, urlPng } from "@/lib/pieza";
import { rutaIngresar } from "@/lib/sesion";
import { tokenDelNavegador } from "@/lib/supabase/navegador";

export type PanelMarketingProps = {
  /** Base de la API (`API_URL`): "Generar" va del navegador directo a la API, sin el límite de duración de Vercel. */
  apiUrl: string;
  eventoId: string;
  /** Título del evento, si se pudo leer. */
  titulo?: string;
  /** Pieza guardada de `?pieza=`, leída en el servidor. */
  piezaInicial?: Pieza;
  /** Error al leer la pieza guardada. */
  errorPieza?: ErrorApi;
  rutaActual: string;
};

/** La API puede tardar hasta `IA_TIEMPO_LIMITE_MS` (30 s) más guardar: margen de sobra. */
const TIEMPO_LIMITE_GENERAR_MS = 60_000;
const ID_TITULO_PIEZA = "titulo-pieza";

/** Errores que no son un fallo: el evento todavía (o ya) no admite campaña. */
const CODIGOS_ADVERTENCIA: readonly string[] = [CODIGOS_MARKETING.EVENTO_NO_APROBADO, CODIGOS_MARKETING.EVENTO_FINALIZADO];

/** Pantalla Marketing de un evento (3.8): "Generar", el flyer 4:5, los textos y la campaña. */
export function PanelMarketing({ apiUrl, eventoId, titulo, piezaInicial, errorPieza, rutaActual }: PanelMarketingProps) {
  const [pieza, setPieza] = useState<Pieza | null>(piezaInicial ?? null);
  const [error, setError] = useState<ErrorApi | null>(null);
  const [sinSesion, setSinSesion] = useState(false);
  const [generando, setGenerando] = useState(false);
  const enfocarPieza = useRef(false);

  useEffect(() => {
    if (!enfocarPieza.current || !pieza) return;
    enfocarPieza.current = false;
    document.getElementById(ID_TITULO_PIEZA)?.focus();
  }, [pieza]);

  async function generar() {
    if (generando) return;
    setGenerando(true);
    setError(null);
    setSinSesion(false);

    const token = await tokenDelNavegador();
    if (!token) {
      setGenerando(false);
      setSinSesion(true);
      return;
    }

    const resultado = await pedirApi(`marketing/eventos/${encodeURIComponent(eventoId)}/piezas`, PiezaSchema, {
      apiUrl,
      metodo: "POST",
      cabeceras: { Authorization: `Bearer ${token}` },
      tiempoLimiteMs: TIEMPO_LIMITE_GENERAR_MS,
    });
    setGenerando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    enfocarPieza.current = true;
    setPieza(resultado.datos);
    // Al recargar, el servidor lee esta pieza con `GET` en lugar de generar otra.
    window.history.replaceState(null, "", rutaMarketingEvento(eventoId, resultado.datos.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          {titulo && <h2 className="text-title [overflow-wrap:anywhere]">{titulo}</h2>}
          <p className="text-ink-secondary">
            La IA escribe los textos y la campaña. La fecha, la sede y el precio salen de tu evento.
          </p>
        </div>
        <Boton onClick={() => void generar()} disabled={generando} className="shrink-0 max-sm:w-full sm:min-w-48">
          {generando ? "Generando…" : pieza ? "Generar otra" : "Generar"}
        </Boton>
      </div>

      {sinSesion && (
        <Aviso
          tipo="error"
          titulo="Tu sesión se cerró."
          accion={
            <BotonEnlace href={rutaIngresar(rutaActual)} variante="secundario">
              Ingresar
            </BotonEnlace>
          }
        >
          Ingresa de nuevo para generar tu pieza.
        </Aviso>
      )}

      {error && <AvisoErrorGenerar error={error} generando={generando} onReintentar={() => void generar()} />}

      {errorPieza && !pieza && !error && (
        <Aviso tipo="info" titulo="No pudimos abrir la pieza guardada.">
          {errorPieza.mensaje} Puedes generar una nueva.
        </Aviso>
      )}

      {generando ? (
        <EsqueletoGrupo etiqueta="Generando tu pieza. Puede tardar hasta un minuto." className="lg:flex-row lg:gap-8">
          <Esqueleto className="aspect-[4/5] w-full lg:max-w-[420px]" />
          <div className="flex flex-1 flex-col gap-3">
            <Esqueleto className="h-6 w-2/3" />
            <Esqueleto className="h-4 w-full" />
            <Esqueleto className="h-4 w-5/6" />
            <Esqueleto className="h-32 w-full" />
          </div>
        </EsqueletoGrupo>
      ) : pieza ? (
        <VistaPieza pieza={pieza} />
      ) : (
        !error && (
          <Tarjeta className="flex flex-col gap-2">
            <p className="font-bold">Aún no has generado la pieza de este evento.</p>
            <p className="text-meta text-ink-secondary">
              Pulsa &quot;Generar&quot; y en unos segundos verás el flyer y una campaña con a quién llegar, cuánto
              invertir y cuándo publicar.
            </p>
          </Tarjeta>
        )
      )}
    </div>
  );
}

/** Error de "Generar" con el mensaje de la API; "Reintentar" solo si falló la conexión. */
export function AvisoErrorGenerar({
  error,
  generando,
  onReintentar,
}: {
  error: ErrorApi;
  generando: boolean;
  onReintentar: () => void;
}) {
  return (
    <Aviso
      tipo={CODIGOS_ADVERTENCIA.includes(error.codigo) ? "advertencia" : "error"}
      titulo="No pudimos generar tu pieza."
      accion={
        error.codigo === CODIGO_SIN_CONEXION ? (
          <Boton variante="secundario" onClick={onReintentar} disabled={generando}>
            Reintentar
          </Boton>
        ) : undefined
      }
    >
      {error.mensaje}
    </Aviso>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-meta text-ink-secondary">{etiqueta}</dt>
      <dd className="[overflow-wrap:anywhere]">{valor}</dd>
    </div>
  );
}

function VistaPieza({ pieza }: { pieza: Pieza }) {
  const { textos, campana, datos } = pieza;
  const precio = textoPrecio(datos.precio_minimo_centimos);
  const png = urlPng(pieza.id, "4x5");

  return (
    <section aria-labelledby={ID_TITULO_PIEZA} className="flex flex-col gap-4">
      <h2 id={ID_TITULO_PIEZA} tabIndex={-1} className="text-title outline-none">
        Tu pieza
      </h2>

      {pieza.origen === "respaldo" && (
        <Aviso tipo="info" titulo="La IA no respondió a tiempo.">
          Esta es una propuesta base con los datos reales de tu evento. Puedes usarla o pulsar &quot;Generar otra&quot;.
        </Aviso>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <figure className="flex w-full flex-col gap-2 lg:max-w-[420px] lg:shrink-0">
          {/* El PNG lo pinta `next/og` en /piezas/<id>/4x5; `next/image` no aporta nada aquí. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={png}
            alt={textos.titular}
            width={1080}
            height={1350}
            className="aspect-[4/5] h-auto w-full rounded-md border border-border-hairline bg-border-hairline object-cover"
          />
          <figcaption className="text-meta text-ink-secondary">
            Flyer 4:5 para Instagram y Facebook.{" "}
            <a href={png} target="_blank" rel="noopener" className="text-ink-primary underline">
              Abrir la imagen
            </a>
          </figcaption>
        </figure>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Tarjeta como="section" aria-labelledby="titulo-textos" className="flex flex-col gap-3">
            <h3 id="titulo-textos" className="text-meta text-ink-secondary">
              Textos
            </h3>
            <p className="text-title [overflow-wrap:anywhere]">{textos.titular}</p>
            <p className="[overflow-wrap:anywhere]">{textos.subtitulo}</p>
            <p className="font-bold [overflow-wrap:anywhere]">{textos.llamado}</p>
            <p className="text-ink-secondary [overflow-wrap:anywhere]">{textos.descripcion}</p>
            <dl className="grid gap-3 border-t border-border-hairline pt-3 sm:grid-cols-2">
              <Dato etiqueta="Fecha" valor={fechaPieza(datos.inicio)} />
              <Dato etiqueta="Sede" valor={datos.sede} />
              <Dato etiqueta="Dirección" valor={`${datos.direccion} · ${datos.distrito}`} />
              {precio && <Dato etiqueta="Precio" valor={precio} />}
            </dl>
          </Tarjeta>

          <Tarjeta como="section" aria-labelledby="titulo-campana" className="flex flex-col gap-4">
            <h3 id="titulo-campana" className="text-title">
              Tu campaña
            </h3>
            <p className="[overflow-wrap:anywhere]">{campana.resumen}</p>

            <div className="flex flex-col gap-1">
              <h4 className="font-bold">A quién</h4>
              <p className="text-ink-secondary [overflow-wrap:anywhere]">{campana.publico}</p>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="font-bold">Cuánto</h4>
              <ul className="flex flex-col divide-y divide-border-hairline">
                {campana.reparto.map((r) => (
                  <li key={r.red} className="flex justify-between gap-4 py-2">
                    <span>{nombreRed(r.red)}</span>
                    <span className="tabular-nums">S/ {soles(r.soles * 100)}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-4 py-2 font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">S/ {soles(campana.presupuesto_total_soles * 100)}</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="font-bold">Cuándo</h4>
              <ol className="flex flex-col gap-3">
                {campana.calendario.map((p, i) => (
                  <li key={`${p.fecha}-${p.hora}-${i}`} className="flex flex-col">
                    <span className="text-meta text-ink-secondary">{fechaCalendario(p.fecha, p.hora)}</span>
                    <span className="[overflow-wrap:anywhere]">{p.accion}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Tarjeta>
        </div>
      </div>
    </section>
  );
}
