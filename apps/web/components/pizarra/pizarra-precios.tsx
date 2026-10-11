"use client";

import { PreciosEventoSchema, type MapaSede, type PreciosEvento, type RangoPrecioEntrada, type ErrorApi } from "@reto18/shared";
import { Fragment, useState, type CSSProperties } from "react";
import { Aviso, Boton, Tarjeta } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { clases } from "@/lib/clases";
import { soles } from "@/lib/pieza";
import {
  agregarRango,
  aRangoEntrada,
  colorDeCategoria,
  estadoDeErrorGuardadoPrecios,
  pintarAsientos,
  rangosDeSeccion,
  rangosPorNombreDeSeccion,
  resolverCategoriaDeAsiento,
  SELECCION_NINGUNA,
  seleccionarAsiento,
  type SeleccionRango,
} from "@/lib/pizarra-precios";
import { tokenDelNavegador } from "@/lib/supabase/navegador";

export type PizarraPreciosProps = {
  eventoId: string;
  /** Estructura de la sede (secciones → filas → bloques → asientos), de solo lectura aquí (2.9, cerrada). */
  mapa: MapaSede;
  /** `GET .../precios`: rangos vigentes, cada asiento con su categoría y las categorías del evento. */
  precios: PreciosEvento;
  apiUrl: string;
  /** El evento ya está publicado: solo lectura, sin controles de selección ni "Guardar" (Boundaries). */
  soloLectura: boolean;
};

const MENSAJE_SIN_SESION = "Tu sesión se cerró. Recarga la página para ingresar de nuevo.";

/** Quita el `id` de un rango guardado: es lo que espera el cuerpo de `PUT .../precios`. */
function sinId(rango: PreciosEvento["rangos"][number]): RangoPrecioEntrada {
  return { categoria_id: rango.categoria_id, seccion: rango.seccion, fila: rango.fila, desde: rango.desde, hasta: rango.hasta };
}

/**
 * Pizarra de precios de un evento (historia 2.10): el organizador selecciona un rango de asientos de
 * una fila con dos clics (primero y último) y le asigna una categoría del panel, pintada con su color
 * real. Guarda con `PUT /eventos/:id/precios`, que reemplaza todos los rangos del evento.
 */
