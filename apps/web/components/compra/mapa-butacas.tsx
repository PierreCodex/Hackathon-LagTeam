"use client";

import {
  type ButacaVenta,
  ButacasVentaSchema,
  type ErrorApi,
  type EventoPublico,
  type MapaSede,
  type MetodoPago,
  OrdenPagadaSchema,
  OrdenSchema,
} from "@reto18/shared";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Aviso, Boton, Selector, Tarjeta } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { clases } from "@/lib/clases";
import { OPCIONES_METODO_PAGO } from "@/lib/compra";
import { colorDeButaca, estadoDeErrorCompraButaca } from "@/lib/compra-butaca";
import { soles } from "@/lib/pieza";
import { rutaIngresar } from "@/lib/sesion";
import { crearClienteNavegador, tokenDelNavegador } from "@/lib/supabase/navegador";

export type MapaButacasProps = {
  eventoId: string;
  /** Estructura de la sede (secciones → filas → bloques → asientos), de solo lectura (2.9, cerrada). */
  mapa: MapaSede;
  evento: EventoPublico;
  /** `GET .../butacas` leído en el servidor (`page.tsx`): estado inicial, antes de que Realtime tome el relevo. */
  butacasIniciales: ButacaVenta[];
  apiUrl: string;
};

type Fase = "idle" | "creando" | "pagando";
type FilaMapa = Extract<MapaSede["secciones"][number], { tipo: "numerada" }>["filas"][number];

const RUTA = (eventoId: string) => `/eventos/${eventoId}/butacas`;

/**
 * Mapa de butacas (historia 2.11, versión reducida del 11/10/2026): el navegador lee el estado inicial
 * por la API y las actualizaciones en vivo por Supabase Realtime (AD-1, solo SELECT). Sin bloqueo
 * temporal de la butaca ni colores por categoría: solo disponible/vendida/seleccionada. Comprar crea la
 * orden y paga en un solo clic, igual que `FormularioCompra` (2.8); si alguien se adelantó, refresca el mapa.
 */
