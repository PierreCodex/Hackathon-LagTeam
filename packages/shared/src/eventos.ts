import { z } from "zod";

export const EstadoEventoSchema = z.enum(["pendiente", "aprobado", "rechazado"]);
export type EstadoEvento = z.infer<typeof EstadoEventoSchema>;
export const TipoSeccionSchema = z.enum(["numerada", "general"]);
export type TipoSeccion = z.infer<typeof TipoSeccionSchema>;
export const CategoriaEventoSchema = z.enum([
  "musica", "teatro", "danza", "artes_visuales", "cine", "literatura", "otro",
]);
export type CategoriaEvento = z.infer<typeof CategoriaEventoSchema>;

const texto = z.string().trim().min(1);
const enteroPositivo = z.number().int().positive().max(2147483647);
export const AsientoSchema = z.object({ id: z.uuid(), numero: enteroPositivo });
export const BloqueSchema = z.object({
  id: z.uuid(),
  orden: enteroPositivo,
  desplazamiento: z.number().int().min(0).max(2147483647),
  asientos: z.array(AsientoSchema),
});
export const FilaSchema = z.object({
  id: z.uuid(), nombre: texto, orden: enteroPositivo, bloques: z.array(BloqueSchema),
}).superRefine((fila, ctx) => {
  const numeros = new Set<number>();
  const ordenes = new Set<number>();
  fila.bloques.forEach((bloque, b) => {
    if (ordenes.has(bloque.orden)) ctx.addIssue({ code: "custom", message: "Orden de bloque repetido", path: ["bloques", b, "orden"] });
    ordenes.add(bloque.orden);
    bloque.asientos.forEach((asiento, a) => {
      if (numeros.has(asiento.numero)) ctx.addIssue({ code: "custom", message: "Número de asiento repetido en la fila", path: ["bloques", b, "asientos", a, "numero"] });
      numeros.add(asiento.numero);
    });
  });
});
const seccionBase = { id: z.uuid(), nombre: texto, orden: enteroPositivo };
export const SeccionSchema = z.discriminatedUnion("tipo", [
  z.object({ ...seccionBase, tipo: z.literal("numerada"), capacidad: z.null(), filas: z.array(FilaSchema) }),
  z.object({ ...seccionBase, tipo: z.literal("general"), capacidad: enteroPositivo, filas: z.array(FilaSchema).max(0) }),
]).superRefine((seccion, ctx) => {
  const nombres = new Set<string>();
  const ordenes = new Set<number>();
  seccion.filas.forEach((fila, i) => {
    if (nombres.has(fila.nombre) || ordenes.has(fila.orden)) ctx.addIssue({ code: "custom", message: "Nombre u orden de fila repetido", path: ["filas", i] });
    nombres.add(fila.nombre);
    ordenes.add(fila.orden);
  });
});

/** Mapa estructural de una sede (AD-4); no contiene precios ni estados de venta. */
export const MapaSedeSchema = z.object({
  id: z.uuid(), nombre: texto, direccion: texto, distrito: texto, secciones: z.array(SeccionSchema),
}).superRefine((mapa, ctx) => {
  const nombres = new Set<string>();
  const ordenes = new Set<number>();
  mapa.secciones.forEach((seccion, i) => {
    if (nombres.has(seccion.nombre) || ordenes.has(seccion.orden)) ctx.addIssue({ code: "custom", message: "Nombre u orden de sección repetido", path: ["secciones", i] });
    nombres.add(seccion.nombre);
    ordenes.add(seccion.orden);
  });
});
export type MapaSede = z.infer<typeof MapaSedeSchema>;

export const EventoSchema = z.object({
  id: z.uuid(), organizador_id: z.uuid(), sede_id: z.uuid(),
  titulo: texto, descripcion: texto, categoria: CategoriaEventoSchema, distrito: texto,
  inicio: z.iso.datetime({ offset: true }), estado: EstadoEventoSchema,
  motivo_rechazo: z.string().nullable(), destacado: z.boolean(), hay_musica: z.boolean(),
  constancia_apdayc_url: z.url().nullable(), foto_url: z.url().nullable(), aforo: enteroPositivo,
});
export type Evento = z.infer<typeof EventoSchema>;

/** Importes enteros en céntimos de PEN, con IGV incluido. */
export const CategoriaPrecioSchema = z.object({
  id: z.uuid(), evento_id: z.uuid(), sede_id: z.uuid(), nombre: texto, color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  precio_centimos: z.number().int().min(0).max(2147483647), seccion_id: z.uuid().nullable(),
});
export type CategoriaPrecio = z.infer<typeof CategoriaPrecioSchema>;
