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

// Reglas de unicidad del mapa, comunes al esquema de salida (`MapaSedeSchema`) y al de entrada.
type Contexto = z.RefinementCtx;
interface FilaConBloques { bloques: { orden: number; asientos: { numero: number }[] }[] }
function validarFila(fila: FilaConBloques, ctx: Contexto): void {
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
}
function validarFilasDeSeccion(filas: { nombre: string; orden: number }[], ctx: Contexto): void {
  const nombres = new Set<string>();
  const ordenes = new Set<number>();
  filas.forEach((fila, i) => {
    if (nombres.has(fila.nombre) || ordenes.has(fila.orden)) ctx.addIssue({ code: "custom", message: "Nombre u orden de fila repetido", path: ["filas", i] });
    nombres.add(fila.nombre);
    ordenes.add(fila.orden);
  });
}
function validarSecciones(secciones: { nombre: string; orden: number }[], ctx: Contexto): void {
  const nombres = new Set<string>();
  const ordenes = new Set<number>();
  secciones.forEach((seccion, i) => {
    if (nombres.has(seccion.nombre) || ordenes.has(seccion.orden)) ctx.addIssue({ code: "custom", message: "Nombre u orden de sección repetido", path: ["secciones", i] });
    nombres.add(seccion.nombre);
    ordenes.add(seccion.orden);
  });
}
export const AsientoSchema = z.object({ id: z.uuid(), numero: enteroPositivo });
export const BloqueSchema = z.object({
  id: z.uuid(),
  orden: enteroPositivo,
  desplazamiento: z.number().int().min(0).max(2147483647),
  asientos: z.array(AsientoSchema),
});
export const FilaSchema = z.object({
  id: z.uuid(), nombre: texto, orden: enteroPositivo, bloques: z.array(BloqueSchema),
}).superRefine(validarFila);
const seccionBase = { id: z.uuid(), nombre: texto, orden: enteroPositivo };
export const SeccionSchema = z.discriminatedUnion("tipo", [
  z.object({ ...seccionBase, tipo: z.literal("numerada"), capacidad: z.null(), filas: z.array(FilaSchema) }),
  z.object({ ...seccionBase, tipo: z.literal("general"), capacidad: enteroPositivo, filas: z.array(FilaSchema).max(0) }),
]).superRefine((seccion, ctx) => validarFilasDeSeccion(seccion.filas, ctx));

/** Mapa estructural de una sede (AD-4); no contiene precios ni estados de venta. */
export const MapaSedeSchema = z.object({
  id: z.uuid(), nombre: texto, direccion: texto, distrito: texto, secciones: z.array(SeccionSchema),
}).superRefine((mapa, ctx) => validarSecciones(mapa.secciones, ctx));
export type MapaSede = z.infer<typeof MapaSedeSchema>;

export const EventoSchema = z.object({
  id: z.uuid(), organizador_id: z.uuid(), sede_id: z.uuid(),
  titulo: texto, descripcion: texto, categoria: CategoriaEventoSchema, distrito: texto,
  inicio: z.iso.datetime({ offset: true }), estado: EstadoEventoSchema,
  motivo_rechazo: z.string().nullable(), destacado: z.boolean(), hay_musica: z.boolean(),
  constancia_apdayc_url: z.url().nullable(), foto_url: z.url().nullable(), aforo: enteroPositivo,
  /** Solo los eventos aprobados y publicados salen al público. Publicar cierra el mapa de la sede. */
  publicado: z.boolean(),
});
export type Evento = z.infer<typeof EventoSchema>;

/** Importes enteros en céntimos de PEN, con IGV incluido. */
export const CategoriaPrecioSchema = z.object({
  id: z.uuid(), evento_id: z.uuid(), sede_id: z.uuid(), nombre: texto, color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  precio_centimos: z.number().int().min(0).max(2147483647), seccion_id: z.uuid().nullable(),
});
export type CategoriaPrecio = z.infer<typeof CategoriaPrecioSchema>;

/** Tamaño máximo de la foto y de la constancia de APDAYC (5 MB). */
export const TAMANO_MAXIMO_ARCHIVO_EVENTO = 5 * 1024 * 1024;
/** Tipos que se aceptan para la foto del evento. */
export const TIPOS_FOTO_EVENTO = ["image/jpeg", "image/png", "image/webp"] as const;
/** Tipos que se aceptan para la constancia de APDAYC. */
export const TIPOS_CONSTANCIA_EVENTO = ["application/pdf", ...TIPOS_FOTO_EVENTO] as const;

