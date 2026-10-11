import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
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
  type EventoRevision,
  type ConstanciaEvento,
  type EventoPublico,
  type CatalogoPublicoQuery,
  type MapaSede,
  type MapaSedeEntrada,
  MapaSedeSchema,
  type PreciosEntrada,
  type PreciosEvento,
  PreciosEventoSchema,
  type SedeResumen,
} from "@reto18/shared";
import type { UsuarioAutenticado } from "../identidad/roles.js";
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
  "destacado, hay_musica, constancia_apdayc_url, foto_url, aforo, publicado";
export const COLUMNAS_CATEGORIA = "id, evento_id, sede_id, nombre, color, precio_centimos, seccion_id";
export const COLUMNAS_REVISION = `${COLUMNAS_EVENTO}, alerta_apdayc`;

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

/**
 * Lo que `ventas` necesita de un evento para vender y validar entradas (AD-2: lo lee solo por aquí).
 * `capacidad_zona`: capacidad de la zona general de la categoría; `null` si la categoría no tiene zona general.
 */
export interface EventoParaNegocio {
  id: string;
  organizador_id: string;
  titulo: string;
  categoria: CategoriaEvento;
  distrito: string;
  inicio: string;
  aforo: number;
}

export interface EventoParaVenta {
  id: string;
  organizador_id: string;
  estado: EstadoEvento;
  publicado: boolean;
  inicio: string;
  aforo: number;
  titulo: string;
  sede: { nombre: string; direccion: string };
  categorias: {
    id: string;
    nombre: string;
    precio_centimos: number;
    seccion_id: string | null;
    capacidad_zona: number | null;
  }[];
}

const COLUMNAS_VENTA =
  "id, organizador_id, estado, publicado, inicio, aforo, titulo, sede:eventos_sedes(nombre, direccion), " +
  "categorias:eventos_categorias_precio(id, nombre, precio_centimos, seccion_id, seccion:eventos_secciones(tipo, capacidad))";

const COLUMNAS_PUBLICO =
  "id, titulo, descripcion, categoria, distrito, inicio, destacado, foto_url, aforo, " +
  "sede:eventos_sedes(id, nombre, direccion, distrito), categorias:eventos_categorias_precio(id, evento_id, sede_id, nombre, color, precio_centimos, seccion_id)";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ErrorBd {
  code?: string;
  message: string;
  details?: string | null;
}

interface EventoPublicoFila {
  id: string; titulo: string; descripcion: string; categoria: CategoriaEvento; distrito: string;
  inicio: string; destacado: boolean; foto_url: string | null; aforo: number;
  sede: { id: string; nombre: string; direccion: string; distrito: string } | { id: string; nombre: string; direccion: string; distrito: string }[] | null;
  categorias: CategoriaPrecio[] | null;
}

/** Servicio del módulo `eventos`. Es la única puerta a las tablas `eventos_*` (AD-2). */
@Injectable()
export class EventosService {
  private readonly logger = new Logger(EventosService.name);

  constructor(
    @Inject(SUPABASE_CLIENTE) private readonly supabase: ClienteSupabase,
    @Inject(ArchivosEventos) private readonly archivos: ArchivosEventos,
  ) {}

  listarPendientes(): Promise<EventoRevision[]> {
    return this.listarRevision("estado", "pendiente");
  }

  listarPropios(organizadorId: string): Promise<EventoRevision[]> {
    return this.listarRevision("organizador_id", organizadorId);
  }

  /** Catálogo sin sesión: solo eventos aprobados y publicados. */
  async listarPublicos(filtros: CatalogoPublicoQuery = {}): Promise<EventoPublico[]> {
    const consulta = this.cliente().from("eventos_eventos")
      .select(COLUMNAS_PUBLICO).eq("estado", "aprobado").eq("publicado", true)
      .order("destacado", { ascending: false }).order("inicio").order("id")
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    const { data, error } = await consulta;
    if (error) {
      this.logger.warn(`No se pudo listar el catálogo: ${error.message}`);
      throw bdNoDisponible("No se pudo leer el catálogo. Inténtalo de nuevo.");
    }
    const filas = (data ?? []) as unknown as EventoPublicoFila[];
    const eventos = filas.map((fila) => this.proyectarPublico(fila));
    return eventos.filter((evento) => this.cumpleFiltros(evento, filtros));
  }

