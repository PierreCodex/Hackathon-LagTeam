import type { Enlace, FilaTablero, VentaEvento, VentaPieza, VentasOrganizador } from "@reto18/shared";
import type { EventoParaNegocio } from "../eventos/eventos.service.js";
import type { OrdenParaNegocio } from "../ventas/ventas.service.js";
import { comisionPorEvento } from "./calculos.js";

export type EventoConCategorias = EventoParaNegocio & { categorias: { id: string; nombre: string }[] };
export type EnlaceConClics = Enlace & { clics: number };

/** Datos que `NegocioService` reúne de los otros módulos (AD-2) para el panel del organizador. */
export interface DatosVentasOrganizador {
  eventos: EventoConCategorias[];
  ordenes: OrdenParaNegocio[];
  asistencia: Map<string, number>;
  enlaces: EnlaceConClics[];
}

const vacio = () => ({ ordenes: 0, entradas: 0, importe_centimos: 0 });

function sumarOrden(destino: { ordenes: number; entradas: number; importe_centimos: number }, o: OrdenParaNegocio): void {
  destino.ordenes += 1;
  destino.entradas += o.cantidad;
  destino.importe_centimos += o.total_centimos;
}

/**
 * Panel de ventas del organizador (CAP-11): por evento y categoría de precio, y por pieza a través del
 * `ref` de cada orden, que es el código del enlace (AD-8). Solo cuentan las órdenes de sus eventos.
 */
export function armarVentasOrganizador(datos: DatosVentasOrganizador): VentasOrganizador {
  const eventos = new Map(datos.eventos.map((e) => [e.id, e]));
  const ordenes = datos.ordenes.filter((o) => eventos.has(o.evento_id));

  const porEvento = new Map<string, VentaEvento>(
    datos.eventos.map((e) => [e.id, {
      evento_id: e.id, titulo: e.titulo, inicio: e.inicio, aforo: e.aforo,
      asistentes: datos.asistencia.get(e.id) ?? 0, ...vacio(), por_categoria: [],
    }]),
  );
  const categorias = new Map<string, Map<string, FilaTablero>>();
  for (const o of ordenes) {
    sumarOrden(porEvento.get(o.evento_id)!, o);
    const nombre = eventos.get(o.evento_id)!.categorias.find((c) => c.id === o.categoria_id)?.nombre ?? "Sin categoría";
    const delEvento = categorias.get(o.evento_id) ?? new Map<string, FilaTablero>();
    const fila = delEvento.get(nombre) ?? { clave: nombre, entradas: 0, importe_centimos: 0 };
    fila.entradas += o.cantidad;
    fila.importe_centimos += o.total_centimos;
    delEvento.set(nombre, fila);
    categorias.set(o.evento_id, delEvento);
  }
  for (const [id, filas] of categorias) {
    porEvento.get(id)!.por_categoria = [...filas.values()].sort((a, b) => b.importe_centimos - a.importe_centimos);
  }

  // Ventas por código de enlace; las que no tienen un código del organizador van a "sin enlace".
  const codigos = new Set(datos.enlaces.map((e) => e.codigo));
  const porCodigo = new Map<string, ReturnType<typeof vacio>>();
  const sinEnlace = vacio();
  for (const o of ordenes) {
    if (o.ref && codigos.has(o.ref)) {
      const v = porCodigo.get(o.ref) ?? vacio();
      sumarOrden(v, o);
      porCodigo.set(o.ref, v);
    } else {
      sumarOrden(sinEnlace, o);
    }
  }

  const piezas = new Map<string, VentaPieza>();
  for (const enlace of datos.enlaces) {
    if (!enlace.pieza_id || !eventos.has(enlace.evento_id)) continue;
    const ventas = porCodigo.get(enlace.codigo) ?? vacio();
    const pieza = piezas.get(enlace.pieza_id) ?? {
      pieza_id: enlace.pieza_id, evento_id: enlace.evento_id, titulo_evento: eventos.get(enlace.evento_id)!.titulo,
      clics: 0, ...vacio(), enlaces: [],
    };
    pieza.enlaces.push({ codigo: enlace.codigo, red: enlace.red, zona: enlace.zona, clics: enlace.clics, ...ventas });
    pieza.clics += enlace.clics;
    pieza.ordenes += ventas.ordenes;
    pieza.entradas += ventas.entradas;
    pieza.importe_centimos += ventas.importe_centimos;
    piezas.set(enlace.pieza_id, pieza);
  }

  const comision = [...comisionPorEvento(ordenes).values()].reduce((t, c) => t + c, 0);
  const total = vacio();
  for (const o of ordenes) sumarOrden(total, o);
  return {
    resumen: {
      ...total,
      clics: datos.enlaces.filter((e) => eventos.has(e.evento_id)).reduce((t, e) => t + e.clics, 0),
      comision_centimos: comision,
      neto_centimos: total.importe_centimos - comision,
    },
    eventos: [...porEvento.values()],
    piezas: [...piezas.values()].sort((a, b) => b.importe_centimos - a.importe_centimos || b.clics - a.clics),
    sin_enlace: sinEnlace,
  };
}