export function MapaButacas({ eventoId, mapa, evento, butacasIniciales, apiUrl }: MapaButacasProps) {
  const router = useRouter();
  const ruta = RUTA(eventoId);

  const [butacas, setButacas] = useState<ButacaVenta[]>(butacasIniciales);
  const [actualizandoMapa, setActualizandoMapa] = useState(false);

  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<MetodoPago>("tarjeta");
  const [ordenId, setOrdenId] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("idle");
  const [error, setError] = useState<ErrorApi | null>(null);
  const [adelantaron, setAdelantaron] = useState(false);

  const porId = useMemo(() => new Map(butacas.map((b) => [b.asiento_id, b])), [butacas]);
  const butacaElegida = seleccion ? porId.get(seleccion) : undefined;
  const pendientePago = ordenId !== null;
  const ocupado = fase !== "idle";

  /** Vuelve a pedir el mapa de butacas (tras `BUTACA_NO_DISPONIBLE`/`ASIENTO_NO_EXISTE`/`VENTA_CERRADA`). */
  async function recargarButacas() {
    setActualizandoMapa(true);
    const resultado = await pedirApi(`ventas/eventos/${eventoId}/butacas`, ButacasVentaSchema, { apiUrl });
    setActualizandoMapa(false);
    if (resultado.ok) setButacas(resultado.datos);
  }

  // AD-1: lectura pública en vivo de `ventas_evento_asientos` por Realtime, solo SELECT (nunca escritura).
  useEffect(() => {
    const supabase = crearClienteNavegador();
    if (!supabase) return;
    const canal = supabase
      .channel(`butacas-${eventoId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ventas_evento_asientos", filter: `evento_id=eq.${eventoId}` },
        (payload) => {
          const fila = payload.new as { asiento_id?: string; estado?: "disponible" | "vendida" };
          if (!fila.asiento_id || !fila.estado) return;
          setButacas((anteriores) =>
            anteriores.map((b) => (b.asiento_id === fila.asiento_id ? { ...b, estado: fila.estado! } : b)),
          );
          setSeleccion((actual) => (actual === fila.asiento_id && fila.estado === "vendida" ? null : actual));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [eventoId]);

  function elegir(asientoId: string) {
    if (ocupado) return;
    setError(null);
    setAdelantaron(false);
    setOrdenId(null); // una selección nueva empieza una compra nueva
    setSeleccion((actual) => (actual === asientoId ? null : asientoId));
  }

  async function manejarError(errorApi: ErrorApi, ordenIdDeEsteIntento: string | null) {
    setError(errorApi);
    if (estadoDeErrorCompraButaca(errorApi).tipo === "revisar_mapa") {
      setAdelantaron(true);
      setOrdenId(null);
      setSeleccion(null);
      await recargarButacas();
      return;
    }
    setOrdenId(ordenIdDeEsteIntento);
  }

  async function pagar(id: string, token: string) {
    setFase("pagando");
    const pagada = await pedirApi(`ventas/ordenes/${encodeURIComponent(id)}/pagar`, OrdenPagadaSchema, {
      apiUrl,
      metodo: "POST",
      cuerpo: { metodo },
      cabeceras: { Authorization: `Bearer ${token}` },
    });
    setFase("idle");
    if (!pagada.ok) {
      await manejarError(pagada.error, id);
      return;
    }
    // La butaca queda vendida en esta pantalla también (las demás la reciben por Realtime).
    const vendida = seleccion;
    setButacas((anteriores) => anteriores.map((b) => (b.asiento_id === vendida ? { ...b, estado: "vendida" } : b)));
    setSeleccion(null);
    setOrdenId(null);
    router.refresh();
    router.push("/mis-entradas");
  }

  async function comprar() {
    if (ocupado) return;
    setError(null);
    setAdelantaron(false);

    const token = await tokenDelNavegador();
    if (!token) {
      router.push(rutaIngresar(ruta));
      return;
    }

    if (ordenId) {
      await pagar(ordenId, token);
      return;
    }
    if (!seleccion) return;

    setFase("creando");
    const creada = await pedirApi("ventas/ordenes/asiento", OrdenSchema, {
      apiUrl,
      metodo: "POST",
      cuerpo: { evento_id: eventoId, asiento_id: seleccion },
      cabeceras: { Authorization: `Bearer ${token}` },
    });
    if (!creada.ok) {
      setFase("idle");
      await manejarError(creada.error, null);
      return;
    }
    setOrdenId(creada.datos.id);
    await pagar(creada.datos.id, token);
  }

  const decision = error ? estadoDeErrorCompraButaca(error) : null;
  const seccionesNumeradas = mapa.secciones.filter((s) => s.tipo === "numerada");

  return (
    <div className="flex flex-col gap-6">
      {adelantaron && (
        <Aviso tipo="advertencia" titulo="Alguien se adelantó.">
          Esa butaca ya no está disponible. Elige otra en el mapa, ya actualizado.
        </Aviso>
      )}

      {error && !adelantaron && (
        <Aviso
          tipo="error"
          titulo="No pudimos completar la compra."
          accion={
            decision?.tipo === "reintentar" ? (
              <Boton variante="secundario" onClick={() => void comprar()} disabled={ocupado}>
                Reintentar
              </Boton>
            ) : undefined
          }
        >
          {error.mensaje}
        </Aviso>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section
          aria-label="Mapa de butacas"
          className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-surface-inverse text-ink-on-inverse"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-inverse px-4 py-3">
            <p className="text-meta text-ink-on-inverse-secondary">
              {actualizandoMapa ? "Actualizando el mapa…" : "Elige una butaca disponible."}
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="flex min-w-max flex-col items-center gap-6 px-4 py-6" style={{ "--butaca": "36px" } as CSSProperties}>
              <p className="w-full border-y border-border-inverse py-2 text-center text-meta tracking-[0.4em] text-ink-on-inverse-secondary">
                ESCENARIO
              </p>

              {seccionesNumeradas.map((seccion) =>
                seccion.tipo !== "numerada" ? null : (
                  <div
                    key={seccion.id}
                    className="flex w-full flex-col items-center gap-2 rounded-md border border-border-inverse bg-surface-inverse-raised px-4 py-4"
                  >
                    <h3 className="text-body">{seccion.nombre}</h3>
                    <div className="flex flex-col items-center gap-1">
                      {seccion.filas.map((fila) => (
                        <FilaButacas
                          key={fila.id}
                          fila={fila}
                          porId={porId}
                          seleccion={seleccion}
                          deshabilitado={ocupado}
                          onClic={elegir}
                        />
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        <Tarjeta como="section" aria-labelledby="titulo-butaca" className="flex w-full flex-col gap-3 lg:w-64 lg:shrink-0">
          <h3 id="titulo-butaca" className="text-title">
            {evento.titulo}
          </h3>
          {!butacaElegida ? (
            <p className="text-meta text-ink-secondary">Toca una butaca disponible del mapa para comprarla.</p>
          ) : (
            <>
              <p>
                Sección {butacaElegida.seccion} · Fila {butacaElegida.fila} · Asiento {butacaElegida.numero}
              </p>
              <p className="text-title">S/ {soles(butacaElegida.precio_centimos)}</p>
              <Selector
                id="metodo-pago"
                etiqueta="Método de pago"
                opciones={OPCIONES_METODO_PAGO}
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as MetodoPago)}
                disabled={pendientePago}
              />
              <Boton onClick={() => void comprar()} disabled={ocupado} anchoCompleto>
                {fase === "creando"
                  ? "Creando la orden…"
                  : fase === "pagando"
                    ? "Pagando…"
                    : pendientePago
                      ? "Reintentar pago"
                      : "Comprar"}
              </Boton>
            </>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}

/** Una fila del mapa de butacas: cada butaca con su color según estado/selección; el pasillo, decorativo. */
function FilaButacas({
  fila,
  porId,
  seleccion,
  deshabilitado,
  onClic,
}: {
  fila: FilaMapa;
  porId: Map<string, ButacaVenta>;
  seleccion: string | null;
  deshabilitado: boolean;
  onClic: (asientoId: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-center text-meta text-ink-on-inverse-secondary">{fila.nombre}</span>
      <div className="flex items-center">
        {fila.bloques.map((bloque, k) => (
          <Fragment key={bloque.id}>
            {k > 0 && (
              <span aria-hidden="true" className="mx-1 flex h-(--butaca) w-[calc(var(--butaca)*0.5)] items-center justify-center">
                <span className="h-full w-px bg-border-inverse" />
              </span>
            )}
            <div className="flex items-center gap-0.5">
              {bloque.asientos.map((asiento) => {
                const butaca = porId.get(asiento.id);
                const estado = butaca?.estado ?? "vendida";
                const seleccionada = seleccion === asiento.id;
                const vendida = estado === "vendida";
                return (
                  <button
                    key={asiento.id}
                    type="button"
                    disabled={vendida || deshabilitado}
                    aria-label={`Asiento ${asiento.numero} de la fila ${fila.nombre}, ${
                      vendida ? "vendida" : seleccionada ? "seleccionada" : "disponible"
                    }`}
                    aria-pressed={seleccionada}
                    onClick={() => onClic(asiento.id)}
                    style={{ background: colorDeButaca(estado, seleccionada) }}
                    className={clases(
                      "flex size-(--butaca) shrink-0 items-center justify-center rounded-sm text-[calc(var(--butaca)*0.4)] leading-none",
                      vendida ? "text-ink-on-inverse-secondary" : "text-ink-primary",
                      seleccionada && "ring-2 ring-ink-on-inverse ring-offset-1 ring-offset-surface-inverse",
                      vendida || deshabilitado ? "cursor-not-allowed" : "cursor-pointer hover:opacity-80",
                    )}
                  >
                    {asiento.numero}
                  </button>
                );
              })}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