  async listarPublicosMes(mes: string): Promise<EventoPublico[]> {
    const [anio, numero] = mes.split("-").map(Number);
    const desde = new Date(Date.UTC(anio!, numero! - 1, 1, 5));
    const hasta = new Date(Date.UTC(anio!, numero!, 1, 5));
    const eventos = await this.listarPublicos();
    return eventos.filter((evento) => {
      const inicio = new Date(evento.inicio);
      return inicio >= desde && inicio < hasta;
    });
  }

  async leerPublico(id: string): Promise<EventoPublico> {
    const { data, error } = await this.cliente().from("eventos_eventos")
      .select(COLUMNAS_PUBLICO).eq("id", id).eq("estado", "aprobado").eq("publicado", true)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS)).maybeSingle();
    if (error) {
      this.logger.warn(`No se pudo leer el evento público ${id}: ${error.message}`);
      throw bdNoDisponible("No se pudo leer el evento. Inténtalo de nuevo.");
    }
    if (!data) throw new NotFoundException({ codigo: CODIGOS_EVENTOS.EVENTO_NO_EXISTE, mensaje: "El evento no existe" });
    return this.proyectarPublico(data as unknown as EventoPublicoFila);
  }

  private proyectarPublico(fila: EventoPublicoFila): EventoPublico {
    const sede = Array.isArray(fila.sede) ? fila.sede[0] : fila.sede;
    const categorias = (fila.categorias ?? []) as CategoriaPrecio[];
    return {
      id: fila.id, titulo: fila.titulo, descripcion: fila.descripcion, categoria: fila.categoria,
      distrito: fila.distrito, inicio: fila.inicio, destacado: fila.destacado, foto_url: fila.foto_url,
      aforo: Number(fila.aforo), sede, categorias, precio_minimo_centimos: precioMinimo(categorias.map((c) => Number(c.precio_centimos))),
    } as EventoPublico;
  }

  private cumpleFiltros(evento: EventoPublico, filtros: CatalogoPublicoQuery): boolean {
    const termino = filtros.q?.toLocaleLowerCase("es");
    if (termino && !`${evento.titulo} ${evento.descripcion}`.toLocaleLowerCase("es").includes(termino)) return false;
    if (filtros.categoria && evento.categoria !== filtros.categoria) return false;
    if (filtros.distrito && evento.distrito.toLocaleLowerCase("es") !== filtros.distrito.toLocaleLowerCase("es")) return false;
    const fecha = evento.inicio.slice(0, 10);
    if (filtros.desde && fecha < filtros.desde) return false;
    if (filtros.hasta && fecha > filtros.hasta) return false;
    const precio = evento.precio_minimo_centimos;
    if (filtros.precio_minimo_centimos !== undefined && (precio === null || precio < filtros.precio_minimo_centimos)) return false;
    if (filtros.precio_maximo_centimos !== undefined && (precio === null || precio > filtros.precio_maximo_centimos)) return false;
    return true;
  }

  private async listarRevision(campo: "estado" | "organizador_id", valor: string): Promise<EventoRevision[]> {
    const { data } = await this.consultarRevision(this.cliente().from("eventos_eventos")
      .select(COLUMNAS_REVISION).eq(campo, valor).order("inicio").order("id")
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS)));
    return (data ?? []) as unknown as EventoRevision[];
  }

  async constancia(id: string): Promise<ConstanciaEvento> {
    const evento = await this.leerRevision(id);
    return { url: evento.constancia_apdayc_url
      ? await this.archivos.firmarConstancia(evento.organizador_id, evento.constancia_apdayc_url)
      : null };
  }

  aprobar(id: string): Promise<EventoRevision> {
    return this.actualizarRevision(id, "pendiente", { estado: "aprobado", motivo_rechazo: null });
  }

  rechazar(id: string, motivo: string): Promise<EventoRevision> {
    return this.actualizarRevision(id, "pendiente", { estado: "rechazado", motivo_rechazo: motivo, destacado: false });
  }

  destacar(id: string, destacado: boolean): Promise<EventoRevision> {
    return this.actualizarRevision(id, "aprobado", { destacado });
  }

  private async actualizarRevision(
    id: string, estado: "pendiente" | "aprobado", cambios: Record<string, unknown>,
  ): Promise<EventoRevision> {
    // El filtro se evalúa dentro del UPDATE: dos revisores no pueden sobrescribir sus decisiones.
    const { data } = await this.consultarRevision(this.cliente().from("eventos_eventos")
      .update(cambios).eq("id", id).eq("estado", estado).select(COLUMNAS_REVISION)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS)).maybeSingle());
    if (data) return data as unknown as EventoRevision;
    await this.leerRevision(id); // Distingue un UUID inexistente de un estado incompatible.
    throw new ConflictException({
      codigo: CODIGOS_EVENTOS.ESTADO_EVENTO_INCOMPATIBLE,
      mensaje: `La acción requiere un evento ${estado}. Recarga el evento.`,
    });
  }

  private async leerRevision(id: string): Promise<EventoRevision> {
    const { data } = await this.consultarRevision(this.cliente().from("eventos_eventos")
      .select(COLUMNAS_REVISION).eq("id", id)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS)).maybeSingle());
    if (!data) throw new NotFoundException({ codigo: CODIGOS_EVENTOS.EVENTO_NO_EXISTE, mensaje: "El evento no existe" });
    return data as unknown as EventoRevision;
  }

  private async consultarRevision<T>(consulta: PromiseLike<{ data: T; error: unknown }>): Promise<{ data: T }> {
    try {
      const resultado = await consulta;
      if (resultado.error) throw resultado.error;
      return resultado;
    } catch {
      throw bdNoDisponible("No se pudo consultar o actualizar el evento. Recarga antes de repetir la acción.");
    }
  }

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

  /**
   * Sedes compartidas con su distrito y su capacidad (el máximo del aforo en el formulario).
   * `propia`: la sede es del organizador que pregunta (puede reemplazar su mapa).
   */
  async listarSedes(organizadorId: string): Promise<SedeResumen[]> {
    const { data, error } = await this.cliente()
      .rpc("eventos_listar_sedes", { p_organizador: organizadorId })
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
      propia: s.propia === true,
    }));
  }

  /** Crea una sede con su mapa completo, a nombre del organizador. */
  async crearSede(organizadorId: string, mapa: MapaSedeEntrada): Promise<MapaSede> {
    const id = await this.llamarRpc(
      "eventos_guardar_mapa",
      { p_organizador: organizadorId, p_sede_id: null, p_mapa: mapa },
      "guardar el mapa",
    );
    return this.leerMapaCreado(id);
  }

  /** Mapa de una sede (secciones, filas, bloques y asientos), ordenado. */
  async leerMapa(sedeId: string): Promise<MapaSede> {
    const { data, error } = await this.cliente()
      .rpc("eventos_leer_mapa", { p_sede_id: sedeId })
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (error) {
      this.logger.warn(`No se pudo leer el mapa de la sede ${sedeId}: ${error.message}`);
      throw bdNoDisponible("No se pudo leer el mapa de la sede. Inténtalo de nuevo.");
    }
    if (data === null || data === undefined) {
      throw new NotFoundException({ codigo: CODIGOS_EVENTOS.SEDE_NO_EXISTE, mensaje: "La sede indicada no existe" });
    }
    const mapa = MapaSedeSchema.safeParse(data);
    if (!mapa.success) {
      this.logger.error(`El mapa de la sede ${sedeId} no cumple MapaSedeSchema: ${mapa.error.message}`);
      throw new InternalServerErrorException({ codigo: "ERROR_INTERNO", mensaje: "No se pudo leer el mapa de la sede" });
    }
    return mapa.data;
  }

  /** Reemplaza el mapa entero de una sede propia cuyo mapa sigue abierto. */
  async guardarMapa(organizadorId: string, sedeId: string, mapa: MapaSedeEntrada): Promise<MapaSede> {
    await this.llamarRpc(
      "eventos_guardar_mapa",
      { p_organizador: organizadorId, p_sede_id: sedeId, p_mapa: mapa },
      "guardar el mapa",
    );
    return this.leerMapa(sedeId);
  }

  /** Copia una sede (propia o ajena) con su mapa e ids nuevos, a nombre del organizador. */
  async duplicarSede(organizadorId: string, sedeId: string, nombre: string): Promise<MapaSede> {
    const id = await this.llamarRpc(
      "eventos_duplicar_sede",
      { p_organizador: organizadorId, p_sede_id: sedeId, p_nombre: nombre },
      "duplicar la sede",
    );
    return this.leerMapaCreado(id);
  }

  /** Lee el mapa de una sede recién creada: si falla, la sede ya existe y repetir crearía otra. */
  private async leerMapaCreado(id: string): Promise<MapaSede> {
    try {
      return await this.leerMapa(id);
    } catch (e) {
      if (e instanceof ServiceUnavailableException) {
        throw bdNoDisponible("El local se creó, pero no se pudo leer. Recarga tus locales.");
      }
      throw e;
    }
  }

  /** Publica un evento aprobado del organizador y cierra el mapa de su sede. Idempotente. */
  async publicarEvento(organizadorId: string, eventoId: string): Promise<Evento> {
    await this.llamarRpc(
      "eventos_publicar_evento",
      { p_organizador: organizadorId, p_evento_id: eventoId },
      "publicar el evento",
    );
    const { data, error } = await this.cliente()
      .from("eventos_eventos")
      .select(COLUMNAS_EVENTO)
      .eq("id", eventoId)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
      .single();
    if (error || !data) {
      this.logger.warn(`Evento ${eventoId} publicado, pero no se pudo leer: ${error?.message}`);
      throw bdNoDisponible("El evento se publicó, pero no se pudo leer. Recarga tus eventos.");
    }
    return data as unknown as Evento;
  }

  /**
   * Rangos de precio del evento y cada asiento numerado del mapa vigente con su categoría resuelta.
   * Lo leen el organizador dueño y `admin`.
   */
  async leerPrecios(usuario: Pick<UsuarioAutenticado, "id" | "perfil">, eventoId: string): Promise<PreciosEvento> {
    const { data, error } = await this.cliente()
      .from("eventos_eventos")
      .select("id, organizador_id")
      .eq("id", eventoId)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
      .maybeSingle();
    if (error) {
      this.logger.warn(`No se pudo leer el evento ${eventoId}: ${error.message}`);
      throw bdNoDisponible("No se pudieron leer los precios. Inténtalo de nuevo.");
    }
    if (!data) throw new NotFoundException({ codigo: CODIGOS_EVENTOS.EVENTO_NO_EXISTE, mensaje: "El evento no existe" });
    const evento = data as { id: string; organizador_id: string };
    if (usuario.perfil.rol !== "admin" && evento.organizador_id !== usuario.id) {
      throw new ForbiddenException({ codigo: CODIGOS_EVENTOS.EVENTO_AJENO, mensaje: "El evento es de otro organizador" });
    }
    return this.preciosDe(eventoId);
  }

  /** Reemplaza todos los rangos de precio de un evento propio sin publicar, en una transacción (RPC). */
  async guardarPrecios(organizadorId: string, eventoId: string, entrada: PreciosEntrada): Promise<PreciosEvento> {
    await this.llamarRpc(
      "eventos_guardar_precios",
      { p_organizador: organizadorId, p_evento_id: eventoId, p_rangos: entrada.rangos },
      "guardar los precios",
    );
    try {
      return await this.preciosDe(eventoId);
    } catch (e) {
      if (e instanceof ServiceUnavailableException) {
        throw bdNoDisponible("Los precios se guardaron, pero no se pudieron leer. Recarga la página.");
      }
      throw e;
    }
  }

  /**
   * Rangos (en el orden del mapa: sección, fila, desde; los que no casan, al final), asientos con su
   * categoría y las categorías del evento (para elegir y pintar en la pizarra de precios, 2.10).
   */
  private async preciosDe(eventoId: string): Promise<PreciosEvento> {
    const senal = () => AbortSignal.timeout(TIEMPO_LIMITE_BD_MS);
    const [{ data, error }, categorias] = await Promise.all([
      this.cliente().rpc("eventos_leer_precios", { p_evento_id: eventoId }).abortSignal(senal()),
      this.cliente().from("eventos_categorias_precio").select(COLUMNAS_CATEGORIA).eq("evento_id", eventoId).order("nombre").abortSignal(senal()),
    ]);
    if (error || categorias.error) {
      this.logger.warn(`No se pudieron leer los precios del evento ${eventoId}: ${(error ?? categorias.error)?.message}`);
      throw bdNoDisponible("No se pudieron leer los precios. Inténtalo de nuevo.");
    }
    if (data === null || data === undefined) {
      throw new NotFoundException({ codigo: CODIGOS_EVENTOS.EVENTO_NO_EXISTE, mensaje: "El evento no existe" });
    }
    const precios = PreciosEventoSchema.safeParse({ ...(data as object), categorias: categorias.data ?? [] });
    if (!precios.success) {
      this.logger.error(`Los precios del evento ${eventoId} no cumplen PreciosEventoSchema: ${precios.error.message}`);
      throw new InternalServerErrorException({ codigo: "ERROR_INTERNO", mensaje: "No se pudieron leer los precios" });
    }
    return precios.data;
  }

  /** Llama a una RPC que devuelve un id y traduce sus errores `P0001` a los códigos del módulo. */
  private async llamarRpc(nombre: string, args: Record<string, unknown>, accion: string): Promise<string> {
    const { data, error, status } = await this.cliente()
      .rpc(nombre, args)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (!error && typeof data === "string") return data;
    const errorBd = error as ErrorBd | null;
    const traducido = errorBd?.code === "P0001" ? ERRORES_RPC[errorBd.message] : undefined;
    if (traducido) throw traducido(errorBd?.details ?? errorBd!.message);
    if (status === 0) {
      // Sin respuesta (tiempo límite o red): no se sabe si la BD lo confirmó.
      throw bdNoDisponible(`No se pudo confirmar la operación (${accion}). Recarga antes de repetirla.`);
    }
    this.logger.error(`La BD rechazó ${accion} (${status} ${errorBd?.code ?? ""}): ${errorBd?.message ?? "sin id"}`);
    throw new InternalServerErrorException({ codigo: "ERROR_INTERNO", mensaje: `No se pudo ${accion}` });
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

  /**
   * Evento con su sede y sus categorías (con la capacidad de su zona general), para `ventas`.
   * `null` si no existe (o el id no es un UUID). No filtra por estado ni dueño: lo decide quien llama.
   */
  async datosParaVenta(eventoId: string): Promise<EventoParaVenta | null> {
    if (!UUID.test(eventoId)) return null;
    const { data, error } = await this.cliente()
      .from("eventos_eventos")
      .select(COLUMNAS_VENTA)
      .eq("id", eventoId)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
      .maybeSingle();
    if (error) {
      this.logger.warn(`No se pudo leer el evento ${eventoId} para la venta: ${error.message}`);
      throw bdNoDisponible("No se pudo leer el evento. Inténtalo de nuevo.");
    }
    if (!data) return null;
    type Seccion = { tipo: string; capacidad: number | null };
    const fila = data as unknown as Omit<EventoParaVenta, "sede" | "categorias"> & {
      sede: EventoParaVenta["sede"] | EventoParaVenta["sede"][] | null;
      categorias: {
        id: string; nombre: string; precio_centimos: number; seccion_id: string | null;
        seccion: Seccion | Seccion[] | null;
      }[] | null;
    };
    const sede = Array.isArray(fila.sede) ? fila.sede[0] : fila.sede;
    return {
      id: fila.id,
      organizador_id: fila.organizador_id,
      estado: fila.estado,
      publicado: fila.publicado === true,
      inicio: fila.inicio,
      aforo: Number(fila.aforo),
      titulo: fila.titulo,
      sede: { nombre: sede?.nombre ?? "", direccion: sede?.direccion ?? "" },
      categorias: (fila.categorias ?? []).map((c) => {
        const seccion = Array.isArray(c.seccion) ? c.seccion[0] : c.seccion;
        const general = seccion?.tipo === "general" && seccion.capacidad !== null;
        return {
          id: c.id,
          nombre: c.nombre,
          precio_centimos: Number(c.precio_centimos),
          seccion_id: c.seccion_id,
          capacidad_zona: general ? Number(seccion.capacidad) : null,
        };
      }),
    };
  }

  /** Datos de varios eventos para los paneles de `negocio` (epic 4), en cualquier estado. */
  async resumenesParaNegocio(ids: string[]): Promise<EventoParaNegocio[]> {
    const validos = [...new Set(ids)].filter((id) => UUID.test(id));
    if (validos.length === 0) return [];
    const { data, error } = await this.cliente()
      .from("eventos_eventos")
      .select("id, organizador_id, titulo, categoria, distrito, inicio, aforo")
      .in("id", validos)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (error) {
      this.logger.warn(`No se pudieron leer los eventos para el tablero: ${error.message}`);
      throw bdNoDisponible("No se pudieron leer los eventos. Inténtalo de nuevo.");
    }
    return ((data ?? []) as EventoParaNegocio[]).map((e) => ({ ...e, aforo: Number(e.aforo) }));
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
    if (error?.code === "P0001" && error.message === CODIGOS_EVENTOS.SEDE_AJENA) {
      return new ForbiddenException({
        codigo: CODIGOS_EVENTOS.SEDE_AJENA,
        mensaje: `sede: ${error.details ?? "la sede es de otro organizador: crea tu propio local o duplícalo"}`,
      });
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

/** Excepción HTTP de cada código `P0001` de las RPC del mapa, de los precios y de la publicación. */
const ERRORES_RPC: Record<string, (mensaje: string) => HttpException> = {
  [CODIGOS_EVENTOS.SEDE_NO_EXISTE]: (m) => new NotFoundException({ codigo: CODIGOS_EVENTOS.SEDE_NO_EXISTE, mensaje: m }),
  [CODIGOS_EVENTOS.SEDE_AJENA]: (m) => new ForbiddenException({ codigo: CODIGOS_EVENTOS.SEDE_AJENA, mensaje: m }),
  [CODIGOS_EVENTOS.MAPA_CERRADO]: (m) => new ConflictException({ codigo: CODIGOS_EVENTOS.MAPA_CERRADO, mensaje: m }),
  [CODIGOS_EVENTOS.SECCION_EN_USO]: (m) => new ConflictException({ codigo: CODIGOS_EVENTOS.SECCION_EN_USO, mensaje: m }),
  [CODIGOS_EVENTOS.EVENTO_NO_EXISTE]: (m) => new NotFoundException({ codigo: CODIGOS_EVENTOS.EVENTO_NO_EXISTE, mensaje: m }),
  [CODIGOS_EVENTOS.EVENTO_AJENO]: (m) => new ForbiddenException({ codigo: CODIGOS_EVENTOS.EVENTO_AJENO, mensaje: m }),
  [CODIGOS_EVENTOS.EVENTO_NO_APROBADO]: (m) =>
    new ConflictException({ codigo: CODIGOS_EVENTOS.EVENTO_NO_APROBADO, mensaje: m }),
  // Al publicar choca con el mapa vigente: 409 (en el alta es un dato inválido: 400).
  [CODIGOS_EVENTOS.AFORO_SUPERA_SEDE]: (m) =>
    new ConflictException({ codigo: CODIGOS_EVENTOS.AFORO_SUPERA_SEDE, mensaje: `aforo: ${m}` }),
  [CODIGOS_EVENTOS.ASIENTOS_SIN_PRECIO]: (m) =>
    new ConflictException({ codigo: CODIGOS_EVENTOS.ASIENTOS_SIN_PRECIO, mensaje: m }),
  [CODIGOS_EVENTOS.EVENTO_PUBLICADO]: (m) => new ConflictException({ codigo: CODIGOS_EVENTOS.EVENTO_PUBLICADO, mensaje: m }),
  [CODIGOS_EVENTOS.RANGO_FUERA_DEL_MAPA]: (m) =>
    new BadRequestException({ codigo: CODIGOS_EVENTOS.RANGO_FUERA_DEL_MAPA, mensaje: m }),
  [CODIGOS_EVENTOS.CATEGORIA_NO_VALIDA]: (m) =>
    new BadRequestException({ codigo: CODIGOS_EVENTOS.CATEGORIA_NO_VALIDA, mensaje: m }),
  // Defensa de la RPC de precios (rango invertido o solapado); el esquema ya lo rechaza antes.
  [CODIGOS_EVENTOS.DATOS_INVALIDOS]: (m) => new BadRequestException({ codigo: CODIGOS_EVENTOS.DATOS_INVALIDOS, mensaje: m }),
};

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
  return validarConEsquema(AltaEventoSchema, valor, "datos");
}

/** Lo que se necesita de un esquema de zod para validar. */
export interface EsquemaValidable<T> {
  safeParse(
    valor: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

/**
 * Valida con zod y, si falla, lanza 400 `DATOS_INVALIDOS` con un mensaje que nombra la ruta de cada campo
 * (p. ej. `secciones.0.filas.2.bloques.0.asientos.3.numero: …`). `raiz` nombra el valor entero.
 */
export function validarConEsquema<T>(esquema: EsquemaValidable<T>, valor: unknown, raiz: string): T {
  const resultado = esquema.safeParse(valor);
  if (!resultado.success) {
    throw datosInvalidos(
      resultado.error.issues.map((i) => `${i.path.length ? i.path.map(String).join(".") : raiz}: ${i.message}`).join("; "),
    );
  }
  return resultado.data;
}

function datosInvalidos(mensaje: string): BadRequestException {
  return new BadRequestException({ codigo: CODIGOS_EVENTOS.DATOS_INVALIDOS, mensaje });
}
