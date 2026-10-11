import {
  CODIGOS_EVENTOS,
  LIMITES_MAPA,
  MapaSedeEntradaSchema,
  type ErrorApi,
  type MapaSede,
  type MapaSedeEntradaCruda,
} from "@reto18/shared";

/**
 * Lógica pura de la pizarra del mapa de la sede (historia 2.9): estado editable (secciones → filas →
 * bloques → asientos con ids locales), sus operaciones y la conversión a `MapaSedeEntradaCruda` que
 * espera la API. Sin React ni navegador. Mismo patrón que `apps/web/lib/alta-evento.ts`.
 */

/** Ancho fijo (no nulo) de un pasillo nuevo: ver `mapa-asientos.md`, "pasillos que separan bloques". */
export const ANCHO_PASILLO = 2;

/** Id local, solo para el `key` de React y para ubicar la operación dentro del estado. */
function nuevoId(): string {
  return crypto.randomUUID();
}

export type EstadoAsiento = { id: string };
export type EstadoBloque = { id: string; desplazamiento: number; asientos: EstadoAsiento[] };
export type EstadoFila = { id: string; nombre: string; bloques: EstadoBloque[] };
export type EstadoSeccion = { id: string; nombre: string; filas: EstadoFila[] };

/** Zona general conservada tal cual (2.10/futuro la edita); guarda su `id` real de la API. */
export type ZonaGeneralPizarra = { id: string; nombre: string; capacidad: number };

export type EstadoPizarra = {
  nombre: string;
  direccion: string;
  distrito: string;
  /** Secciones numeradas que edita esta pizarra. */
  secciones: EstadoSeccion[];
  /** Zonas generales existentes que esta historia no edita, solo conserva al guardar. */
  zonasGenerales: ZonaGeneralPizarra[];
};

/** Pizarra vacía, para crear una sede nueva. */
export function estadoInicialPizarra(): EstadoPizarra {
  return { nombre: "", direccion: "", distrito: "", secciones: [], zonasGenerales: [] };
}

function nuevaFila(): EstadoFila {
  return { id: nuevoId(), nombre: "", bloques: [{ id: nuevoId(), desplazamiento: 0, asientos: [] }] };
}

/** `MapaSede` (de `GET .../mapa`) → estado editable. Las zonas generales se copian tal cual. */
export function aMapaInicial(mapa: MapaSede): EstadoPizarra {
  const secciones: EstadoSeccion[] = [];
  const zonasGenerales: ZonaGeneralPizarra[] = [];
  for (const seccion of mapa.secciones) {
    if (seccion.tipo === "general") {
      zonasGenerales.push({ id: seccion.id, nombre: seccion.nombre, capacidad: seccion.capacidad });
      continue;
    }
    secciones.push({
      id: nuevoId(),
      nombre: seccion.nombre,
      filas: seccion.filas.map((fila) => ({
        id: nuevoId(),
        nombre: fila.nombre,
        bloques: fila.bloques.map((bloque) => ({
          id: nuevoId(),
          desplazamiento: bloque.desplazamiento,
          asientos: bloque.asientos.map(() => ({ id: nuevoId() })),
        })),
      })),
    });
  }
  return { nombre: mapa.nombre, direccion: mapa.direccion, distrito: mapa.distrito, secciones, zonasGenerales };
}

/**
 * Estado → `MapaSedeEntradaCruda`: renumera `orden` 1..n en secciones, filas y bloques, y el `numero`
 * de los asientos 1..n de forma continua a través de los pasillos de cada fila (`mapa-asientos.md`).
 * Las zonas generales se reincluyen al final, con su `id` real y `orden` continuando tras las numeradas.
 */
