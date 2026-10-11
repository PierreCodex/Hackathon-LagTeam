import type { Tablero } from "@reto18/shared";
import ExcelJS from "exceljs";

const soles = (centimos: number) => centimos / 100;
const FORMATO_SOLES = '"S/" #,##0.00';

/** Hoja con cabecera en negrita y formato de soles en las columnas indicadas (índice desde 0). */
function hoja(
  libro: ExcelJS.Workbook,
  nombre: string,
  columnas: string[],
  filas: (string | number)[][],
  columnasSoles: number[] = [],
): void {
  const h = libro.addWorksheet(nombre);
  h.addRow(columnas).font = { bold: true };
  for (const fila of filas) h.addRow(fila);
  columnas.forEach((titulo, i) => {
    const columna = h.getColumn(i + 1);
    columna.width = i === 0 ? 36 : Math.max(14, titulo.length + 4);
    if (columnasSoles.includes(i)) columna.numFmt = FORMATO_SOLES;
  });
}

/** Excel del tablero del administrador (CAP-13): resumen, eventos, categorías, distritos, días, público y liquidación. */
export async function tableroAExcel(t: Tablero): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Reto 18 · Piura Cultural";
  const r = t.resumen;
  hoja(libro, "Resumen", ["Indicador", "Valor"], [
    ["Ventas (S/)", soles(r.ventas_centimos)],
    ["Comisión de la plataforma (S/)", soles(r.comision_centimos)],
    ["Entradas vendidas", r.entradas],
    ["Asistentes (QR validados)", r.asistentes],
    ["Compradores", r.compradores],
    ["Eventos con ventas", r.eventos],
  ]);
  hoja(
    libro,
    "Eventos",
    ["Evento", "Categoría", "Distrito", "Fecha", "Aforo", "Entradas", "Asistentes", "Ventas"],
    t.eventos.map((e) => [
      e.titulo, e.categoria, e.distrito, e.inicio.slice(0, 10), e.aforo, e.entradas, e.asistentes, soles(e.importe_centimos),
    ]),
    [7],
  );
  const desglose = (filas: Tablero["por_dia"]) => filas.map((f) => [f.clave, f.entradas, soles(f.importe_centimos)]);
  hoja(libro, "Categorías", ["Categoría", "Entradas", "Ventas"], desglose(t.por_categoria), [2]);
  hoja(libro, "Distritos", ["Distrito", "Entradas", "Ventas"], desglose(t.por_distrito), [2]);
  hoja(libro, "Ventas por día", ["Día", "Entradas", "Ventas"], desglose(t.por_dia), [2]);
  hoja(libro, "Público", ["Ciudad", "Compradores"], t.publico_por_ciudad.map((p) => [p.ciudad, p.compradores]));
  hoja(
    libro,
    "Liquidación",
    ["Organizador", "Eventos", "Entradas", "Ventas brutas", "Comisión", "A pagar"],
    t.liquidacion.map((l) => [
      l.correo || l.organizador_id, l.eventos, l.entradas,
      soles(l.bruto_centimos), soles(l.comision_centimos), soles(l.neto_centimos),
    ]),
    [3, 4, 5],
  );
  return Buffer.from(await libro.xlsx.writeBuffer());
}
