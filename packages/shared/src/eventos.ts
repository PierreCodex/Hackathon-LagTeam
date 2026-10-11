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

const fechaDia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD");
const mesCalendario = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Usa el formato AAAA-MM");
const enteroQuery = z.preprocess((v) => v === "" ? undefined : v, z.coerce.number().int().min(0).max(2147483647));

/** Filtros del catálogo público; los precios son céntimos de PEN. */
export const CatalogoPublicoQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  desde: fechaDia.optional(), hasta: fechaDia.optional(),
  categoria: CategoriaEventoSchema.optional(),
  distrito: z.string().trim().min(1).max(100).optional(),
  precio_minimo_centimos: enteroQuery.optional(), precio_maximo_centimos: enteroQuery.optional(),
}).superRefine((filtros, ctx) => {
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    ctx.addIssue({ code: "custom", path: ["hasta"], message: "hasta debe ser igual o posterior a desde" });
  }
  if (filtros.precio_minimo_centimos !== undefined && filtros.precio_maximo_centimos !== undefined &&
      filtros.precio_minimo_centimos > filtros.precio_maximo_centimos) {
    ctx.addIssue({ code: "custom", path: ["precio_maximo_centimos"], message: "El precio máximo debe ser igual o mayor al mínimo" });
  }
});
export type CatalogoPublicoQuery = z.infer<typeof CatalogoPublicoQuerySchema>;
export const MesCatalogoSchema = z.object({ mes: mesCalendario });
export type MesCatalogo = z.infer<typeof MesCatalogoSchema>;


/** Contratos de revisión administrativa; el contrato del alta permanece compatible. */
export const EventoIdSchema = z.uuid();
export const RechazoEventoSchema = z.object({ motivo_rechazo: z.string().trim().min(1).max(600) });
export type RechazoEvento = z.infer<typeof RechazoEventoSchema>;
export const DestacadoEventoSchema = z.object({ destacado: z.boolean() });
export type DestacadoEvento = z.infer<typeof DestacadoEventoSchema>;
export const EventoRevisionSchema = EventoSchema.extend({ alerta_apdayc: z.string().nullable() });
export type EventoRevision = z.infer<typeof EventoRevisionSchema>;
export const ListaEventosRevisionSchema = z.array(EventoRevisionSchema);
export const ConstanciaEventoSchema = z.object({ url: z.url().nullable() });
export type ConstanciaEvento = z.infer<typeof ConstanciaEventoSchema>;

/** Importes enteros en céntimos de PEN, con IGV incluido. */
export const CategoriaPrecioSchema = z.object({
  id: z.uuid(), evento_id: z.uuid(), sede_id: z.uuid(), nombre: texto, color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  precio_centimos: z.number().int().min(0).max(2147483647), seccion_id: z.uuid().nullable(),
});
export type CategoriaPrecio = z.infer<typeof CategoriaPrecioSchema>;

export const SedePublicaSchema = z.object({ id: z.uuid(), nombre: texto, direccion: texto, distrito: texto });
export type SedePublica = z.infer<typeof SedePublicaSchema>;
export const EventoPublicoSchema = z.object({
  id: z.uuid(), titulo: texto, descripcion: texto, categoria: CategoriaEventoSchema, distrito: texto,
  inicio: z.iso.datetime({ offset: true }), destacado: z.boolean(), foto_url: z.url().nullable(),
  aforo: enteroPositivo, precio_minimo_centimos: z.number().int().min(0).nullable(),
  sede: SedePublicaSchema, categorias: z.array(CategoriaPrecioSchema),
});
export type EventoPublico = z.infer<typeof EventoPublicoSchema>;
export const ListaEventosPublicosSchema = z.array(EventoPublicoSchema);

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

/** Máximo de rangos de precio por evento. */
export const MAXIMO_RANGOS_PRECIO = 2000;

const numeroAsiento = z.number().int().positive().max(LIMITES_MAPA.numeroAsiento);

/**
 * Rango de precio: los asientos `desde`–`hasta` (ambos incluidos) de una fila de una sección numerada tienen
 * la categoría `categoria_id`. Se nombran la sección y la fila (no sus ids): el rango sobrevive a un reemplazo
 * del mapa. Puede haber huecos de numeración dentro del rango.
 */
export const RangoPrecioEntradaSchema = z.object({
  categoria_id: z.uuid(),
  seccion: textoHasta(60),
  fila: textoHasta(20),
  desde: numeroAsiento,
  hasta: numeroAsiento,
}).superRefine((rango, ctx) => {
  if (rango.desde > rango.hasta) ctx.addIssue({ code: "custom", message: "hasta debe ser igual o mayor que desde", path: ["hasta"] });
});
export type RangoPrecioEntrada = z.infer<typeof RangoPrecioEntradaSchema>;

