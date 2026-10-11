import { CODIGOS_EVENTOS, type CategoriaPrecio, type ErrorApi, type PrecioAsiento, type RangoPrecioEntrada } from "@reto18/shared";

/**
 * Lógica pura de la pizarra de precios (historia 2.10): el organizador selecciona un rango de asientos
 * dentro de una fila con dos clics (primero y último asiento) y le asigna una categoría del evento,
 * pintada con su color real. Identifica los asientos por `(sección, fila, número)`, igual que la API,
 * nunca por id local (Boundaries). Sin React ni navegador, igual que `pizarra-mapa.ts`.
 */

/** Gris neutro de un asiento sin categoría de precio. No es `--color-seat-held` (otro significado): hex directo. */
export const COLOR_SIN_CATEGORIA = "#52525B";

/**
 * Selección en progreso, a dos clics: "ninguna" al abrir o tras guardar; "primero" tras el primer clic;
 * "rango" tras el segundo clic en la misma fila (desde/hasta ya ordenados, con el menor primero).
 */
export type SeleccionRango =
  | { tipo: "ninguna" }
  | { tipo: "primero"; seccion: string; fila: string; numero: number }
  | { tipo: "rango"; seccion: string; fila: string; desde: number; hasta: number };

export const SELECCION_NINGUNA: SeleccionRango = { tipo: "ninguna" };

/**
 * Clic en un asiento: si ya había un primer clic en la misma fila, cierra el rango (el menor número
 * primero). Si no, o si el clic cae en otra fila (o sección), reinicia la selección a ese asiento:
 * cruzar de fila no cierra un rango a medias.
 */
export function seleccionarAsiento(
  seleccion: SeleccionRango,
  seccion: string,
  fila: string,
  numero: number,
): SeleccionRango {
  if (seleccion.tipo === "primero" && seleccion.seccion === seccion && seleccion.fila === fila) {
    return { tipo: "rango", seccion, fila, desde: Math.min(seleccion.numero, numero), hasta: Math.max(seleccion.numero, numero) };
  }
  return { tipo: "primero", seccion, fila, numero };
}

/** Categoría vigente de un asiento (`null` si ninguno de `asientos` lo cubre o no está en la lista). */
export function resolverCategoriaDeAsiento(
  asientos: readonly PrecioAsiento[],
  seccion: string,
  fila: string,
  numero: number,
): string | null {
  return asientos.find((a) => a.seccion === seccion && a.fila === fila && a.numero === numero)?.categoria_id ?? null;
}

/** Color real (hex) de una categoría del evento, o el gris neutro si no tiene o no se encuentra. */
export function colorDeCategoria(categoriaId: string | null, categorias: readonly CategoriaPrecio[]): string {
  if (!categoriaId) return COLOR_SIN_CATEGORIA;
  return categorias.find((c) => c.id === categoriaId)?.color ?? COLOR_SIN_CATEGORIA;
}

/** Selección cerrada ("rango") + la categoría elegida → el rango que espera `PUT .../precios`; `null` si la selección no está cerrada. */
export function aRangoEntrada(seleccion: SeleccionRango, categoriaId: string): RangoPrecioEntrada | null {
  if (seleccion.tipo !== "rango") return null;
  return { categoria_id: categoriaId, seccion: seleccion.seccion, fila: seleccion.fila, desde: seleccion.desde, hasta: seleccion.hasta };
}

/**
 * Pinta `rango` sobre `asientos` (estado local, para que la pizarra se vea actualizada antes de guardar):
 * cambia la categoría de los asientos de esa sección y fila dentro de `desde`–`hasta`; los demás quedan igual.
 */
export function pintarAsientos(asientos: readonly PrecioAsiento[], rango: RangoPrecioEntrada): PrecioAsiento[] {
  return asientos.map((a) =>
    a.seccion === rango.seccion && a.fila === rango.fila && a.numero >= rango.desde && a.numero <= rango.hasta
      ? { ...a, categoria_id: rango.categoria_id }
      : a,
  );
}

/**
 * Agrega `nuevo` a `rangos`, recortando (o quitando) los que se solapan con él en la misma sección y
 * fila: repintar un rango ya pintado en esta sesión no choca al guardar. Los de otra fila no cambian.
 */
export function agregarRango(rangos: readonly RangoPrecioEntrada[], nuevo: RangoPrecioEntrada): RangoPrecioEntrada[] {
  const resultado: RangoPrecioEntrada[] = [];
  for (const r of rangos) {
    const mismaFila = r.seccion === nuevo.seccion && r.fila === nuevo.fila;
    if (!mismaFila || r.hasta < nuevo.desde || r.desde > nuevo.hasta) {
      resultado.push(r);
      continue;
    }
    if (r.desde < nuevo.desde) resultado.push({ ...r, hasta: nuevo.desde - 1 });
    if (r.hasta > nuevo.hasta) resultado.push({ ...r, desde: nuevo.hasta + 1 });
  }
  resultado.push(nuevo);
  return resultado;
}

/** Mismo valor que `CODIGO_SIN_CONEXION` de `lib/api` (archivo sin dependencias de red, igual que `pizarra-mapa.ts`). */
const CODIGO_SIN_CONEXION_PRECIOS = "SIN_CONEXION";

export type ResultadoErrorGuardadoPrecios =
  | { tipo: "soloLectura" }
  | { tipo: "reintentar" }
  | { tipo: "generico" };

/**
 * Decide qué mostrar ante un error de guardar (matriz I/O): `EVENTO_PUBLICADO` (alguien publicó el
 * evento entretanto) → aviso del motivo y pasar a solo lectura; sin conexión → "Reintentar";
 * `RANGO_FUERA_DEL_MAPA`, `CATEGORIA_NO_VALIDA` o cualquier otro código → aviso genérico con el mensaje de la API.
 */
export function estadoDeErrorGuardadoPrecios(error: ErrorApi): ResultadoErrorGuardadoPrecios {
  if (error.codigo === CODIGOS_EVENTOS.EVENTO_PUBLICADO) return { tipo: "soloLectura" };
  if (error.codigo === CODIGO_SIN_CONEXION_PRECIOS) return { tipo: "reintentar" };
  return { tipo: "generico" };
}

/** Rangos que pintan toda una sección numerada con una categoría: uno por fila, del primer al último asiento. */
export function rangosDeSeccion(
  seccion: { nombre: string; filas: { nombre: string; bloques: { asientos: { numero: number }[] }[] }[] },
  categoriaId: string,
): RangoPrecioEntrada[] {
  return seccion.filas.flatMap((fila) => {
    const numeros = fila.bloques.flatMap((b) => b.asientos.map((a) => a.numero));
    if (numeros.length === 0) return [];
    return [{ categoria_id: categoriaId, seccion: seccion.nombre, fila: fila.nombre, desde: Math.min(...numeros), hasta: Math.max(...numeros) }];
  });
}
