import {
  AltaEventoSchema,
  CategoriaEventoSchema,
  CODIGOS_EVENTOS,
  TAMANO_MAXIMO_ARCHIVO_EVENTO,
  TIPOS_CONSTANCIA_EVENTO,
  TIPOS_FOTO_EVENTO,
  type AltaEventoEntrada,
  type CategoriaEvento,
  type ErrorApi,
  type SedeResumen,
} from "@reto18/shared";
import { z } from "zod";

/**
 * Lógica pura del formulario de alta de evento (historia 1.9): estado, pasos, validación por campo
 * y armado del `AltaEventoEntrada` que se envía a `POST /api/v1/eventos`. Sin React ni navegador.
 */

export const PASOS_ALTA = ["datos", "sede", "entradas", "descripcion", "musica"] as const;
export type PasoAlta = (typeof PASOS_ALTA)[number];

export const TITULO_PASO: Record<PasoAlta, string> = {
  datos: "Datos del evento",
  sede: "Sede y aforo",
  entradas: "Entradas",
  descripcion: "Descripción",
  musica: "¿Habrá música?",
};

export const MAXIMO_CATEGORIAS = 6;

export const ETIQUETA_CATEGORIA: Record<CategoriaEvento, string> = {
  musica: "Música",
  teatro: "Teatro",
  danza: "Danza",
  artes_visuales: "Artes visuales",
  cine: "Cine",
  literatura: "Literatura",
  otro: "Otro",
};

export type CategoriaPrecioFormulario = { nombre: string; precio: string };

/** Archivo tal como lo ve la validación (un `File` del navegador lo cumple). */
export type ArchivoFormulario = { size: number; type: string; name?: string };

export type EstadoAlta = {
  titulo: string;
  categoria: CategoriaEvento | "";
  /** Valor de `<input type="datetime-local">`, en hora de Lima: `2026-10-24T20:00`. */
  fecha: string;
  foto: ArchivoFormulario | null;
  tipoSede: "existente" | "nueva";
  sedeId: string;
  sedeNombre: string;
  sedeDireccion: string;
  sedeDistrito: string;
  sedeCapacidad: string;
  aforo: string;
  categorias: CategoriaPrecioFormulario[];
  descripcion: string;
  hayMusica: boolean | null;
  constancia: ArchivoFormulario | null;
};

export function estadoInicialAlta(): EstadoAlta {
  return {
    titulo: "",
    categoria: "",
    fecha: "",
    foto: null,
    tipoSede: "existente",
    sedeId: "",
    sedeNombre: "",
    sedeDireccion: "",
    sedeDistrito: "",
    sedeCapacidad: "",
    aforo: "",
    categorias: [{ nombre: "General", precio: "" }],
    descripcion: "",
    hayMusica: null,
    constancia: null,
  };
}

/** Errores por campo; la clave es el `id` del campo en la página. */
export type ErroresAlta = Partial<Record<string, string>>;

export const MENSAJE_FALTA_CONSTANCIA = "Falta la constancia de APDAYC para publicar con música.";

const ETIQUETA_TIPO: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "application/pdf": "PDF",
};

function listaTipos(tipos: readonly string[]): string {
  const etiquetas = tipos.map((t) => ETIQUETA_TIPO[t] ?? t);
  return etiquetas.length > 1
    ? `${etiquetas.slice(0, -1).join(", ")} o ${etiquetas[etiquetas.length - 1]}`
    : (etiquetas[0] ?? "");
}

/**
 * Valida un archivo contra los tipos y el tamaño máximo de `@reto18/shared` (5 MB).
 * Devuelve el error para la persona o `null` si vale. Que falte el archivo lo decide quien llama.
 */
export function validarArchivo(archivo: ArchivoFormulario, tipos: readonly string[]): string | null {
  if (!tipos.includes(archivo.type)) {
    return `Ese archivo no sirve. Sube un ${listaTipos(tipos)}.`;
  }
  if (archivo.size > TAMANO_MAXIMO_ARCHIVO_EVENTO) {
    return "El archivo pasa de 5 MB. Sube uno más liviano.";
  }
  if (archivo.size === 0) {
    return "El archivo está vacío.";
  }
  return null;
}

