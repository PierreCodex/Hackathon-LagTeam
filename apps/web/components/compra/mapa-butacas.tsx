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
/** Butacas que se pueden comprar de una vez. */
const MAXIMO_BUTACAS = 10;

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

  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [metodo, setMetodo] = useState<MetodoPago>("tarjeta");
  /** Órdenes ya creadas por butaca (si el pago falló, se reintenta sobre la misma orden). */
  const [ordenes, setOrdenes] = useState<Record<string, string>>({});
  const [fase, setFase] = useState<Fase>("idle");
  const [error, setError] = useState<ErrorApi | null>(null);
  const [adelantaron, setAdelantaron] = useState(false);
  /** Butacas compradas en este intento cuando alguna otra falló (para enlazar a Mis entradas). */
  const [compradas, setCompradas] = useState(0);

  const porId = useMemo(() => new Map(butacas.map((b) => [b.asiento_id, b])), [butacas]);
  const elegidas = seleccion.flatMap((id) => {
    const b = porId.get(id);
    return b ? [b] : [];
  });
  const total = elegidas.reduce((suma, b) => suma + b.precio_centimos, 0);
  const pendientePago = seleccion.some((id) => ordenes[id]);
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
          if (fila.estado === "vendida") setSeleccion((actual) => actual.filter((id) => id !== fila.asiento_id));
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
    setCompradas(0);
    setSeleccion((actual) => {
      if (actual.includes(asientoId)) return actual.filter((id) => id !== asientoId);
      return actual.length >= MAXIMO_BUTACAS ? actual : [...actual, asientoId];
    });
  }

  /** Crea (si hace falta) y paga la orden de una butaca. Devuelve el error, o `null` si quedó pagada. */
  async function comprarUna(asientoId: string, token: string): Promise<ErrorApi | null> {
    let ordenId = ordenes[asientoId];
    if (!ordenId) {
      setFase("creando");
      const creada = await pedirApi("ventas/ordenes/asiento", OrdenSchema, {
        apiUrl,
        metodo: "POST",
        cuerpo: { evento_id: eventoId, asiento_id: asientoId },
        cabeceras: { Authorization: `Bearer ${token}` },
      });
      if (!creada.ok) return creada.error;
      const id = creada.datos.id;
      ordenId = id;
      setOrdenes((a) => ({ ...a, [asientoId]: id }));
    }
    setFase("pagando");
    const pagada = await pedirApi(`ventas/ordenes/${encodeURIComponent(ordenId)}/pagar`, OrdenPagadaSchema, {
      apiUrl,
      metodo: "POST",
      cuerpo: { metodo },
      cabeceras: { Authorization: `Bearer ${token}` },
    });
    return pagada.ok ? null : pagada.error;
  }

  /** Compra cada butaca elegida, una tras otra: las que se pueden se compran aunque otra falle. */
  async function comprar() {
    if (ocupado || seleccion.length === 0) return;
    setError(null);
    setAdelantaron(false);
    setCompradas(0);

    const token = await tokenDelNavegador();
    if (!token) {
      router.push(rutaIngresar(ruta));
      return;
    }

    const vendidas: string[] = [];
    const fallidas: { id: string; error: ErrorApi }[] = [];
    for (const id of seleccion) {
      const problema = await comprarUna(id, token);
      if (problema) fallidas.push({ id, error: problema });
      else vendidas.push(id);
    }
    setFase("idle");

    // Las compradas quedan vendidas también en esta pantalla (las demás pantallas las reciben por Realtime).
    setButacas((a) => a.map((b) => (vendidas.includes(b.asiento_id) ? { ...b, estado: "vendida" } : b)));
    setOrdenes((a) => Object.fromEntries(Object.entries(a).filter(([id]) => !vendidas.includes(id))));

    if (fallidas.length === 0) {
      setSeleccion([]);
      router.refresh();
      router.push("/mis-entradas");
      return;
    }

    const perdidas = fallidas.filter((x) => estadoDeErrorCompraButaca(x.error).tipo === "revisar_mapa").map((x) => x.id);
    // Quedan seleccionadas solo las que se pueden reintentar.
    setSeleccion(fallidas.map((x) => x.id).filter((id) => !perdidas.includes(id)));
    setOrdenes((a) => Object.fromEntries(Object.entries(a).filter(([id]) => !perdidas.includes(id))));
    setCompradas(vendidas.length);
    if (perdidas.length > 0) {
      setAdelantaron(true);
      await recargarButacas();
    }
    const nombres = fallidas.map((x) => {
      const b = porId.get(x.id);
      return b ? `${b.seccion} ${b.fila}-${b.numero}` : "una butaca";
    });
    const primero = fallidas[0]!.error;
    setError({ ...primero, mensaje: `No se pudo comprar: ${nombres.join(", ")}. ${primero.mensaje}` });
  }

  const decision = error ? estadoDeErrorCompraButaca(error) : null;
  const seccionesNumeradas = mapa.secciones.filter((s) => s.tipo === "numerada");

  return (
    <div className="flex flex-col gap-6">
      {adelantaron && (
        <Aviso tipo="advertencia" titulo="Alguien se adelantó.">
          Alguna butaca ya no está disponible. Elige otra en el mapa, ya actualizado.
        </Aviso>
      )}

      {compradas > 0 && (
        <Aviso
          tipo="exito"
          titulo={`Compraste ${compradas} ${compradas === 1 ? "butaca" : "butacas"}.`}
          accion={
            <Boton variante="secundario" onClick={() => router.push("/mis-entradas")}>
              Ver mis entradas
            </Boton>
          }
        >
          Las demás no se pudieron comprar: revisa el aviso de abajo.
        </Aviso>
      )}

      {error && (
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
              {actualizandoMapa ? "Actualizando el mapa…" : `Elige tus butacas (hasta ${MAXIMO_BUTACAS}).`}
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
          {elegidas.length === 0 ? (
            <p className="text-meta text-ink-secondary">Toca las butacas disponibles del mapa que quieres comprar.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1">
                {elegidas.map((b) => (
                  <li key={b.asiento_id} className="flex items-center justify-between gap-2 text-meta">
                    <span>
                      {b.seccion} · Fila {b.fila} · Asiento {b.numero}
                    </span>
                    <span className="shrink-0 tabular-nums">S/ {soles(b.precio_centimos)}</span>
                  </li>
                ))}
              </ul>
              <p className="flex items-baseline justify-between border-t border-border-hairline pt-2">
                <span>
                  {elegidas.length} {elegidas.length === 1 ? "butaca" : "butacas"}
                </span>
                <span className="text-title">S/ {soles(total)}</span>
              </p>
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
                  ? "Creando las órdenes…"
                  : fase === "pagando"
                    ? "Pagando…"
                    : pendientePago
                      ? "Reintentar pago"
                      : `Comprar ${elegidas.length} ${elegidas.length === 1 ? "butaca" : "butacas"}`}
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
  seleccion: string[];
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
                const seleccionada = seleccion.includes(asiento.id);
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
