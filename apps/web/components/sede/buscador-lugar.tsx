"use client";

import { useEffect, useRef, useState } from "react";
import { Campo } from "@/components/ui";
import {
  cargarGoogleMaps,
  lugarASede,
  SESGO_PIURA,
  type ComponenteDireccion,
  type LugarSede,
} from "@/lib/google-places";

// Lo justo de Places API (New) que usa el buscador (no se instala @types/google.maps).
type Lugar = {
  displayName?: string | null;
  formattedAddress?: string | null;
  addressComponents?: ComponenteDireccion[];
  fetchFields(opciones: { fields: string[] }): Promise<unknown>;
};
type Prediccion = {
  placeId: string;
  types: string[];
  mainText?: { text: string } | null;
  secondaryText?: { text: string } | null;
  text: { text: string };
  toPlace(): Lugar;
};
type LibreriaPlaces = {
  AutocompleteSessionToken: new () => unknown;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(pedido: Record<string, unknown>): Promise<{
      suggestions: { placePrediction: Prediccion | null }[];
    }>;
  };
};

const TIPOS_LOCAL = ["establishment", "point_of_interest"];

export type BuscadorLugarProps = {
  /** Clave pública de Maps. Sin ella el buscador no se muestra y se llenan los campos a mano. */
  clave: string | undefined;
  /** Nombre que ya escribió el usuario: se conserva si elige una dirección suelta. */
  nombreActual: string;
  alElegir: (lugar: LugarSede) => void;
};

/** Busca el local en Google Maps y rellena nombre, dirección y distrito de la sede nueva. */
export function BuscadorLugar({ clave, nombreActual, alElegir }: BuscadorLugarProps) {
  const [places, setPlaces] = useState<LibreriaPlaces | null>(null);
  const [fallo, setFallo] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [sugerencias, setSugerencias] = useState<Prediccion[]>([]);
  const [elegido, setElegido] = useState<string | null>(null);
  const sesion = useRef<unknown>(null);
  const ultimaConsulta = useRef("");

  useEffect(() => {
    if (!clave) return;
    let vivo = true;
    cargarGoogleMaps(clave)
      .then(() => (window as unknown as { google: { maps: { importLibrary(n: string): Promise<unknown> } } }).google.maps.importLibrary("places"))
      .then((lib) => vivo && setPlaces(lib as LibreriaPlaces))
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, [clave]);

  useEffect(() => {
    if (!places) return;
    const texto = consulta.trim();
    if (texto.length < 3) return;
    const temporizador = setTimeout(() => {
      sesion.current ??= new places.AutocompleteSessionToken();
      ultimaConsulta.current = texto;
      places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: texto,
        sessionToken: sesion.current,
        includedRegionCodes: ["pe"],
        locationBias: SESGO_PIURA,
        language: "es",
      })
        .then(({ suggestions }) => {
          if (ultimaConsulta.current !== texto) return;
          setSugerencias(suggestions.flatMap((s) => (s.placePrediction ? [s.placePrediction] : [])).slice(0, 5));
        })
        .catch(() => setSugerencias([]));
    }, 250);
    return () => clearTimeout(temporizador);
  }, [consulta, places]);

  if (!clave || fallo) return null;
  // Con menos de 3 letras no se busca: se ocultan las sugerencias anteriores.
  const visibles = consulta.trim().length >= 3 ? sugerencias : [];

  async function elegir(prediccion: Prediccion) {
    setSugerencias([]);
    setConsulta(prediccion.text.text);
    const lugar = prediccion.toPlace();
    try {
      await lugar.fetchFields({ fields: ["displayName", "formattedAddress", "addressComponents"] });
    } catch {
      return;
    } finally {
      // La sesión de autocompletado termina al pedir los detalles del lugar.
      sesion.current = null;
    }
    const esLocal = prediccion.types.some((t) => TIPOS_LOCAL.includes(t));
    alElegir(lugarASede(lugar, esLocal, nombreActual));
    setElegido(prediccion.text.text);
  }

  return (
    <div className="flex flex-col gap-2">
      <Campo
        id="sede-buscar"
        etiqueta="Busca el local en Google Maps"
        placeholder="Ej.: Teatro Municipal de Piura"
        autoComplete="off"
        role="combobox"
        aria-expanded={visibles.length > 0}
        aria-controls="sede-buscar-lista"
        aria-autocomplete="list"
        disabled={!places}
        ayuda={
          elegido
            ? "Listo: revisa abajo el nombre, la dirección y el distrito."
            : "Elige una sugerencia y llenamos los datos de la sede por ti."
        }
        value={consulta}
        onChange={(e) => {
          setConsulta(e.target.value);
          setElegido(null);
        }}
      />
      {visibles.length > 0 && (
        <ul
          id="sede-buscar-lista"
          role="listbox"
          aria-label="Sugerencias de Google Maps"
          className="flex flex-col overflow-hidden rounded-sm border border-ink-on-inverse-secondary bg-surface-raised"
        >
          {visibles.map((s) => (
            <li key={s.placeId} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => void elegir(s)}
                className="flex w-full flex-col items-start gap-1 px-3 py-3 text-left hover:bg-surface-base focus:bg-surface-base focus:outline-none"
              >
                <span className="text-body text-ink-primary">{s.mainText?.text ?? s.text.text}</span>
                {s.secondaryText?.text && <span className="text-meta text-ink-secondary">{s.secondaryText.text}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
