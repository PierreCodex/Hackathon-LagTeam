import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  type AltaEvento,
  AltaEventoSchema,
  type CategoriaPrecio,
  CODIGOS_EVENTOS,
  type CategoriaEvento,
  type EstadoEvento,
  type Evento,
  type EventoCreado,
  type SedeResumen,
} from "@reto18/shared";
import { SUPABASE_CLIENTE, type ClienteSupabase } from "../supabase/supabase.module.js";
import {
  type ArchivoEntrada,
  ArchivosEventos,
  type ArchivoSubido,
  archivoNoValido,
  validarArchivo,
} from "./archivos-eventos.js";

/** Tiempo límite de las llamadas a la BD del módulo. */
export const TIEMPO_LIMITE_BD_MS = 10_000;

export const COLUMNAS_EVENTO =
  "id, organizador_id, sede_id, titulo, descripcion, categoria, distrito, inicio, estado, motivo_rechazo, " +
  "destacado, hay_musica, constancia_apdayc_url, foto_url, aforo";
export const COLUMNAS_CATEGORIA = "id, evento_id, sede_id, nombre, color, precio_centimos, seccion_id";

/** Colores que se asignan, en orden, a las categorías que llegan sin color. */
export const PALETA_CATEGORIAS = ["#D97706", "#2563EB", "#7C3AED", "#059669", "#DC2626", "#0891B2"] as const;

/** Archivos del multipart de `POST /eventos`, por campo. */
export interface ArchivosAlta {
  foto?: ArchivoEntrada[];
  constancia?: ArchivoEntrada[];
}

/** Lo que `marketing` necesita de un evento para su pieza (AD-2: lo lee solo por aquí). */
export interface EventoParaPieza {
  id: string;
  organizador_id: string;
  estado: EstadoEvento;
  titulo: string;
  descripcion: string;
  categoria: CategoriaEvento;
  inicio: string;
  distrito: string;
  foto_url: string | null;
  sede: { nombre: string; direccion: string };
  /** Mínimo de sus categorías de pago, en céntimos (AD-10); `0` si todas son gratis; `null` si no tiene ninguna. */
  precio_minimo_centimos: number | null;
}

const COLUMNAS_PIEZA =
  "id, organizador_id, estado, titulo, descripcion, categoria, inicio, distrito, foto_url, " +
  "sede:eventos_sedes(nombre, direccion), categorias:eventos_categorias_precio(precio_centimos)";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ErrorBd {
  code?: string;
  message: string;
  details?: string | null;
}

/** Servicio del módulo `eventos`. Es la única puerta a las tablas `eventos_*` (AD-2). */
@Injectable()
export class EventosService {
  private readonly logger = new Logger(EventosService.name);

  constructor(
    @Inject(SUPABASE_CLIENTE) private readonly supabase: ClienteSupabase,
    @Inject(ArchivosEventos) private readonly archivos: ArchivosEventos,
  ) {}

  /**
   * Alta de un evento `pendiente`. Valida todo antes de subir nada; sube la foto (y la constancia
   * si hay música) y crea sede, evento y categorías en una sola transacción (RPC). Si la RPC falla,
   * borra lo subido.
   */
  async crear(organizadorId: string, datosCrudos: unknown, archivosAlta: ArchivosAlta = {}): Promise<EventoCreado> {
    const datos = parsearDatos(datosCrudos);
    const foto = archivosAlta.foto?.[0];
    const constancia = datos.hay_musica ? archivosAlta.constancia?.[0] : undefined;
    if (datos.hay_musica && !constancia) {
      throw new BadRequestException({
        codigo: CODIGOS_EVENTOS.MUSICA_SIN_CONSTANCIA,
        mensaje: "constancia: un evento con música necesita la constancia de APDAYC",
      });
    }
    if (!foto) throw archivoNoValido("foto: falta la foto del evento");
    const tipoFoto = validarArchivo(foto, "foto");
    const tipoConstancia = constancia ? validarArchivo(constancia, "constancia") : undefined;
    const supabase = this.cliente();

    const subidos: ArchivoSubido[] = [];
    let eventoId: string;
    try {
      const fotoSubida = await this.archivos.subirFoto(organizadorId, foto, tipoFoto);
      subidos.push(fotoSubida);
      let constanciaSubida: ArchivoSubido | undefined;
      if (constancia && tipoConstancia) {
        constanciaSubida = await this.archivos.subirConstancia(organizadorId, constancia, tipoConstancia);
        subidos.push(constanciaSubida);
      }

      const { data, error, status } = await supabase
        .rpc("eventos_crear_evento", {
          datos: {
            organizador_id: organizadorId,
            titulo: datos.titulo,
            descripcion: datos.descripcion,
            categoria: datos.categoria,
            inicio: datos.inicio,
            aforo: datos.aforo,
            hay_musica: datos.hay_musica,
            foto_url: fotoSubida.url,
            constancia_apdayc_url: constanciaSubida?.url ?? null,
            sede: datos.sede,
            categorias: conColores(datos.categorias),
          },
        })
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
      if (error || typeof data !== "string") {
        throw this.errorDeAlta(error as ErrorBd | null, status, subidos);
      }
      eventoId = data;
    } catch (e) {
      if (!(e instanceof ResultadoIncierto)) await this.archivos.borrar(subidos);
      throw e instanceof ResultadoIncierto ? e.excepcion : e;
    }

    return this.leerCreado(eventoId, datos);
  }