const textoHasta = (maximo: number) => z.string().trim().min(1).max(maximo);

/** Sede del alta: una existente (`sede_id`) o una nueva de zona general (AD-4). */
export const SedeAltaSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("existente"), sede_id: z.uuid() }),
  z.object({
    tipo: z.literal("nueva"),
    nombre: textoHasta(150),
    direccion: textoHasta(200),
    distrito: textoHasta(100),
    capacidad: enteroPositivo,
  }),
]);
export type SedeAlta = z.infer<typeof SedeAltaSchema>;

/** Categoría de precio del alta. `color` es opcional: la API asigna uno de la paleta. */
export const CategoriaAltaSchema = z.object({
  nombre: textoHasta(60),
  precio_centimos: z.number().int().min(0).max(2147483647),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type CategoriaAlta = z.infer<typeof CategoriaAltaSchema>;

/**
 * Campo `datos` (JSON) de `POST /api/v1/eventos`, multipart junto a `foto` y `constancia`.
 * Precios en céntimos de PEN con IGV incluido (AD-10). El organizador sale del token.
 */
export const AltaEventoSchema = z.object({
  titulo: textoHasta(150),
  categoria: CategoriaEventoSchema,
  descripcion: z.string().trim().min(20).max(600),
  inicio: z.iso.datetime({ offset: true }).refine((v) => new Date(v).getTime() > Date.now(), {
    message: "La fecha de inicio debe ser futura",
  }),
  aforo: enteroPositivo,
  hay_musica: z.boolean(),
  sede: SedeAltaSchema,
  categorias: z.array(CategoriaAltaSchema).min(1).max(6).superRefine((categorias, ctx) => {
    const nombres = new Set<string>();
    categorias.forEach((categoria, i) => {
      const clave = categoria.nombre.toLocaleLowerCase("es");
      if (nombres.has(clave)) ctx.addIssue({ code: "custom", message: "Nombre de categoría repetido", path: [i, "nombre"] });
      nombres.add(clave);
    });
  }),
});
export type AltaEventoEntrada = z.input<typeof AltaEventoSchema>;
export type AltaEvento = z.output<typeof AltaEventoSchema>;

/**
 * Sede de `GET /api/v1/eventos/sedes`. `capacidad`: asientos numerados más zonas generales.
 * `propia`: "la puedes editar": la creó quien llama y su mapa sigue abierto (ningún evento publicado).
 * Si no, se puede duplicar, y usar en un alta solo si su mapa está cerrado.
 */
export const SedeResumenSchema = z.object({
  id: z.uuid(), nombre: texto, direccion: texto, distrito: texto, capacidad: z.number().int().min(0),
  propia: z.boolean(),
});
export type SedeResumen = z.infer<typeof SedeResumenSchema>;

/** Id de una sede o de un evento en la ruta (`:id`). */
export const IdSchema = z.uuid();

/** Límites del mapa de entrada, para que un mapa no tumbe la API. */
export const LIMITES_MAPA = {
  secciones: 20,
  filasPorSeccion: 100,
  asientosPorFila: 200,
  asientos: 5000,
  numeroAsiento: 9999,
  desplazamiento: 200,
} as const;

const ordenEntrada = z.number().int().positive().max(1000);
const AsientoEntradaSchema = z.object({ numero: z.number().int().positive().max(LIMITES_MAPA.numeroAsiento) });
const BloqueEntradaSchema = z.object({
  orden: ordenEntrada,
  desplazamiento: z.number().int().min(0).max(LIMITES_MAPA.desplazamiento),
  asientos: z.array(AsientoEntradaSchema).min(1).max(LIMITES_MAPA.asientosPorFila),
});
const FilaEntradaSchema = z.object({
  nombre: textoHasta(20), orden: ordenEntrada,
  bloques: z.array(BloqueEntradaSchema).min(1).max(LIMITES_MAPA.asientosPorFila),
}).superRefine((fila, ctx) => {
  validarFila(fila, ctx);
  const total = fila.bloques.reduce((suma, b) => suma + b.asientos.length, 0);
  if (total > LIMITES_MAPA.asientosPorFila) {
    ctx.addIssue({ code: "custom", message: `Una fila tiene como máximo ${LIMITES_MAPA.asientosPorFila} asientos`, path: ["bloques"] });
  }
});
const seccionEntradaBase = { nombre: textoHasta(60), orden: ordenEntrada };
const SeccionEntradaSchema = z.discriminatedUnion("tipo", [
  z.object({
    ...seccionEntradaBase, tipo: z.literal("numerada"), capacidad: z.null().optional(),
    filas: z.array(FilaEntradaSchema).min(1).max(LIMITES_MAPA.filasPorSeccion),
  }),
  z.object({
    ...seccionEntradaBase,
    /** Id de una zona general de esta sede que se conserva (y con ella sus categorías de precio). */
    id: z.uuid().optional(),
    tipo: z.literal("general"), capacidad: enteroPositivo,
    filas: z.array(z.unknown()).max(0, { message: "Una zona general no tiene filas" }).optional(),
  }),
]).superRefine((seccion, ctx) => {
  if (seccion.tipo === "numerada") validarFilasDeSeccion(seccion.filas, ctx);
});

/**
 * Cuerpo de `POST /api/v1/eventos/sedes` y `PUT /api/v1/eventos/sedes/:id/mapa`: el mapa entero, sin ids
 * (salvo el `id` opcional de las zonas generales que se conservan). Guardar reemplaza el mapa completo.
 */
export const MapaSedeEntradaSchema = z.object({
  nombre: textoHasta(150), direccion: textoHasta(200), distrito: textoHasta(100),
  secciones: z.array(SeccionEntradaSchema).min(1).max(LIMITES_MAPA.secciones),
}).superRefine((mapa, ctx) => {
  validarSecciones(mapa.secciones, ctx);
  const ids = new Set<string>();
  let asientos = 0;
  mapa.secciones.forEach((seccion, i) => {
    if (seccion.tipo === "general" && seccion.id) {
      if (ids.has(seccion.id)) ctx.addIssue({ code: "custom", message: "Id de zona general repetido", path: ["secciones", i, "id"] });
      ids.add(seccion.id);
    }
    if (seccion.tipo === "numerada") {
      for (const fila of seccion.filas) for (const bloque of fila.bloques) asientos += bloque.asientos.length;
    }
  });
  if (asientos > LIMITES_MAPA.asientos) {
    ctx.addIssue({ code: "custom", message: `Un mapa tiene como máximo ${LIMITES_MAPA.asientos} asientos (tiene ${asientos})`, path: ["secciones"] });
  }
});
export type MapaSedeEntradaCruda = z.input<typeof MapaSedeEntradaSchema>;
export type MapaSedeEntrada = z.output<typeof MapaSedeEntradaSchema>;

/** Cuerpo de `POST /api/v1/eventos/sedes/:id/duplicar`: el nombre de la copia. */
export const DuplicarSedeSchema = z.object({ nombre: textoHasta(150) });
export type DuplicarSede = z.infer<typeof DuplicarSedeSchema>;

/** Respuesta 201 de `POST /api/v1/eventos`. */
export const EventoCreadoSchema = z.object({
  evento: EventoSchema,
  categorias: z.array(CategoriaPrecioSchema),
});
export type EventoCreado = z.infer<typeof EventoCreadoSchema>;

/** Códigos de error del módulo `eventos`. */
export const CODIGOS_EVENTOS = {
  DATOS_INVALIDOS: "DATOS_INVALIDOS",
  ARCHIVO_NO_VALIDO: "ARCHIVO_NO_VALIDO",
  MUSICA_SIN_CONSTANCIA: "MUSICA_SIN_CONSTANCIA",
  SEDE_NO_EXISTE: "SEDE_NO_EXISTE",
  AFORO_SUPERA_SEDE: "AFORO_SUPERA_SEDE",
  STORAGE_NO_DISPONIBLE: "STORAGE_NO_DISPONIBLE",
  /** La sede es de otro organizador (o de la semilla): no se edita; en el alta, solo se usa si su mapa está cerrado. */
  SEDE_AJENA: "SEDE_AJENA",
  /** La sede tiene un evento publicado: su mapa ya no cambia; hay que duplicarla. */
  MAPA_CERRADO: "MAPA_CERRADO",
  /** El reemplazo quita una zona general con categorías de precio de algún evento. */
  SECCION_EN_USO: "SECCION_EN_USO",
  EVENTO_NO_EXISTE: "EVENTO_NO_EXISTE",
  EVENTO_AJENO: "EVENTO_AJENO",
  EVENTO_NO_APROBADO: "EVENTO_NO_APROBADO",
  /** Mismo valor que `CODIGO_BD_NO_DISPONIBLE`. */
  BD_NO_DISPONIBLE: "BD_NO_DISPONIBLE",
} as const;
export type CodigoEventos = (typeof CODIGOS_EVENTOS)[keyof typeof CODIGOS_EVENTOS];
