"use client";

import { useState } from "react";
import { Aviso, Boton, Campo, Tarjeta } from "@/components/ui";
import {
  generarSeccionesCine,
  sugerirDimensiones,
  sugerirGrupos,
  validarConfigCine,
  type GrupoFilas,
} from "@/lib/mapa-cine";
import type { EstadoSeccion } from "@/lib/pizarra-mapa";

export type GeneradorCineProps = {
  /** La pizarra ya tiene secciones numeradas: generar las reemplaza (se pide confirmación). */
  haySecciones: boolean;
  alGenerar: (secciones: EstadoSeccion[]) => void;
};

const entero = (texto: string) => (texto.trim() === "" ? NaN : Number(texto));

/**
 * Arma la sala de una vez (2.13): aforo → filas × asientos por fila sugeridos, filas agrupadas en
 * secciones (sugeridas o a mano) y pasillo al medio. El resultado se retoca después en la pizarra.
 */
export function GeneradorCine({ haySecciones, alGenerar }: GeneradorCineProps) {
  const [abierto, setAbierto] = useState(!haySecciones);
  const [aforo, setAforo] = useState("");
  const [filas, setFilas] = useState("");
  const [asientos, setAsientos] = useState("");
  const [pasillo, setPasillo] = useState(true);
  const [grupos, setGrupos] = useState<{ nombre: string; filas: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const nFilas = entero(filas);
  const nAsientos = entero(asientos);
  const total = Number.isFinite(nFilas) && Number.isFinite(nAsientos) ? nFilas * nAsientos : 0;
  const sumaGrupos = grupos.reduce((s, g) => s + (Number(g.filas) || 0), 0);

  function sugerir() {
    const d = sugerirDimensiones(entero(aforo));
    if (!d.filas) {
      setError("Escribe el aforo para sugerirte filas y asientos.");
      return;
    }
    setFilas(String(d.filas));
    setAsientos(String(d.asientosPorFila));
    setGrupos(aTexto(sugerirGrupos(d.filas)));
    setError(null);
  }

  function generar() {
    const config = {
      filas: nFilas,
      asientosPorFila: nAsientos,
      pasilloCentral: pasillo,
      grupos: grupos.map((g) => ({ nombre: g.nombre, filas: entero(g.filas) })),
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
          Dinos cuántas filas y asientos tiene y cómo agruparlas en secciones. Después puedes retocar la pizarra y
          ponerle precio a cada sección.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Campo
          id="generador-aforo"
          etiqueta="Aforo (opcional)"
          inputMode="numeric"
          value={aforo}
          onChange={(e) => setAforo(e.target.value)}
          className="sm:flex-1"
        />
        <Boton type="button" variante="secundario" onClick={sugerir}>
          Sugerir filas y secciones
        </Boton>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo
          id="generador-filas"
          etiqueta="Filas"
          inputMode="numeric"
          value={filas}
          onChange={(e) => setFilas(e.target.value)}
        />
        <Campo
          id="generador-asientos"
          etiqueta="Asientos por fila"
          inputMode="numeric"
          value={asientos}
          onChange={(e) => setAsientos(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 text-body">
        <input type="checkbox" checked={pasillo} onChange={(e) => setPasillo(e.target.checked)} className="size-5" />
        Pasillo al medio
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-body">Secciones (de adelante hacia atrás)</h3>
          <Boton
            type="button"
            variante="secundario"
            disabled={!Number.isFinite(nFilas) || nFilas < 1}
            onClick={() => setGrupos(aTexto(sugerirGrupos(nFilas)))}
          >
            Sugerir secciones
          </Boton>
        </div>
        {grupos.map((g, i) => (
          <div key={i} className="flex items-end gap-2">
            <Campo
              id={`generador-seccion-${i}`}
              etiqueta={`Sección ${i + 1}`}
              placeholder="Ej.: VIP"
              maxLength={60}
              value={g.nombre}
              onChange={(e) => setGrupos((a) => a.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
              className="flex-1"
            />
            <Campo
              id={`generador-seccion-${i}-filas`}
              etiqueta="Filas"
              inputMode="numeric"
              value={g.filas}
              onChange={(e) => setGrupos((a) => a.map((x, j) => (j === i ? { ...x, filas: e.target.value } : x)))}
              className="w-20"
            />
            <Boton
              type="button"
              variante="secundario"
              aria-label={`Quitar la sección ${i + 1}`}
              onClick={() => setGrupos((a) => a.filter((_, j) => j !== i))}
            >
              ✕
            </Boton>
          </div>
        ))}
        <Boton
          type="button"
          variante="secundario"
          className="self-start"
          onClick={() => setGrupos((a) => [...a, { nombre: "", filas: "" }])}
        >
          + Agregar sección
        </Boton>
        {grupos.length > 0 && Number.isFinite(nFilas) && (
          <p className="text-meta text-ink-secondary">
            {sumaGrupos} de {nFilas} filas asignadas{total > 0 ? ` · ${total} butacas en total` : ""}.
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

function aTexto(grupos: GrupoFilas[]) {
  return grupos.map((g) => ({ nombre: g.nombre, filas: String(g.filas) }));
}