  /** Sedes compartidas con su distrito y su capacidad (el máximo del aforo en el formulario). */
  async listarSedes(): Promise<SedeResumen[]> {
    const { data, error } = await this.cliente()
      .rpc("eventos_listar_sedes")
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (error) {
      this.logger.warn(`No se pudieron listar las sedes: ${error.message}`);
      throw bdNoDisponible("No se pudieron leer las sedes. Inténtalo de nuevo.");
    }
    return ((data ?? []) as SedeResumen[]).map((s) => ({
      id: s.id,
      nombre: s.nombre,
      direccion: s.direccion,
      distrito: s.distrito,
      capacidad: Number(s.capacidad),
    }));
  }

  /**
   * Evento con su sede (nombre y dirección) y el precio mínimo de sus categorías, para la pieza de
   * marketing. `null` si no existe (o el id no es un UUID). No filtra por dueño ni estado: lo decide quien llama.
   */
  async datosParaPieza(eventoId: string): Promise<EventoParaPieza | null> {
    if (!UUID.test(eventoId)) return null;
    const { data, error } = await this.cliente()
      .from("eventos_eventos")
      .select(COLUMNAS_PIEZA)
      .eq("id", eventoId)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
      .maybeSingle();
    if (error) {
      this.logger.warn(`No se pudo leer el evento ${eventoId}: ${error.message}`);
      throw bdNoDisponible("No se pudo leer el evento. Inténtalo de nuevo.");
    }
    if (!data) return null;
    const fila = data as unknown as Omit<EventoParaPieza, "sede" | "precio_minimo_centimos"> & {
      sede: EventoParaPieza["sede"] | EventoParaPieza["sede"][] | null;
      categorias: { precio_centimos: number }[] | null;
    };
    const sede = Array.isArray(fila.sede) ? fila.sede[0] : fila.sede;
    const precios = (fila.categorias ?? []).map((c) => Number(c.precio_centimos));
    return {
      id: fila.id,
      organizador_id: fila.organizador_id,
      estado: fila.estado,
      titulo: fila.titulo,
      descripcion: fila.descripcion,
      categoria: fila.categoria,
      inicio: fila.inicio,
      distrito: fila.distrito,
      foto_url: fila.foto_url,
      sede: { nombre: sede?.nombre ?? "", direccion: sede?.direccion ?? "" },
      precio_minimo_centimos: precioMinimo(precios),
    };
  }

  private async leerCreado(id: string, datos: AltaEvento): Promise<EventoCreado> {
    const supabase = this.cliente();
    const senal = () => AbortSignal.timeout(TIEMPO_LIMITE_BD_MS);
    const [evento, categorias] = await Promise.all([
      supabase.from("eventos_eventos").select(COLUMNAS_EVENTO).eq("id", id).abortSignal(senal()).single(),
      supabase.from("eventos_categorias_precio").select(COLUMNAS_CATEGORIA).eq("evento_id", id).abortSignal(senal()),
    ]);
    if (evento.error || categorias.error || !evento.data) {
      // El evento ya existe: no se borra nada; el organizador lo verá en su lista.
      this.logger.warn(`Evento ${id} creado, pero no se pudo leer: ${(evento.error ?? categorias.error)?.message}`);
      throw bdNoDisponible("El evento se creó, pero no se pudo leer. Recarga tus eventos.");
    }
    const orden = new Map(datos.categorias.map((c, i) => [c.nombre, i]));
    const lista = [...((categorias.data ?? []) as unknown as CategoriaPrecio[])].sort(
      (a, b) => (orden.get(a.nombre) ?? 0) - (orden.get(b.nombre) ?? 0),
    );
    return { evento: evento.data as unknown as Evento, categorias: lista };
  }

