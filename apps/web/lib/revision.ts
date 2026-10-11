import {
  CODIGOS_EVENTOS,
  RechazoEventoSchema,
  type ConstanciaEvento,
  type ErrorApi,
  type EstadoEvento,
  type EventoRevision,
} from "@reto18/shared";

/**
 * Revisión de eventos (1.10): funciones puras de la pantalla Aprobar del administrador
 * y de Mis eventos del organizador. Las fechas se pintan con `fechaPieza` (`lib/pieza.ts`).
 */

/** Largo máximo del motivo de rechazo (igual que `RechazoEventoSchema`). */
export const MAXIMO_MOTIVO = 600;

export const MENSAJE_MOTIVO_VACIO = "Escribe el motivo del rechazo. El organizador lo verá en Mis eventos.";

export function mensajeMotivoLargo(largo: number): string {
  return `El motivo puede tener hasta ${MAXIMO_MOTIVO} caracteres (ahora tiene ${largo}).`;
}

export type ResultadoMotivo = { ok: true; motivo: string } | { ok: false; error: string };

/** Motivo recortado de 1–600 caracteres, con el mismo contrato que la API; si no, el mensaje para el campo. */
export function validarMotivo(texto: string): ResultadoMotivo {
  const recortado = texto.trim();
  const resultado = RechazoEventoSchema.safeParse({ motivo_rechazo: texto });
  if (resultado.success) return { ok: true, motivo: resultado.data.motivo_rechazo };
  return { ok: false, error: recortado === "" ? MENSAJE_MOTIVO_VACIO : mensajeMotivoLargo(recortado.length) };
}

/** Estado con símbolo y texto, nunca solo color (DESIGN.md). */
export const ESTADO_EVENTO: Record<EstadoEvento, { simbolo: string; texto: string; color: string }> = {
  aprobado: { simbolo: "✓", texto: "Aprobado", color: "text-state-success" },
  pendiente: { simbolo: "…", texto: "Pendiente de aprobación", color: "text-state-warning" },
  rechazado: { simbolo: "✕", texto: "Rechazado", color: "text-state-error" },
};

/**
 * Texto del estado en Mis eventos. Un aprobado sin publicar dice qué le falta (el botón de `accionButacas`
 * lleva a la pizarra); uno ya publicado (los de la semilla) lo dice.
 */
export function textoEstadoOrganizador(evento: Pick<EventoRevision, "estado" | "publicado">): string {
  const base = ESTADO_EVENTO[evento.estado].texto;
  if (evento.estado !== "aprobado") return base;
  return evento.publicado ? `${base} · Publicado` : `${base} · Falta armar el mapa y publicar`;
}

/**
 * Botón de la tarjeta en Mis eventos hacia la pizarra de la sede del evento. Pendiente o aprobado sin
 * publicar: "Armar butacas" (el mapa aún se puede editar). Publicado: "Ver butacas" (el mapa está cerrado).
 * Rechazado: sin botón.
 */
export function accionButacas(
  evento: Pick<EventoRevision, "estado" | "publicado" | "sede_id">,
): { texto: string; href: string } | null {
  if (evento.estado === "rechazado") return null;
  const href = `/organizador/sedes/${evento.sede_id}/mapa`;
  return { texto: evento.publicado ? "Ver butacas" : "Armar butacas", href };
}

/** Quita de la lista el evento que otra sesión ya decidió. */
export function quitarDecidido<T extends { id: string }>(lista: readonly T[], id: string): T[] {
  return lista.filter((evento) => evento.id !== id);
}

/** Acciones de la pantalla Aprobar. */
export type AccionRevision = "constancia" | "aprobar" | "rechazar" | "destacar";

/** Aviso de "otro administrador ya lo decidió": el evento sale de la lista. */
export type AvisoDecidido = { titulo: string; mensaje: string };

/** Lo mínimo de una tarjeta que necesita `aplicarErrorAccion`. */
export type TarjetaConError = { id: string; accion: AccionRevision | null; error: ErrorApi | null };

/**
 * Error de una acción sobre una tarjeta. Un 409 `ESTADO_EVENTO_INCOMPATIBLE` al aprobar o rechazar
 * significa que otra sesión ya lo decidió: la tarjeta sale y hay aviso. Cualquier otro error (o un 409
 * al destacar) se queda en la tarjeta, sin acción en curso.
 */
export function aplicarErrorAccion<T extends TarjetaConError>(
  tarjetas: readonly T[],
  evento: Pick<EventoRevision, "id" | "titulo">,
  accion: AccionRevision,
  error: ErrorApi,
): { tarjetas: T[]; decidido: AvisoDecidido | null } {
  if (error.codigo === CODIGOS_EVENTOS.ESTADO_EVENTO_INCOMPATIBLE && (accion === "aprobar" || accion === "rechazar")) {
    return {
      tarjetas: quitarDecidido(tarjetas, evento.id),
      decidido: { titulo: `Otro administrador ya decidió "${evento.titulo}".`, mensaje: error.mensaje },
    };
  }
  return {
    tarjetas: tarjetas.map((t) => (t.id === evento.id ? { ...t, accion: null, error } : t)),
    decidido: null,
  };
}

/** Pestaña abierta al pulsar "Ver constancia" (un `Window` en el navegador). */
export type PestanaConstancia = { opener: unknown; location: { href: string }; close: () => void };

/**
 * Qué hacer con la respuesta de "Ver constancia". `constancia` es `null` si la llamada falló (el error ya
 * se pinta aparte). URL firmada → se abre en la pestaña ya abierta (o en una nueva, sin `opener`) y no se
 * guarda; `url: null` → se cierra la pestaña y la tarjeta dice "Sin constancia"; fallo → se cierra.
 */
export function abrirConstancia(
  constancia: ConstanciaEvento | null,
  pestana: PestanaConstancia | null,
  abrirNueva: (url: string) => void,
): "abierta" | "sin-constancia" | "fallo" {
  if (!constancia) {
    pestana?.close();
    return "fallo";
  }
  if (constancia.url === null) {
    pestana?.close();
    return "sin-constancia";
  }
  if (pestana) {
    pestana.opener = null;
    pestana.location.href = constancia.url;
  } else {
    abrirNueva(constancia.url);
  }
  return "abierta";
}