export function aMapaEntrada(estado: EstadoPizarra): MapaSedeEntradaCruda {
  const seccionesNumeradas = estado.secciones.map((seccion, i) => ({
    tipo: "numerada" as const,
    nombre: seccion.nombre,
    orden: i + 1,
    filas: seccion.filas.map((fila, j) => {
      let numero = 0;
      return {
        nombre: fila.nombre,
        orden: j + 1,
        bloques: fila.bloques.map((bloque, k) => ({
          orden: k + 1,
          desplazamiento: bloque.desplazamiento,
          asientos: bloque.asientos.map(() => {
            numero += 1;
            return { numero };
          }),
        })),
      };
    }),
  }));
  const base = estado.secciones.length;
  const zonasGenerales = estado.zonasGenerales.map((zona, i) => ({
    id: zona.id,
    tipo: "general" as const,
    nombre: zona.nombre,
    orden: base + i + 1,
    capacidad: zona.capacidad,
  }));
  return {
    nombre: estado.nombre,
    direccion: estado.direccion,
    distrito: estado.distrito,
    secciones: [...seccionesNumeradas, ...zonasGenerales],
  };
}

// ---------------------------------------------------------------------------
// Operaciones puras: un par agregar/quitar en cada uno de los cuatro niveles.
// ---------------------------------------------------------------------------

function mapSeccion(
  estado: EstadoPizarra,
  seccionId: string,
  fn: (seccion: EstadoSeccion) => EstadoSeccion,
): EstadoPizarra {
  return { ...estado, secciones: estado.secciones.map((s) => (s.id === seccionId ? fn(s) : s)) };
}

function mapFila(
  estado: EstadoPizarra,
  seccionId: string,
  filaId: string,
  fn: (fila: EstadoFila) => EstadoFila,
): EstadoPizarra {
  return mapSeccion(estado, seccionId, (seccion) => ({
    ...seccion,
    filas: seccion.filas.map((f) => (f.id === filaId ? fn(f) : f)),
  }));
}

function mapBloque(
  estado: EstadoPizarra,
  seccionId: string,
  filaId: string,
  bloqueId: string,
  fn: (bloque: EstadoBloque, fila: EstadoFila) => EstadoBloque,
): EstadoPizarra {
  return mapFila(estado, seccionId, filaId, (fila) => ({
    ...fila,
    bloques: fila.bloques.map((b) => (b.id === bloqueId ? fn(b, fila) : b)),
  }));
}

/** Agrega una sección numerada vacía, sin pasar el tope combinado (numeradas + zonas generales). */
export function crearSeccion(estado: EstadoPizarra): EstadoPizarra {
  if (estado.secciones.length + estado.zonasGenerales.length >= LIMITES_MAPA.secciones) return estado;
  const seccion: EstadoSeccion = { id: nuevoId(), nombre: "", filas: [] };
  return { ...estado, secciones: [...estado.secciones, seccion] };
}

export function quitarSeccion(estado: EstadoPizarra, seccionId: string): EstadoPizarra {
  return { ...estado, secciones: estado.secciones.filter((s) => s.id !== seccionId) };
}

/** Agrega una fila (con un bloque) a la sección, sin pasar `LIMITES_MAPA.filasPorSeccion`. */
export function crearFila(estado: EstadoPizarra, seccionId: string): EstadoPizarra {
  return mapSeccion(estado, seccionId, (seccion) => {
    if (seccion.filas.length >= LIMITES_MAPA.filasPorSeccion) return seccion;
    return { ...seccion, filas: [...seccion.filas, nuevaFila()] };
  });
}

/** No quita la última fila de la sección (para eso está "Quitar sección"). */
export function quitarFila(estado: EstadoPizarra, seccionId: string, filaId: string): EstadoPizarra {
  return mapSeccion(estado, seccionId, (seccion) => {
    if (seccion.filas.length <= 1) return seccion;
    return { ...seccion, filas: seccion.filas.filter((f) => f.id !== filaId) };
  });
}