const PRECIO_SOLES = /^(\d{1,7})(?:[.,](\d{1,2}))?$/;

/**
 * Precio escrito en soles (IGV incluido) → céntimos enteros (AD-10).
 * `"25"` → 2500, `"12.50"` o `"12,5"` → 1250. Negativos, más de 2 decimales o texto → `null`.
 */
export function solesACentimos(texto: string): number | null {
  const coincidencia = PRECIO_SOLES.exec(texto.trim());
  if (!coincidencia) return null;
  const soles = Number(coincidencia[1]);
  const centimos = Number((coincidencia[2] ?? "").padEnd(2, "0"));
  return soles * 100 + centimos;
}

const FECHA_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Fecha y hora de Lima (`datetime-local`) → ISO con zona: `2026-10-24T20:00` → `2026-10-24T20:00:00-05:00`. */
export function inicioLima(fecha: string): string | null {
  const c = FECHA_LOCAL.exec(fecha.trim());
  if (!c) return null;
  const [anio, mes, dia, hora, minuto, segundo = "00"] = c.slice(1) as string[];
  const fechaUtc = new Date(Date.UTC(+anio!, +mes! - 1, +dia!, +hora!, +minuto!, +segundo));
  // Rechaza fechas que no existen (31 de febrero) o fuera de rango.
  if (
    fechaUtc.getUTCFullYear() !== +anio! ||
    fechaUtc.getUTCMonth() !== +mes! - 1 ||
    fechaUtc.getUTCDate() !== +dia! ||
    +hora! > 23 ||
    +minuto! > 59 ||
    +segundo > 59
  ) {
    return null;
  }
  return `${anio}-${mes}-${dia}T${hora}:${minuto}:${segundo}-05:00`;
}

const ENTERO = /^\d{1,10}$/;
const MAXIMO_ENTERO = 2147483647;

