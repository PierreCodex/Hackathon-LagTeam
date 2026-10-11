/**
 * Buscador del local con Google Places (historia 2.15, versión web): carga el SDK de Maps en el
 * navegador y traduce el lugar elegido a los campos de la sede nueva (nombre, dirección y distrito).
 * La clave es pública (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) y se restringe por dominio en Google Cloud.
 */

/** Componente de dirección de Places API (New). */
export type ComponenteDireccion = { longText: string | null; shortText: string | null; types: string[] };

/** Datos de la sede que salen del lugar elegido. */
export type LugarSede = { nombre: string; direccion: string; distrito: string };

/** Centro de Piura: las sugerencias se inclinan hacia aquí (radio en metros). */
export const SESGO_PIURA = { center: { lat: -5.1945, lng: -80.6328 }, radius: 50000 };

// En Perú el distrito suele venir como `locality`; si no, se baja por la jerarquía administrativa.
const ORDEN_DISTRITO = ["locality", "sublocality", "administrative_area_level_3", "administrative_area_level_2"];

/** Distrito del lugar a partir de sus componentes de dirección ("" si no hay ninguno útil). */
export function distritoDe(componentes: ComponenteDireccion[]): string {
  for (const tipo of ORDEN_DISTRITO) {
    const c = componentes.find((x) => x.types.includes(tipo) && x.longText);
    if (c?.longText) return c.longText;
  }
  return "";
}

/** Dirección sin el país al final ("Av. Grau 123, Piura 20001, Perú" → "Av. Grau 123, Piura 20001"). */
export function direccionSinPais(direccion: string): string {
  return direccion.replace(/,\s*(Perú|Peru)\s*$/i, "").trim();
}

/**
 * Campos de la sede a partir del lugar. El nombre solo se toma de un local (establecimiento);
 * si el usuario eligió una dirección suelta, se conserva el nombre que ya escribió.
 */
export function lugarASede(
  lugar: { displayName?: string | null; formattedAddress?: string | null; addressComponents?: ComponenteDireccion[] },
  esLocal: boolean,
  nombreActual: string,
): LugarSede {
  return {
    nombre: (esLocal && lugar.displayName ? lugar.displayName : nombreActual).slice(0, 150),
    direccion: direccionSinPais(lugar.formattedAddress ?? "").slice(0, 200),
    distrito: distritoDe(lugar.addressComponents ?? []).slice(0, 100),
  };
}

type VentanaConMaps = Window & {
  google?: { maps?: { importLibrary?: (nombre: string) => Promise<unknown> } };
  gm_authFailure?: () => void;
  [callback: string]: unknown;
};

let carga: Promise<void> | undefined;

/** Carga el SDK de Maps una sola vez. Rechaza si el script no llega o la clave no es válida. */
export function cargarGoogleMaps(clave: string): Promise<void> {
  const w = window as unknown as VentanaConMaps;
  if (w.google?.maps?.importLibrary) return Promise.resolve();
  carga ??= new Promise<void>((resolver, rechazar) => {
    const callback = "__reto18GoogleMaps";
    w[callback] = () => resolver();
    w.gm_authFailure = () => rechazar(new Error("Google Maps rechazó la clave"));
    const script = document.createElement("script");
    const params = new URLSearchParams({ key: clave, v: "weekly", loading: "async", language: "es", region: "PE", callback });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      carga = undefined;
      rechazar(new Error("No se pudo cargar Google Maps"));
    };
    document.head.append(script);
  });
  return carga;
}