/** "+ pasillo": agrega un bloque nuevo al final de la fila, con `ANCHO_PASILLO` de desplazamiento. */
export function agregarBloque(estado: EstadoPizarra, seccionId: string, filaId: string): EstadoPizarra {
  return mapFila(estado, seccionId, filaId, (fila) => {
    if (fila.bloques.length >= LIMITES_MAPA.asientosPorFila) return fila;
    const bloque: EstadoBloque = { id: nuevoId(), desplazamiento: ANCHO_PASILLO, asientos: [] };
    return { ...fila, bloques: [...fila.bloques, bloque] };
  });
}

/** "Quitar pasillo": no quita el último bloque de la fila (para eso está "Quitar fila"). */
export function quitarBloque(estado: EstadoPizarra, seccionId: string, filaId: string, bloqueId: string): EstadoPizarra {
  return mapFila(estado, seccionId, filaId, (fila) => {
    if (fila.bloques.length <= 1) return fila;
    return { ...fila, bloques: fila.bloques.filter((b) => b.id !== bloqueId) };
  });
}

/** Agrega un asiento al final del bloque, sin pasar `LIMITES_MAPA.asientosPorFila` en toda la fila. */
export function agregarAsiento(estado: EstadoPizarra, seccionId: string, filaId: string, bloqueId: string): EstadoPizarra {
  return mapBloque(estado, seccionId, filaId, bloqueId, (bloque, fila) => {
    const totalFila = fila.bloques.reduce((suma, b) => suma + b.asientos.length, 0);
    if (totalFila >= LIMITES_MAPA.asientosPorFila) return bloque;
    return { ...bloque, asientos: [...bloque.asientos, { id: nuevoId() }] };
  });
}

/** No quita el último asiento del bloque (para eso está "Quitar pasillo"). */
export function quitarAsiento(
  estado: EstadoPizarra,
  seccionId: string,
  filaId: string,
  bloqueId: string,
  asientoId: string,
): EstadoPizarra {
  return mapBloque(estado, seccionId, filaId, bloqueId, (bloque) => {
    if (bloque.asientos.length <= 1) return bloque;
    return { ...bloque, asientos: bloque.asientos.filter((a) => a.id !== asientoId) };
  });
}

// ---------------------------------------------------------------------------
// Numeración para pintar la pizarra: igual que `aMapaEntrada`, pero solo de lectura.
// ---------------------------------------------------------------------------

/** Número de cada asiento de la fila, por bloque, en el mismo orden continuo que `aMapaEntrada`. */
export function numerosDeFila(fila: EstadoFila): number[][] {
  let numero = 0;
  return fila.bloques.map((bloque) => bloque.asientos.map(() => (numero += 1)));
}

// ---------------------------------------------------------------------------
// Id del `Campo` que señala un error, por posición (no por id local).
// ---------------------------------------------------------------------------

export const idCampoSeccionNombre = (i: number): string => `seccion-${i}-nombre`;
export const idCampoFilaNombre = (i: number, j: number): string => `fila-${i}-${j}-nombre`;

const CAMPOS_RAIZ = new Set(["nombre", "direccion", "distrito"]);

/**
 * Ruta de un error (zod o de la API, ya partida en segmentos) → id del `Campo` que la señala, o `null`
 * si no hay ninguno (bloques/asientos, sin `Campo` propio, o un índice que cae en una zona general
 * conservada, que tampoco tiene `Campo`: `totalSeccionesNumeradas` es `estado.secciones.length`).
 */
export function campoDeRuta(path: readonly (string | number)[], totalSeccionesNumeradas: number): string | null {
  if (path.length === 0) return null;
  const raiz = path[0];
  if (typeof raiz === "string" && CAMPOS_RAIZ.has(raiz)) return raiz;
  if (raiz !== "secciones") return null;

  const i = Number(path[1]);
  if (!Number.isInteger(i) || i < 0 || i >= totalSeccionesNumeradas) return null;
  if (path.length === 2) return idCampoSeccionNombre(i);

  const campoSeccion = path[2];
  if (campoSeccion === "nombre" || campoSeccion === "orden") return idCampoSeccionNombre(i);
  if (campoSeccion !== "filas") return null;

  const j = Number(path[3]);
  if (!Number.isInteger(j) || j < 0) return null;
  if (path.length === 4) return idCampoFilaNombre(i, j);

  const campoFila = path[4];
  if (campoFila === "nombre" || campoFila === "orden") return idCampoFilaNombre(i, j);
  return null; // bloques/asientos: sin `Campo` propio.
}