/** Entero positivo escrito en un campo, o `null`. */
export function enteroPositivo(texto: string): number | null {
  const limpio = texto.trim();
  if (!ENTERO.test(limpio)) return null;
  const n = Number(limpio);
  return n > 0 && n <= MAXIMO_ENTERO ? n : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id del campo de nombre y de precio de cada categoría. */
export const idCategoriaNombre = (i: number) => `categoria-${i}-nombre`;
export const idCategoriaPrecio = (i: number) => `categoria-${i}-precio`;

/** Campos de cada paso en orden de lectura (el foco va al primero con error). */
export function camposDePaso(paso: PasoAlta, estado: EstadoAlta): string[] {
  switch (paso) {
    case "datos":
      return ["titulo", "categoria", "fecha", "foto"];
    case "sede":
      return estado.tipoSede === "existente"
        ? ["tipo-sede", "sede", "aforo"]
        : ["tipo-sede", "sede-nombre", "sede-direccion", "sede-distrito", "sede-capacidad", "aforo"];
    case "entradas":
      return [
        ...estado.categorias.flatMap((_, i) => [idCategoriaNombre(i), idCategoriaPrecio(i)]),
        "categorias",
      ];
    case "descripcion":
      return ["descripcion"];
    case "musica":
      return ["hay-musica", "constancia"];
  }
}

export type ContextoAlta = {
  /** Sedes de `GET /eventos/sedes`, para comprobar el aforo contra la capacidad. */
  sedes?: readonly SedeResumen[];
  /** Instante de referencia para "fecha futura" (pruebas). */
  ahora?: number;
};

function textoObligatorio(valor: string, maximo: number, falta: string, largo: string): string | undefined {
  const limpio = valor.trim();
  if (!limpio) return falta;
  if (limpio.length > maximo) return largo;
  return undefined;
}

/** Capacidad de la sede elegida (existente o nueva), si se conoce. */
export function capacidadSede(estado: EstadoAlta, sedes: readonly SedeResumen[] = []): number | null {
  if (estado.tipoSede === "nueva") return enteroPositivo(estado.sedeCapacidad);
  return sedes.find((s) => s.id === estado.sedeId)?.capacidad ?? null;
}

/** Valida un paso y devuelve un error por campo (vacío si el paso está bien). */
export function validarPaso(paso: PasoAlta, estado: EstadoAlta, contexto: ContextoAlta = {}): ErroresAlta {
  const errores: ErroresAlta = {};
  const poner = (campo: string, error: string | null | undefined) => {
    if (error && !errores[campo]) errores[campo] = error;
  };

  switch (paso) {
    case "datos": {
      poner(
        "titulo",
        textoObligatorio(estado.titulo, 150, "Escribe el título del evento.", "El título puede tener hasta 150 caracteres."),
      );
      if (!CategoriaEventoSchema.safeParse(estado.categoria).success) {
        poner("categoria", "Elige el tipo de evento.");
      }
      if (!estado.fecha.trim()) {
        poner("fecha", "Elige la fecha y la hora del evento.");
      } else {
        const inicio = inicioLima(estado.fecha);
        const ahora = contexto.ahora ?? Date.now();
        if (!inicio) poner("fecha", "Esa fecha no es válida.");
        else if (new Date(inicio).getTime() <= ahora) poner("fecha", "La fecha tiene que ser futura.");
      }
      if (!estado.foto) poner("foto", "Sube una foto del evento.");
      else poner("foto", validarArchivo(estado.foto, TIPOS_FOTO_EVENTO));
      break;
    }
    case "sede": {
      if (estado.tipoSede === "existente") {
        // Con la lista cargada, la sede tiene que estar en ella (un borrador puede traer una que ya no se ve).
        const enLista = !contexto.sedes || contexto.sedes.some((s) => s.id === estado.sedeId);
        if (!UUID.test(estado.sedeId) || !enLista) poner("sede", "Elige una sede de la lista o crea una nueva.");
      } else {
        poner(
          "sede-nombre",
          textoObligatorio(estado.sedeNombre, 150, "Escribe el nombre de la sede.", "El nombre puede tener hasta 150 caracteres."),
        );
        poner(
          "sede-direccion",
          textoObligatorio(estado.sedeDireccion, 200, "Escribe la dirección.", "La dirección puede tener hasta 200 caracteres."),
        );
        poner(
          "sede-distrito",
          textoObligatorio(estado.sedeDistrito, 100, "Escribe el distrito.", "El distrito puede tener hasta 100 caracteres."),
        );
        if (enteroPositivo(estado.sedeCapacidad) === null) {
          poner("sede-capacidad", "Escribe cuántas personas caben, en número entero.");
        }
      }
      const aforo = enteroPositivo(estado.aforo);
      if (aforo === null) {
        poner("aforo", "Escribe el aforo del evento, en número entero.");
      } else {
        const capacidad = capacidadSede(estado, contexto.sedes);
        if (capacidad !== null && aforo > capacidad) {
          poner("aforo", `El aforo no puede pasar de ${capacidad}, la capacidad de la sede.`);
        }
      }
      break;
    }
    case "entradas": {
      if (estado.categorias.length < 1) poner("categorias", "Agrega al menos una categoría de precio.");
      if (estado.categorias.length > MAXIMO_CATEGORIAS) {
        poner("categorias", `Puedes tener hasta ${MAXIMO_CATEGORIAS} categorías de precio.`);
      }
      const nombres = new Set<string>();
      estado.categorias.forEach((categoria, i) => {
        const nombre = categoria.nombre.trim();
        poner(
          idCategoriaNombre(i),
          textoObligatorio(nombre, 60, "Escribe el nombre de la categoría.", "El nombre puede tener hasta 60 caracteres."),
        );
        const clave = nombre.toLocaleLowerCase("es");
        if (nombre && nombres.has(clave)) poner(idCategoriaNombre(i), "Ya tienes una categoría con ese nombre.");
        nombres.add(clave);
        if (!categoria.precio.trim()) poner(idCategoriaPrecio(i), "Escribe el precio en soles.");
        else if (solesACentimos(categoria.precio) === null) {
          poner(idCategoriaPrecio(i), "Escribe el precio en soles, por ejemplo 25 o 12.50.");
        }
      });
      break;
    }
    case "descripcion": {
      const largo = estado.descripcion.trim().length;
      if (largo < 20) poner("descripcion", `Escribe al menos 20 caracteres (llevas ${largo}).`);
      else if (largo > 600) poner("descripcion", `La descripción puede tener hasta 600 caracteres (llevas ${largo}).`);
      break;
    }
    case "musica": {
      if (estado.hayMusica === null) poner("hay-musica", "Responde si habrá música.");
      if (estado.hayMusica) {
        if (!estado.constancia) poner("constancia", MENSAJE_FALTA_CONSTANCIA);
        else poner("constancia", validarArchivo(estado.constancia, TIPOS_CONSTANCIA_EVENTO));
      }
      break;
    }
  }
  return errores;
}

/** Primer campo con error del paso, en orden de lectura. */
export function primerCampoConError(paso: PasoAlta, estado: EstadoAlta, errores: ErroresAlta): string | undefined {
  return camposDePaso(paso, estado).find((campo) => errores[campo]);
}

/**
 * Estado → `AltaEventoEntrada` (campo `datos` del multipart). Precios en céntimos con IGV incluido;
 * `inicio` con la zona de Lima. Si hay música se manda `true`; la constancia va aparte, como archivo.
 */
export function construirAlta(estado: EstadoAlta): AltaEventoEntrada {
  return {
    titulo: estado.titulo.trim(),
    categoria: estado.categoria as CategoriaEvento,
    descripcion: estado.descripcion.trim(),
    inicio: inicioLima(estado.fecha) ?? estado.fecha,
    aforo: enteroPositivo(estado.aforo) ?? Number.NaN,
    hay_musica: estado.hayMusica === true,
    sede:
      estado.tipoSede === "existente"
        ? { tipo: "existente", sede_id: estado.sedeId }
        : {
            tipo: "nueva",
            nombre: estado.sedeNombre.trim(),
            direccion: estado.sedeDireccion.trim(),
            distrito: estado.sedeDistrito.trim(),
            capacidad: enteroPositivo(estado.sedeCapacidad) ?? Number.NaN,
          },
    categorias: estado.categorias.map((c) => ({
      nombre: c.nombre.trim(),
      precio_centimos: solesACentimos(c.precio) ?? Number.NaN,
    })),
  };
}

/** Paso al que pertenece la primera parte de una ruta de `AltaEventoSchema` o de un mensaje de la API. */
const PASO_DE_CAMPO_API: Record<string, PasoAlta> = {
  titulo: "datos",
  categoria: "datos",
  inicio: "datos",
  foto: "datos",
  sede: "sede",
  aforo: "sede",
  categorias: "entradas",
  descripcion: "descripcion",
  hay_musica: "musica",
  constancia: "musica",
};

export type ValidacionAlta =
  | { ok: true; datos: AltaEventoEntrada }
  | { ok: false; paso: PasoAlta; errores: ErroresAlta };

/**
 * Valida todos los pasos y, al final, el alta completa con `AltaEventoSchema` (el mismo DTO que la API).
 * Devuelve el primer paso con errores.
 */
export function validarAlta(estado: EstadoAlta, contexto: ContextoAlta = {}): ValidacionAlta {
  for (const paso of PASOS_ALTA) {
    const errores = validarPaso(paso, estado, contexto);
    if (Object.keys(errores).length > 0) return { ok: false, paso, errores };
  }
  const datos = construirAlta(estado);
  const resultado = AltaEventoSchema.safeParse(datos);
  if (resultado.success) return { ok: true, datos };
  // Red de seguridad: algo que el esquema rechaza y la validación por paso no vio.
  const problema = resultado.error.issues[0]!;
  const raiz = String(problema.path[0] ?? "titulo");
  const paso = PASO_DE_CAMPO_API[raiz] ?? "datos";
  const campo = camposDePaso(paso, estado)[0]!;
  return { ok: false, paso, errores: { [campo]: problema.message } };
}

/**
 * Paso al que vuelve el formulario según el error de la API, o `null` si se queda donde está
 * (sin conexión, Storage o BD caídos). `AFORO_SUPERA_SEDE` y `SEDE_NO_EXISTE` → sede.
 */
export function pasoDeErrorApi(error: ErrorApi): PasoAlta | null {
  switch (error.codigo) {
    case CODIGOS_EVENTOS.AFORO_SUPERA_SEDE:
    case CODIGOS_EVENTOS.SEDE_NO_EXISTE:
      return "sede";
    case CODIGOS_EVENTOS.MUSICA_SIN_CONSTANCIA:
      return "musica";
    case CODIGOS_EVENTOS.ARCHIVO_NO_VALIDO: {
      // La API no siempre nombra el archivo ("El archivo pasa de 5 MB"): si no se sabe cuál, no se cambia de paso.
      const mensaje = error.mensaje.toLocaleLowerCase("es");
      if (mensaje.includes("constancia")) return "musica";
      if (mensaje.includes("foto")) return "datos";
      return null;
    }
    case CODIGOS_EVENTOS.DATOS_INVALIDOS: {
      // La API nombra el campo al inicio: "aforo: …", "categorias.0.nombre: …".
      const raiz = /^\s*([a-z_]+)/.exec(error.mensaje)?.[1];
      return (raiz && PASO_DE_CAMPO_API[raiz]) || "datos";
    }
    default:
      return null;
  }
}

/**
 * Un envío que se cortó por tiempo (o con la respuesta a medias) pudo crear el evento en la API:
 * reintentarlo lo duplicaría. Sin conexión desde el principio (se cortó mucho antes del límite), sí se puede reintentar.
 */
export function envioIncierto(error: ErrorApi, msTranscurridos: number, limiteMs: number): boolean {
  return error.codigo === CODIGO_SIN_CONEXION_API && msTranscurridos >= limiteMs * 0.9;
}

/** Mismo valor que `CODIGO_SIN_CONEXION` de `lib/api` (aquí sin importarlo, para que este archivo siga sin dependencias de red). */
const CODIGO_SIN_CONEXION_API = "SIN_CONEXION";

export const MENSAJE_ENVIO_INCIERTO =
  "El envío tardó demasiado y no sabemos si tu evento llegó. Espera unos minutos antes de volver a enviarlo, para no crearlo dos veces.";

// ---------------------------------------------------------------------------
// Borrador en localStorage: solo los campos de texto (los archivos no se guardan).
// ---------------------------------------------------------------------------

export const CLAVE_BORRADOR_ALTA = "reto18:borrador-alta-evento";

const texto = z.string().max(2000).catch("");
const BorradorSchema = z.object({
  paso: z.enum(PASOS_ALTA).catch("datos"),
  titulo: texto,
  categoria: z.union([CategoriaEventoSchema, z.literal("")]).catch(""),
  fecha: texto,
  tipoSede: z.enum(["existente", "nueva"]).catch("existente"),
  sedeId: texto,
  sedeNombre: texto,
  sedeDireccion: texto,
  sedeDistrito: texto,
  sedeCapacidad: texto,
  aforo: texto,
  categorias: z
    .array(z.object({ nombre: texto, precio: texto }))
    .min(1)
    .max(MAXIMO_CATEGORIAS)
    .catch([{ nombre: "General", precio: "" }]),
  descripcion: texto,
  hayMusica: z.boolean().nullable().catch(null),
});

/** Estado → texto del borrador (sin la foto ni la constancia). */
export function serializarBorrador(estado: EstadoAlta, paso: PasoAlta): string {
  // Sin los archivos: no se pueden guardar en localStorage.
  const { foto: _foto, constancia: _constancia, ...textos } = estado;
  void _foto;
  void _constancia;
  return JSON.stringify({ paso, ...textos });
}

/** Texto del borrador → estado y paso. Un borrador roto o ausente da el estado inicial. */
export function leerBorrador(crudo: string | null): { estado: EstadoAlta; paso: PasoAlta } {
  const inicial = estadoInicialAlta();
  if (!crudo) return { estado: inicial, paso: "datos" };
  let json: unknown;
  try {
    json = JSON.parse(crudo);
  } catch {
    return { estado: inicial, paso: "datos" };
  }
  const resultado = BorradorSchema.safeParse(json);
  if (!resultado.success) return { estado: inicial, paso: "datos" };
  const { paso, ...textos } = resultado.data;
  return { estado: { ...inicial, ...textos }, paso };
}
