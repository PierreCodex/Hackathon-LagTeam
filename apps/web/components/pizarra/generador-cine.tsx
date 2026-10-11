"use client";

import { useState } from "react";
import { Aviso, Boton, Campo, Tarjeta } from "@/components/ui";
import { clases } from "@/lib/clases";
import {
  filasDeSeccion,
  generarSeccionesCine,
  repartirAforo,
  sugerirAsientosPorFila,
  validarConfigCine,
} from "@/lib/mapa-cine";
import type { EstadoSeccion } from "@/lib/pizarra-mapa";

/** Lo que el alta del evento ya decidió: el aforo (total de butacas) y sus categorías de precio. */
export type ObjetivoCroquis = { aforo: number; categorias: string[] };

export type GeneradorCineProps = {
  /** La pizarra ya tiene secciones numeradas: generar las reemplaza (se pide confirmación). */
  haySecciones: boolean;
  /** Si viene de un evento, el total debe ser su aforo y las secciones parten de sus categorías. */
  objetivo?: ObjetivoCroquis;
  alGenerar: (secciones: EstadoSeccion[]) => void;
};

type FilaGenerador = { nombre: string; asientos: string };

const entero = (texto: string) => (texto.trim() === "" ? NaN : Number(texto));

function inicial(objetivo: ObjetivoCroquis | undefined): FilaGenerador[] {
  if (!objetivo) return [];
  const nombres = objetivo.categorias.length > 0 ? objetivo.categorias : ["General"];
  return repartirAforo(objetivo.aforo, nombres).map((s) => ({ nombre: s.nombre, asientos: String(s.asientos) }));
}

/**
 * Arma la sala de una vez (2.13): las butacas del aforo repartidas entre las secciones (las categorías
 * del evento), con + y − por sección y el total siempre validado contra el aforo. Las filas salen solas
 * según los asientos por fila; el resultado se retoca después en la pizarra.
 */