/** Ruta de texto de la API (`"secciones.0.filas.2.nombre"`) → segmentos para `campoDeRuta`. */
function partesDeRuta(ruta: string): (string | number)[] {
  return ruta
    .split(".")
    .filter((parte) => parte.length > 0)
    .map((parte) => (/^\d+$/.test(parte) ? Number(parte) : parte));
}

/**
 * Mensaje de `DATOS_INVALIDOS` (`"<ruta>: <mensaje>; <ruta>: <mensaje>; ..."`, igual que
 * `validarConEsquema` de la API) → id del `Campo` señalado por el primer error, o `null`.
 */
export function campoDelError(error: ErrorApi, totalSeccionesNumeradas: number): string | null {
  if (error.codigo !== CODIGOS_EVENTOS.DATOS_INVALIDOS) return null;
  const primero = error.mensaje.split("; ")[0] ?? "";
  const separador = primero.indexOf(": ");
  if (separador < 0) return null;
  const ruta = primero.slice(0, separador).trim();
  if (!ruta) return null;
  return campoDeRuta(partesDeRuta(ruta), totalSeccionesNumeradas);
}

// ---------------------------------------------------------------------------
// Validación local (red de seguridad), igual que `validarAlta` de `alta-evento.ts`.
// ---------------------------------------------------------------------------

export type ValidacionPizarra =
  | { ok: true; datos: MapaSedeEntradaCruda }
  | { ok: false; campo: string | null; mensaje: string };

/** Convierte y valida con `MapaSedeEntradaSchema` antes de llamar a la API. */
export function validarMapa(estado: EstadoPizarra): ValidacionPizarra {
  const datos = aMapaEntrada(estado);
  const resultado = MapaSedeEntradaSchema.safeParse(datos);
  if (resultado.success) return { ok: true, datos };
  const problema = resultado.error.issues[0]!;
  const campo = campoDeRuta(problema.path as (string | number)[], estado.secciones.length);
  return { ok: false, campo, mensaje: problema.message };
}

// ---------------------------------------------------------------------------
// Qué hacer con el error de guardar (matriz I/O): campo señalado, duplicar o reintentar.
// ---------------------------------------------------------------------------

/** Mismo valor que `CODIGO_SIN_CONEXION` de `lib/api` (aquí sin importarlo, para que este archivo siga sin dependencias de red; igual que `alta-evento.ts`). */
const CODIGO_SIN_CONEXION_PIZARRA = "SIN_CONEXION";

export type ResultadoErrorGuardado =
  | { tipo: "duplicar" }
  | { tipo: "reintentar" }
  | { tipo: "campo"; campo: string }
  | { tipo: "generico" };

/**
 * Decide qué mostrar ante un error de guardar: sede ajena o mapa cerrado → ofrecer duplicar;
 * sin conexión → "Reintentar"; un campo señalado (local o de la API) → el aviso ahí; si no, genérico.
 */
export function estadoDeErrorGuardado(error: ErrorApi, totalSeccionesNumeradas: number): ResultadoErrorGuardado {
  if (error.codigo === CODIGOS_EVENTOS.SEDE_AJENA || error.codigo === CODIGOS_EVENTOS.MAPA_CERRADO) {
    return { tipo: "duplicar" };
  }
  if (error.codigo === CODIGO_SIN_CONEXION_PIZARRA) {
    return { tipo: "reintentar" };
  }
  const campo = campoDelError(error, totalSeccionesNumeradas);
  return campo ? { tipo: "campo", campo } : { tipo: "generico" };
}