/** Cuerpo de `PUT /api/v1/eventos/:id/precios`: la lista entera de rangos; guardar la reemplaza. */
export const PreciosEntradaSchema = z.object({
  rangos: z.array(RangoPrecioEntradaSchema).max(MAXIMO_RANGOS_PRECIO),
}).superRefine((precios, ctx) => {
  const porFila = new Map<string, { desde: number; hasta: number; i: number }[]>();
  precios.rangos.forEach((rango, i) => {
    const clave = JSON.stringify([rango.seccion, rango.fila]);
    const lista = porFila.get(clave) ?? [];
    lista.push({ desde: rango.desde, hasta: rango.hasta, i });
    porFila.set(clave, lista);
  });
  for (const lista of porFila.values()) {
    lista.sort((a, b) => a.desde - b.desde || a.i - b.i);
    // `alcance`: el rango ya visto que llega más lejos; cualquier solape lo es con él.
    let alcance = lista[0]!;
    for (const actual of lista.slice(1)) {
      if (actual.desde <= alcance.hasta) {
        const [primero, segundo] = alcance.i < actual.i ? [alcance, actual] : [actual, alcance];
        ctx.addIssue({ code: "custom", message: `Se solapa con el rango ${primero.i} de la misma fila`, path: ["rangos", segundo.i] });
      }
      if (actual.hasta > alcance.hasta) alcance = actual;
    }
  }
});
export type PreciosEntrada = z.infer<typeof PreciosEntradaSchema>;

/** Rango guardado (respuesta). */
export const RangoPrecioSchema = z.object({
  id: z.uuid(), categoria_id: z.uuid(), seccion: texto, fila: texto, desde: enteroPositivo, hasta: enteroPositivo,
});
export type RangoPrecio = z.infer<typeof RangoPrecioSchema>;

/** Asiento numerado del mapa vigente con la categoría que le da su rango (`null` si ninguno lo cubre). */
export const PrecioAsientoSchema = z.object({
  asiento_id: z.uuid(), seccion: texto, fila: texto, numero: enteroPositivo, categoria_id: z.uuid().nullable(),
});
export type PrecioAsiento = z.infer<typeof PrecioAsientoSchema>;

/**
 * Respuesta de `GET` y `PUT /api/v1/eventos/:id/precios`: los rangos, cada asiento con su categoría
 * resuelta y las categorías del evento (nombre/color/precio), para elegir y pintar en la pizarra de precios.
 */
export const PreciosEventoSchema = z.object({
  rangos: z.array(RangoPrecioSchema),
  asientos: z.array(PrecioAsientoSchema),
  categorias: z.array(CategoriaPrecioSchema),
});
export type PreciosEvento = z.infer<typeof PreciosEventoSchema>;

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
  EVENTO_NO_EXISTE: "EVENTO_NO_EXISTE",
  ESTADO_EVENTO_INCOMPATIBLE: "ESTADO_EVENTO_INCOMPATIBLE",
  AFORO_SUPERA_SEDE: "AFORO_SUPERA_SEDE",
  STORAGE_NO_DISPONIBLE: "STORAGE_NO_DISPONIBLE",
  /** La sede es de otro organizador (o de la semilla): no se edita; en el alta, solo se usa si su mapa está cerrado. */
  SEDE_AJENA: "SEDE_AJENA",
  /** La sede tiene un evento publicado: su mapa ya no cambia; hay que duplicarla. */
  MAPA_CERRADO: "MAPA_CERRADO",
  /** El reemplazo quita una zona general con categorías de precio de algún evento. */
  SECCION_EN_USO: "SECCION_EN_USO",
  EVENTO_AJENO: "EVENTO_AJENO",
  EVENTO_NO_APROBADO: "EVENTO_NO_APROBADO",
  /** El evento ya está publicado: sus rangos de precio no cambian (`ventas` los copió al inventario). */
  EVENTO_PUBLICADO: "EVENTO_PUBLICADO",
  /** Un rango nombra una sección numerada o una fila que no está en el mapa vigente de la sede. */
  RANGO_FUERA_DEL_MAPA: "RANGO_FUERA_DEL_MAPA",
  /** La categoría no es del evento, no existe o es de una zona general. */
  CATEGORIA_NO_VALIDA: "CATEGORIA_NO_VALIDA",
  /** Al publicar, algún asiento numerado de la sede no tiene categoría de precio. */
  ASIENTOS_SIN_PRECIO: "ASIENTOS_SIN_PRECIO",
  /** Mismo valor que `CODIGO_BD_NO_DISPONIBLE`. */
  BD_NO_DISPONIBLE: "BD_NO_DISPONIBLE",
} as const;
export type CodigoEventos = (typeof CODIGOS_EVENTOS)[keyof typeof CODIGOS_EVENTOS];