export function GeneradorCine({ haySecciones, objetivo, alGenerar }: GeneradorCineProps) {
  const [abierto, setAbierto] = useState(!haySecciones);
  const [aforoLibre, setAforoLibre] = useState("");
  const [porFila, setPorFila] = useState(() => (objetivo ? String(sugerirAsientosPorFila(objetivo.aforo)) : ""));
  const [pasillo, setPasillo] = useState(true);
  const [secciones, setSecciones] = useState<FilaGenerador[]>(() => inicial(objetivo));
  const [error, setError] = useState<string | null>(null);

  const aforo = objetivo ? objetivo.aforo : entero(aforoLibre);
  const nPorFila = entero(porFila);
  const total = secciones.reduce((s, x) => s + (Number(x.asientos) || 0), 0);
  const diferencia = Number.isFinite(aforo) ? aforo - total : 0;

  function cambiarAsientos(i: number, valor: string) {
    setSecciones((a) => a.map((x, j) => (j === i ? { ...x, asientos: valor } : x)));
    setError(null);
  }

  function repartir() {
    if (!Number.isInteger(aforo) || aforo < 1) {
      setError("Escribe el aforo para repartir las butacas.");
      return;
    }
    const nombres = secciones.length > 0 ? secciones.map((s) => s.nombre || "General") : ["General"];
    setSecciones(repartirAforo(aforo, nombres).map((s) => ({ nombre: s.nombre, asientos: String(s.asientos) })));
    if (!Number.isFinite(nPorFila) || nPorFila < 1) setPorFila(String(sugerirAsientosPorFila(aforo)));
    setError(null);
  }

  function generar() {
    const config = {
      asientosPorFila: nPorFila,
      pasilloCentral: pasillo,
      secciones: secciones.map((s) => ({ nombre: s.nombre, asientos: entero(s.asientos) })),
      aforo: Number.isFinite(aforo) ? aforo : undefined,
    };
    const problema = validarConfigCine(config);
    if (problema) {
      setError(problema);
      return;
    }
    if (haySecciones && !window.confirm("Se reemplazarán las secciones numeradas de la pizarra. ¿Continuar?")) return;
    setError(null);
    alGenerar(generarSeccionesCine(config));
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <Boton type="button" variante="secundario" onClick={() => setAbierto(true)} className="self-start">
        Armar la sala automáticamente
      </Boton>
    );
  }

  return (
    <Tarjeta como="section" aria-labelledby="titulo-generador" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="titulo-generador" className="text-title">
          Armar la sala automáticamente
        </h2>
        <p className="text-meta text-ink-secondary">
          {objetivo
            ? `Tu evento tiene un aforo de ${objetivo.aforo} butacas y estas categorías. Ajusta cuántas butacas tiene cada una con + y −: el total debe ser ${objetivo.aforo}.`
            : "Reparte las butacas entre las secciones y elige cuántos asientos van por fila. Después puedes retocar la pizarra."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {objetivo ? (
          <div className="flex flex-col gap-2">
            <span className="text-meta text-ink-primary">Aforo del evento</span>
            <span className="flex h-12 items-center text-title">{objetivo.aforo}</span>
          </div>
        ) : (
          <Campo
            id="generador-aforo"
            etiqueta="Aforo (butacas)"
            inputMode="numeric"
            value={aforoLibre}
            onChange={(e) => setAforoLibre(e.target.value)}
          />
        )}
        <Campo
          id="generador-por-fila"
          etiqueta="Asientos por fila"
          inputMode="numeric"
          value={porFila}
          onChange={(e) => setPorFila(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 text-body">
        <input type="checkbox" checked={pasillo} onChange={(e) => setPasillo(e.target.checked)} className="size-5" />
        Pasillo al medio
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-body">Secciones (de adelante hacia atrás)</h3>
          <Boton type="button" variante="secundario" onClick={repartir}>
            Repartir automáticamente
          </Boton>
        </div>
        {secciones.map((s, i) => {
          const n = Number(s.asientos) || 0;
          const filas = Number.isFinite(nPorFila) && nPorFila > 0 ? filasDeSeccion(n, nPorFila) : 0;
          return (
            <div key={i} className="flex flex-col gap-1 border-b border-border-hairline pb-2">
              <div className="flex items-end gap-2">
                <Campo
                  id={`generador-seccion-${i}`}
                  etiqueta={`Sección ${i + 1}`}
                  placeholder="Ej.: VIP"
                  maxLength={60}
                  value={s.nombre}
                  onChange={(e) => setSecciones((a) => a.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                  className="min-w-0 flex-1"
                />
                {!objetivo && (
                  <Boton
                    type="button"
                    variante="secundario"
                    aria-label={`Quitar la sección ${i + 1}`}
                    onClick={() => setSecciones((a) => a.filter((_, j) => j !== i))}
                  >
                    ✕
                  </Boton>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Boton
                  type="button"
                  variante="secundario"
                  aria-label={`Quitar una butaca a ${s.nombre || `la sección ${i + 1}`}`}
                  disabled={n <= 1}
                  onClick={() => cambiarAsientos(i, String(n - 1))}
                >
                  −
                </Boton>
                <input
                  aria-label={`Butacas de ${s.nombre || `la sección ${i + 1}`}`}
                  inputMode="numeric"
                  value={s.asientos}
                  onChange={(e) => cambiarAsientos(i, e.target.value)}
                  className="h-12 w-20 rounded-sm border border-ink-on-inverse-secondary bg-surface-raised text-center text-body"
                />
                <Boton
                  type="button"
                  variante="secundario"
                  aria-label={`Agregar una butaca a ${s.nombre || `la sección ${i + 1}`}`}
                  onClick={() => cambiarAsientos(i, String(n + 1))}
                >
                  +
                </Boton>
                <span className="text-meta text-ink-secondary">
                  butacas{filas > 0 ? ` · ${filas} ${filas === 1 ? "fila" : "filas"}` : ""}
                </span>
              </div>
            </div>
          );
        })}
        {!objetivo && (
          <Boton
            type="button"
            variante="secundario"
            className="self-start"
            onClick={() => setSecciones((a) => [...a, { nombre: "", asientos: "" }])}
          >
            + Agregar sección
          </Boton>
        )}
        {Number.isFinite(aforo) && (
          <p
            className={clases("text-meta", diferencia === 0 ? "text-state-success" : "text-state-error")}
            aria-live="polite"
          >
            {total} de {aforo} butacas
            {diferencia > 0 ? ` · faltan ${diferencia}` : diferencia < 0 ? ` · sobran ${-diferencia}` : " · cuadra con el aforo"}
          </p>
        )}
      </div>

      {error && (
        <Aviso tipo="error" titulo="Revisa los datos de la sala.">
          {error}
        </Aviso>
      )}

      <div className="flex flex-wrap gap-3">
        <Boton type="button" onClick={generar}>
          Generar mapa
        </Boton>
        {haySecciones && (
          <Boton type="button" variante="secundario" onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
        )}
      </div>
    </Tarjeta>
  );
}
