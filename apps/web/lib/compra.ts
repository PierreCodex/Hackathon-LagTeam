import { MAXIMO_ENTRADAS_POR_ORDEN, MetodoPagoSchema, type CategoriaPrecio, type MetodoPago } from "@reto18/shared";
import { soles } from "./pieza";

/**
 * Lógica pura del checkout de zona general (historia 8, Flow 2): opciones del formulario, el total
 * a mostrar y la validación local antes de llamar a la API. La API decide lo que de verdad cuenta
 * (p. ej. `CATEGORIA_NO_VALIDA` si la categoría elegida no es de zona general, AD-4): esto solo evita
 * envíos a todas luces incompletos, nunca filtra categorías localmente.
 */

export type OpcionCompra = { valor: string; etiqueta: string };

const NOMBRE_METODO: Record<MetodoPago, string> = {
  tarjeta: "Tarjeta",
  yape: "Yape",
  plin: "Plin",
};

/** Tarjeta, Yape, Plin (AD-6): el orden y los valores salen del esquema compartido. */
export const OPCIONES_METODO_PAGO: readonly OpcionCompra[] = MetodoPagoSchema.options.map((metodo) => ({
  valor: metodo,
  etiqueta: NOMBRE_METODO[metodo],
}));

/** "Entrada libre" a 0 céntimos; si no, "S/ 25" o "S/ 25.50". */
function etiquetaPrecio(centimos: number): string {
  return centimos === 0 ? "Entrada libre" : `S/ ${soles(centimos)}`;
}

/** Una opción por categoría de precio del evento, con su precio en la etiqueta. */
export function opcionesCategoria(categorias: readonly CategoriaPrecio[]): OpcionCompra[] {
  return categorias.map((categoria) => ({
    valor: categoria.id,
    etiqueta: `${categoria.nombre} · ${etiquetaPrecio(categoria.precio_centimos)}`,
  }));
}

/** 1 a `MAXIMO_ENTRADAS_POR_ORDEN` (AD-5): el máximo de entradas que admite una sola orden. */
export function opcionesCantidad(): OpcionCompra[] {
  return Array.from({ length: MAXIMO_ENTRADAS_POR_ORDEN }, (_valor, i) => {
    const cantidad = i + 1;
    return { valor: String(cantidad), etiqueta: `${cantidad} ${cantidad === 1 ? "entrada" : "entradas"}` };
  });
}

export function categoriaElegida(
  categorias: readonly CategoriaPrecio[],
  categoriaId: string,
): CategoriaPrecio | undefined {
  return categorias.find((categoria) => categoria.id === categoriaId);
}

/** Total a mostrar antes de comprar; `null` mientras no haya una categoría elegida de este evento. */
export function totalCompra(
  categorias: readonly CategoriaPrecio[],
  categoriaId: string,
  cantidad: number,
): string | null {
  const categoria = categoriaElegida(categorias, categoriaId);
  return categoria ? `S/ ${soles(categoria.precio_centimos * cantidad)}` : null;
}

export type ValidacionCompra = { ok: true } | { ok: false; mensaje: string };

/**
 * Validación local antes de llamar a `POST ventas/ordenes`: solo lo mínimo para no mandar un envío
 * a todas luces incompleto (sin categoría, o cantidad fuera de 1–`MAXIMO_ENTRADAS_POR_ORDEN`).
 * No repite las reglas de la API (cupo, venta cerrada, categoría no vendible): esas las decide ella.
 */
export function validarSeleccionCompra(categoriaId: string, cantidad: number): ValidacionCompra {
  if (!categoriaId) return { ok: false, mensaje: "Elige una categoría." };
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAXIMO_ENTRADAS_POR_ORDEN) {
    return { ok: false, mensaje: `Elige entre 1 y ${MAXIMO_ENTRADAS_POR_ORDEN} entradas.` };
  }
  return { ok: true };
}