export function PizarraPrecios({ eventoId, mapa, precios, apiUrl, soloLectura: soloLecturaInicial }: PizarraPreciosProps) {
  // Sin rangos guardados y con el evento sin publicar: cada sección con nombre de categoría ya viene pintada.
  const [inicial] = useState(() => {
    const guardados = precios.rangos.map(sinId);
    const numeradas = mapa.secciones.filter((x) => x.tipo === "numerada");
    const sugeridos = guardados.length === 0 && !soloLecturaInicial ? rangosPorNombreDeSeccion(numeradas, precios.categorias) : [];
    return {
      rangos: sugeridos.length > 0 ? sugeridos : guardados,
      asientos: sugeridos.reduce(pintarAsientos, precios.asientos),
      sugerido: sugeridos.length > 0,
    };
  });
  const [asientos, setAsientos] = useState(inicial.asientos);
  const [rangos, setRangos] = useState(inicial.rangos);
  const [seleccion, setSeleccion] = useState<SeleccionRango>(SELECCION_NINGUNA);
  const [soloLectura, setSoloLectura] = useState(soloLecturaInicial);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [sinSesion, setSinSesion] = useState(false);
  const [error, setError] = useState<ErrorApi | null>(null);
  const categorias = precios.categorias;

  function limpiarAvisos() {
    setError(null);
    setSinSesion(false);
    setGuardadoOk(false);
  }

  function alClicAsiento(seccion: string, fila: string, numero: number) {
    if (soloLectura) return;
    setSeleccion((s) => seleccionarAsiento(s, seccion, fila, numero));
    limpiarAvisos();
  }

  function asignarCategoria(categoriaId: string) {
    const nuevo = aRangoEntrada(seleccion, categoriaId);
    if (!nuevo) return;
    setRangos((anteriores) => agregarRango(anteriores, nuevo));
    setAsientos((anteriores) => pintarAsientos(anteriores, nuevo));
    setSeleccion(SELECCION_NINGUNA);
    limpiarAvisos();
  }

  /** Pinta toda la sección con una categoría (un rango por fila). */
  function asignarSeccion(seccion: Parameters<typeof rangosDeSeccion>[0], categoriaId: string) {
    const nuevos = rangosDeSeccion(seccion, categoriaId);
    setRangos((anteriores) => nuevos.reduce(agregarRango, anteriores));
    setAsientos((anteriores) => nuevos.reduce(pintarAsientos, anteriores));
    setSeleccion(SELECCION_NINGUNA);
    limpiarAvisos();
  }

  async function guardar() {
    if (guardando || soloLectura) return;
    limpiarAvisos();
    setGuardando(true);
    const token = await tokenDelNavegador();
    if (!token) {
      setGuardando(false);
      setSinSesion(true);
      return;
    }
    const resultado = await pedirApi(`eventos/${eventoId}/precios`, PreciosEventoSchema, {
      apiUrl,
      metodo: "PUT",
      cuerpo: { rangos },
      cabeceras: { Authorization: `Bearer ${token}` },
    });
    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      if (estadoDeErrorGuardadoPrecios(resultado.error).tipo === "soloLectura") {
        setSoloLectura(true);
        setSeleccion(SELECCION_NINGUNA);
      }
      return;
    }
    setAsientos(resultado.datos.asientos);
    setRangos(resultado.datos.rangos.map(sinId));
    setSeleccion(SELECCION_NINGUNA);
    setGuardadoOk(true);
  }

  const decision = error ? estadoDeErrorGuardadoPrecios(error) : null;
  const seccionesNumeradas = mapa.secciones.filter((s) => s.tipo === "numerada");
  const hayRangoAbierto = seleccion.tipo === "rango";

  return (
    <div className="flex flex-col gap-6">
      {soloLectura && (
        <Aviso tipo="info" titulo="Este evento ya está publicado.">
          La pizarra de precios es de solo lectura: el mapa de butacas de su sede ya no cambia.
        </Aviso>
      )}

      {inicial.sugerido && !guardadoOk && !error && (
        <Aviso tipo="info" titulo="Pintamos cada sección con su categoría.">
          Revisa los precios y pulsa Guardar. Después vuelve a Mis eventos y publica el evento.
        </Aviso>
      )}

      {sinSesion && (
        <Aviso tipo="error" titulo="Tu sesión se cerró.">
          {MENSAJE_SIN_SESION}
        </Aviso>
      )}

      {guardadoOk && !error && (
        <Aviso tipo="exito" titulo="Los precios se guardaron.">
          Los asientos ya tienen su categoría.
        </Aviso>
      )}

      {error && (
        <Aviso
          tipo="error"
          titulo="No pudimos guardar los precios."
          accion={
            decision?.tipo === "reintentar" ? (
              <Boton variante="secundario" onClick={() => void guardar()} disabled={guardando}>
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
          aria-label="Pizarra de precios"
          className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-surface-inverse text-ink-on-inverse"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-inverse px-4 py-3">
            <p className="text-meta text-ink-on-inverse-secondary">
              {soloLectura
                ? "Mapa de precios (solo lectura)"
                : hayRangoAbierto
                  ? "Elige una categoría del panel para pintar el rango seleccionado."
                  : "Toca el primer y el último asiento del rango que quieres pintar."}
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
                    {!soloLectura && categorias.length > 0 && (
                      <label className="flex items-center gap-2 text-meta text-ink-on-inverse-secondary">
                        Precio de toda la sección
                        <select
                          value=""
                          onChange={(e) => e.target.value && asignarSeccion(seccion, e.target.value)}
                          className="h-9 rounded-sm border border-border-inverse bg-surface-raised px-2 text-meta text-ink-primary"
                        >
                          <option value="">Elegir categoría…</option>
                          {categorias.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre} · S/ {soles(c.precio_centimos)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="flex flex-col items-center gap-1">
                      {seccion.filas.map((fila) => (
                        <FilaPrecios
                          key={fila.id}
                          seccionNombre={seccion.nombre}
                          fila={fila}
                          asientos={asientos}
                          categorias={categorias}
                          seleccion={seleccion}
                          soloLectura={soloLectura}
                          onClicAsiento={alClicAsiento}
                        />
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        {!soloLectura && (
          <Tarjeta como="section" aria-labelledby="titulo-categorias" className="flex w-full flex-col gap-3 lg:w-64 lg:shrink-0">
            <h3 id="titulo-categorias" className="text-title">
              Categorías
            </h3>
            {categorias.length === 0 ? (
              <p className="text-meta text-ink-secondary">Este evento no tiene categorías de precio.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {categorias.map((categoria) => (
                  <li key={categoria.id}>
                    <button
                      type="button"
                      disabled={!hayRangoAbierto}
                      onClick={() => asignarCategoria(categoria.id)}
                      className={clases(
                        "flex w-full items-center gap-2 rounded-sm border border-border-hairline px-3 py-2 text-left",
                        hayRangoAbierto ? "hover:border-ink-primary" : "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span aria-hidden="true" className="size-4 shrink-0 rounded-sm" style={{ background: categoria.color }} />
                      <span className="min-w-0 flex-1 truncate">{categoria.nombre}</span>
                      <span className="shrink-0 text-meta text-ink-secondary tabular-nums">S/ {soles(categoria.precio_centimos)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Boton onClick={() => void guardar()} disabled={guardando} anchoCompleto>
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
          </Tarjeta>
        )}
      </div>
    </div>
  );
}

type FilaMapa = Extract<MapaSede["secciones"][number], { tipo: "numerada" }>["filas"][number];
type CategoriasEvento = PreciosEvento["categorias"];
type AsientosEvento = PreciosEvento["asientos"];

/** Una fila de la pizarra de precios: butacas pintadas con el color de su categoría; el pasillo, decorativo. */
function FilaPrecios({
  seccionNombre,
  fila,
  asientos,
  categorias,
  seleccion,
  soloLectura,
  onClicAsiento,
}: {
  seccionNombre: string;
  fila: FilaMapa;
  asientos: AsientosEvento;
  categorias: CategoriasEvento;
  seleccion: SeleccionRango;
  soloLectura: boolean;
  onClicAsiento: (seccion: string, fila: string, numero: number) => void;
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
                const categoriaId = resolverCategoriaDeAsiento(asientos, seccionNombre, fila.nombre, asiento.numero);
                const color = colorDeCategoria(categoriaId, categorias);
                const categoriaNombre = categorias.find((c) => c.id === categoriaId)?.nombre;
                const enSeleccion =
                  (seleccion.tipo === "primero" &&
                    seleccion.seccion === seccionNombre &&
                    seleccion.fila === fila.nombre &&
                    seleccion.numero === asiento.numero) ||
                  (seleccion.tipo === "rango" &&
                    seleccion.seccion === seccionNombre &&
                    seleccion.fila === fila.nombre &&
                    asiento.numero >= seleccion.desde &&
                    asiento.numero <= seleccion.hasta);
                return (
                  <button
                    key={asiento.id}
                    type="button"
                    disabled={soloLectura}
                    aria-label={`Asiento ${asiento.numero} de la fila ${fila.nombre}${categoriaNombre ? `, categoría ${categoriaNombre}` : ", sin categoría"}`}
                    aria-pressed={enSeleccion}
                    onClick={() => onClicAsiento(seccionNombre, fila.nombre, asiento.numero)}
                    style={{ background: color }}
                    className={clases(
                      "flex size-(--butaca) shrink-0 items-center justify-center rounded-sm text-[calc(var(--butaca)*0.4)] leading-none text-ink-on-inverse",
                      enSeleccion && "ring-2 ring-ink-on-inverse ring-offset-1 ring-offset-surface-inverse",
                      soloLectura ? "cursor-default" : "cursor-pointer hover:opacity-80",
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
