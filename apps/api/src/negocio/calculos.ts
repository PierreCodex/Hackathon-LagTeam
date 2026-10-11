import type { Comision, EventoTablero, FilaTablero, Liquidacion, Tablero } from "@reto18/shared";
import type { EventoParaNegocio } from "../eventos/eventos.service.js";
import type { OrdenParaNegocio } from "../ventas/ventas.service.js";

/** Datos que `NegocioService` reúne de los otros módulos (AD-2) para armar el tablero. */
export interface DatosTablero {
  comision: Comision;
  ordenes: OrdenParaNegocio[];
  eventos: EventoParaNegocio[];
  asistencia: Map<string, number>;
  ciudades: Map<string, string | null>;
  correos: Map<string, string>;
}

/** Día de Lima (UTC−5, sin horario de verano) de un instante ISO: `2026-10-11`. */
export function diaDeLima(instante: string): string {
  return new Date(new Date(instante).getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Comisión de cada evento con la regla de AD-10: suma lo congelado en cada orden y, si la primera
 * orden pagada del evento congeló `tarifa_evento`, descuenta esa tarifa una sola vez.
 * `ordenes` llega ordenado por `pagada_en`.
 */
export function comisionPorEvento(ordenes: OrdenParaNegocio[]): Map<string, number> {
  const comision = new Map<string, number>();
  for (const o of ordenes) {
    const previa = comision.get(o.evento_id);
    const tarifa = previa === undefined && o.comision_modelo === "tarifa_evento" ? o.comision_valor : 0;
    comision.set(o.evento_id, (previa ?? 0) + o.comision_importe + tarifa);
  }
  return comision;
}

function sumar(mapa: Map<string, FilaTablero>, clave: string, entradas: number, importe: number): void {
  const fila = mapa.get(clave) ?? { clave, entradas: 0, importe_centimos: 0 };
  fila.entradas += entradas;
  fila.importe_centimos += importe;
  mapa.set(clave, fila);
}

const porImporte = (a: FilaTablero, b: FilaTablero) => b.importe_centimos - a.importe_centimos || b.entradas - a.entradas;

type LiquidacionEnCurso = Liquidacion & { ids: Set<string> };

/** Tablero del administrador y liquidación por organizador (CAP-12, CAP-13). */
export function armarTablero(datos: DatosTablero): Tablero {
  const eventos = new Map(datos.eventos.map((e) => [e.id, e]));
  const ordenes = datos.ordenes.filter((o) => eventos.has(o.evento_id));
  const comisiones = comisionPorEvento(ordenes);

  const porEvento = new Map<string, EventoTablero>();
  const porCategoria = new Map<string, FilaTablero>();
  const porDistrito = new Map<string, FilaTablero>();
  const porDia = new Map<string, FilaTablero>();
  for (const o of ordenes) {
    const e = eventos.get(o.evento_id)!;
    const fila = porEvento.get(e.id) ?? {
      evento_id: e.id, titulo: e.titulo, categoria: e.categoria, distrito: e.distrito, inicio: e.inicio,
      aforo: e.aforo, entradas: 0, asistentes: datos.asistencia.get(e.id) ?? 0, importe_centimos: 0,
    };
    fila.entradas += o.cantidad;
    fila.importe_centimos += o.total_centimos;
    porEvento.set(e.id, fila);
    sumar(porCategoria, e.categoria, o.cantidad, o.total_centimos);
    sumar(porDistrito, e.distrito, o.cantidad, o.total_centimos);
    sumar(porDia, diaDeLima(o.pagada_en), o.cantidad, o.total_centimos);
  }

  const liquidaciones = new Map<string, LiquidacionEnCurso>();
  for (const fila of porEvento.values()) {
    const organizador = eventos.get(fila.evento_id)!.organizador_id;
    const l: LiquidacionEnCurso = liquidaciones.get(organizador) ?? {
      organizador_id: organizador, correo: datos.correos.get(organizador) ?? "", eventos: 0, entradas: 0,
      bruto_centimos: 0, comision_centimos: 0, neto_centimos: 0, ids: new Set<string>(),
    };
    l.ids.add(fila.evento_id);
    l.eventos = l.ids.size;
    l.entradas += fila.entradas;
    l.bruto_centimos += fila.importe_centimos;
    l.comision_centimos += comisiones.get(fila.evento_id) ?? 0;
    l.neto_centimos = l.bruto_centimos - l.comision_centimos;
    liquidaciones.set(organizador, l);
  }

  const compradores = new Set(ordenes.map((o) => o.usuario_id));
  const ciudades = new Map<string, number>();
  for (const id of compradores) {
    const ciudad = datos.ciudades.get(id)?.trim() || "Sin indicar";
    ciudades.set(ciudad, (ciudades.get(ciudad) ?? 0) + 1);
  }

  const filasEventos = [...porEvento.values()].sort((a, b) => b.importe_centimos - a.importe_centimos);
  return {
    comision: datos.comision,
    resumen: {
      ventas_centimos: ordenes.reduce((t, o) => t + o.total_centimos, 0),
      comision_centimos: [...comisiones.values()].reduce((t, c) => t + c, 0),
      entradas: ordenes.reduce((t, o) => t + o.cantidad, 0),
      asistentes: filasEventos.reduce((t, e) => t + e.asistentes, 0),
      compradores: compradores.size,
      eventos: filasEventos.length,
    },
    por_categoria: [...porCategoria.values()].sort(porImporte),
    por_distrito: [...porDistrito.values()].sort(porImporte),
    por_dia: [...porDia.values()].sort((a, b) => a.clave.localeCompare(b.clave)),
    publico_por_ciudad: [...ciudades]
      .map(([ciudad, n]) => ({ ciudad, compradores: n }))
      .sort((a, b) => b.compradores - a.compradores),
    eventos: filasEventos,
    liquidacion: [...liquidaciones.values()]
      .map((l) => ({
        organizador_id: l.organizador_id, correo: l.correo, eventos: l.eventos, entradas: l.entradas,
        bruto_centimos: l.bruto_centimos, comision_centimos: l.comision_centimos, neto_centimos: l.neto_centimos,
      }))
      .sort((a, b) => b.bruto_centimos - a.bruto_centimos),
  };
}