  private errorDeAlta(error: ErrorBd | null, status: number, subidos: ArchivoSubido[]): Error {
    if (error?.code === "P0001" && error.message === CODIGOS_EVENTOS.SEDE_NO_EXISTE) {
      return new NotFoundException({ codigo: CODIGOS_EVENTOS.SEDE_NO_EXISTE, mensaje: "sede: la sede no existe" });
    }
    if (error?.code === "P0001" && error.message === CODIGOS_EVENTOS.AFORO_SUPERA_SEDE) {
      return new BadRequestException({
        codigo: CODIGOS_EVENTOS.AFORO_SUPERA_SEDE,
        mensaje: `aforo: ${error.details ?? "supera la capacidad de la sede"}`,
      });
    }
    if (status === 0) {
      // postgrest-js da `status` 0 solo si no hubo respuesta (tiempo límite o red). No se sabe si el
      // alta se confirmó, así que no se borran los archivos (un evento sin foto sería peor que un huérfano).
      this.logger.error(
        `Resultado incierto del alta (${error?.message ?? "sin id"}); se conservan ${subidos
          .map((s) => `${s.bucket}/${s.ruta}`)
          .join(", ")}`,
      );
      return new ResultadoIncierto(bdNoDisponible("No se pudo confirmar el alta. Revisa tus eventos antes de repetirla."));
    }
    this.logger.error(`La BD rechazó el alta (${status} ${error?.code ?? ""}): ${error?.message ?? "sin id"}`);
    return new InternalServerErrorException({ codigo: "ERROR_INTERNO", mensaje: "No se pudo crear el evento" });
  }

  private cliente(): NonNullable<ClienteSupabase> {
    if (!this.supabase) throw bdNoDisponible("Supabase no está configurado en la API");
    return this.supabase;
  }
}

/**
 * Colores de las categorías: respeta los explícitos y a cada una sin color le da el primer color
 * de la paleta que aún no se usa en el alta (si se agotan, repite por orden).
 */
export function conColores(categorias: AltaEvento["categorias"]): { nombre: string; precio_centimos: number; color: string }[] {
  const usados = new Set(categorias.flatMap((c) => (c.color ? [c.color.toUpperCase()] : [])));
  return categorias.map((c, i) => {
    let color = c.color;
    if (!color) {
      color = PALETA_CATEGORIAS.find((p) => !usados.has(p)) ?? PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length];
      usados.add(color);
    }
    return { nombre: c.nombre, precio_centimos: c.precio_centimos, color };
  });
}

/**
 * Precio "desde" de la pieza: el mínimo de las categorías de pago (> 0); `0` solo si todas valen 0
 * (gratuito); `null` sin categorías. Una cortesía a 0 no convierte un evento de pago en «Entrada libre».
 */
export function precioMinimo(precios: number[]): number | null {
  if (!precios.length) return null;
  const dePago = precios.filter((p) => p > 0);
  return dePago.length ? Math.min(...dePago) : 0;
}

/** Error cuyo resultado en la BD se desconoce: no se deben borrar los archivos. */
class ResultadoIncierto extends Error {
  constructor(readonly excepcion: Error) {
    super(excepcion.message);
  }
}

function bdNoDisponible(mensaje: string): ServiceUnavailableException {
  return new ServiceUnavailableException({ codigo: CODIGOS_EVENTOS.BD_NO_DISPONIBLE, mensaje });
}

/** `datos` llega como texto JSON en el multipart; se valida con el contrato compartido. */
export function parsearDatos(crudo: unknown): AltaEvento {
  let valor: unknown = crudo;
  if (typeof crudo === "string") {
    try {
      valor = JSON.parse(crudo);
    } catch {
      throw datosInvalidos("datos: no es un JSON válido");
    }
  } else if (crudo === undefined) {
    throw datosInvalidos("datos: falta el campo con los datos del evento (JSON)");
  }
  const resultado = AltaEventoSchema.safeParse(valor);
  if (!resultado.success) {
    throw datosInvalidos(
      resultado.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "datos"}: ${i.message}`).join("; "),
    );
  }
  return resultado.data;
}

function datosInvalidos(mensaje: string): BadRequestException {
  return new BadRequestException({ codigo: CODIGOS_EVENTOS.DATOS_INVALIDOS, mensaje });
}
