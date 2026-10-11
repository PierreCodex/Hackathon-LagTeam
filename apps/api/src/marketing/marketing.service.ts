import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  type ClicRegistrado,
  CODIGOS_MARKETING,
  type CrearEnlace,
  type DatosPieza,
  type Enlace,
  EnlaceSchema,
  type MetricasEnlace,
  type OrigenIa,
  type Pieza,
  PiezaSchema,
  type ResultadosPieza,
  ResultadosPiezaSchema,
  type TextosYCampana,
} from "@reto18/shared";
import { type EventoParaPieza, EventosService } from "../eventos/eventos.service.js";
import { IaService } from "../ia/ia.service.js";
import { SUPABASE_CLIENTE, type ClienteSupabase } from "../supabase/supabase.module.js";
import { VentasService } from "../ventas/ventas.service.js";
import { esCodigoValido, generarCodigo } from "./codigo-enlace.js";

export const TABLA_PIEZAS = "marketing_piezas";
export const TABLA_ENLACES = "marketing_enlaces";
export const TABLA_CLICS = "marketing_clics";
const COLUMNAS_PIEZA = "id, evento_id, origen, textos, paleta, campana, creado_en";
const COLUMNAS_ENLACE = "codigo, evento_id, pieza_id, red, zona, creado_en";
/** Intentos de insertar un enlace con un código nuevo cuando el anterior choca (`23505`). */
export const INTENTOS_CODIGO_ENLACE = 3;
/** Tiempo límite de las llamadas a la BD del módulo. */
export const TIEMPO_LIMITE_BD_MS = 10_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pieza con su dueño, para comprobar la propiedad en las rutas de enlaces. */
interface PiezaConDueno {
  id: string;
  evento_id: string;
  organizador_id: string;
}

/** Enlace con el recuento de clics embebido por PostgREST (`marketing_clics(count)`). */
type FilaEnlaceConClics = Enlace & { marketing_clics: { count: number }[] | null };

interface FilaPieza extends TextosYCampana {
  id: string;
  evento_id: string;
  origen: OrigenIa;
  creado_en: string;
}

/** Servicio del módulo `marketing`. Es la única puerta a las tablas `marketing_*` (AD-2). */
@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    @Inject(SUPABASE_CLIENTE) private readonly supabase: ClienteSupabase,
    @Inject(EventosService) private readonly eventos: EventosService,
    @Inject(IaService) private readonly ia: IaService,
    @Inject(VentasService) private readonly ventas: VentasService,
  ) {}

  /**
   * Genera y guarda la pieza de un evento aprobado del organizador. La IA aporta textos, paleta y
   * campaña; fecha, sede y precio salen del evento (AD-11). Una fila por generación.
   */
  async generarPieza(organizadorId: string, eventoId: string): Promise<Pieza> {
    const supabase = this.cliente();
    const evento = await this.eventos.datosParaPieza(eventoId);
    if (!evento || evento.organizador_id !== organizadorId) {
      throw new NotFoundException({ codigo: CODIGOS_MARKETING.EVENTO_NO_ENCONTRADO, mensaje: "El evento no existe" });
    }
    if (evento.estado !== "aprobado") {
      throw new ConflictException({
        codigo: CODIGOS_MARKETING.EVENTO_NO_APROBADO,
        mensaje: "Solo se generan piezas de eventos aprobados",
      });
    }
    if (new Date(evento.inicio).getTime() <= Date.now()) {
      throw new ConflictException({
        codigo: CODIGOS_MARKETING.EVENTO_FINALIZADO,
        mensaje: "El evento ya empezó o terminó: no se generan piezas",
      });
    }

    const { origen, valor } = await this.ia.textosYCampana({
      titulo: evento.titulo,
      descripcion: evento.descripcion,
      categoria: evento.categoria,
      inicio: evento.inicio,
      sede: evento.sede.nombre,
      direccion: evento.sede.direccion,
      distrito: evento.distrito,
      precio_minimo_centimos: evento.precio_minimo_centimos,
    });

    const { data, error } = await supabase
      .from(TABLA_PIEZAS)
      .insert({ evento_id: evento.id, organizador_id: organizadorId, origen, ...valor })
      .select(COLUMNAS_PIEZA)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
      .single();
    if (error || !data) {
      this.logger.warn(`No se pudo guardar la pieza del evento ${evento.id}: ${error?.message ?? "sin fila"}`);
      throw bdNoDisponible("No se pudo guardar la pieza. Inténtalo de nuevo.");
    }
    return aPieza(data as unknown as FilaPieza, evento);
  }

  /** Pieza guardada con los datos actuales del evento (la usa la plantilla de la 3.8). */
  async obtenerPieza(id: string): Promise<Pieza> {
    const supabase = this.cliente();
    if (!UUID.test(id)) throw piezaNoEncontrada();
    const { data, error } = await supabase
      .from(TABLA_PIEZAS)
      .select(COLUMNAS_PIEZA)
      .eq("id", id)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
      .maybeSingle();
    if (error) {
      this.logger.warn(`No se pudo leer la pieza ${id}: ${error.message}`);
      throw bdNoDisponible("No se pudo leer la pieza. Inténtalo de nuevo.");
    }
    if (!data) throw piezaNoEncontrada();
    const fila = data as unknown as FilaPieza;
    const evento = await this.eventos.datosParaPieza(fila.evento_id);
    // Solo se sirven piezas de eventos aprobados (si se rechaza después, la pieza deja de verse).
    if (!evento || evento.estado !== "aprobado") throw piezaNoEncontrada();
    return aPieza(fila, evento);
  }

  /**
   * Crea un enlace rastreable de una pieza del organizador (AD-8). El código es base62 de 8 y
   * aleatorio; si choca con uno existente se genera otro, hasta `INTENTOS_CODIGO_ENLACE` intentos.
   */
  async crearEnlace(organizadorId: string, piezaId: string, datos: CrearEnlace): Promise<Enlace> {
    const supabase = this.cliente();
    const pieza = await this.piezaDelOrganizador(organizadorId, piezaId);
    for (let intento = 1; intento <= INTENTOS_CODIGO_ENLACE; intento++) {
      const { data, error } = await supabase
        .from(TABLA_ENLACES)
        .insert({
          codigo: generarCodigo(),
          evento_id: pieza.evento_id,
          pieza_id: pieza.id,
          red: datos.red ?? null,
          zona: datos.zona ?? null,
          organizador_id: organizadorId,
        })
        .select(COLUMNAS_ENLACE)
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
        .single();
      if (!error && data) return EnlaceSchema.parse(data);
      if (error?.code === "23505") {
        this.logger.warn(`Código de enlace repetido (intento ${intento} de ${INTENTOS_CODIGO_ENLACE})`);
        continue;
      }
      this.logger.warn(`No se pudo guardar el enlace de la pieza ${pieza.id}: ${error?.message ?? "sin fila"}`);
      throw bdNoDisponible("No se pudo crear el enlace. Inténtalo de nuevo.");
    }
    throw bdNoDisponible("No se pudo crear el enlace. Inténtalo de nuevo.");
  }

  /**
   * Registra un clic del enlace (público y sin datos personales: ni IP ni user-agent) y devuelve
   * el evento al que redirigir. Código desconocido o con formato inválido → 404 sin escribir nada.
   */
  async registrarClic(codigo: string): Promise<ClicRegistrado> {
    const supabase = this.cliente();
    if (!esCodigoValido(codigo)) throw enlaceNoEncontrado();
    const { data, error } = await supabase
      .from(TABLA_ENLACES)
      .select("id, codigo, evento_id")
      .eq("codigo", codigo)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
      .maybeSingle();
    if (error) {
      this.logger.warn(`No se pudo leer el enlace ${codigo}: ${error.message}`);
      throw bdNoDisponible("No se pudo registrar el clic. Inténtalo de nuevo.");
    }
    if (!data) throw enlaceNoEncontrado();
    const enlace = data as { id: string; codigo: string; evento_id: string };
    const insercion = await supabase
      .from(TABLA_CLICS)
      .insert({ enlace_id: enlace.id })
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (insercion.error) {
      this.logger.warn(`No se pudo registrar el clic del enlace ${codigo}: ${insercion.error.message}`);
      throw bdNoDisponible("No se pudo registrar el clic. Inténtalo de nuevo.");
    }
    return { codigo: enlace.codigo, evento_id: enlace.evento_id };
  }

  /**
   * Clics y ventas pagadas de cada enlace de la pieza del organizador, y su total. Los clics se
   * cuentan aquí; las ventas se leen solo con `VentasService.ventasPorRef` (AD-8, último clic) y se
   * juntan por `codigo`.
   */
  async resultadosPieza(organizadorId: string, piezaId: string): Promise<ResultadosPieza> {
    const supabase = this.cliente();
    const pieza = await this.piezaDelOrganizador(organizadorId, piezaId);
    const { data, error } = await supabase
      .from(TABLA_ENLACES)
      .select(`${COLUMNAS_ENLACE}, ${TABLA_CLICS}(count)`)
      .eq("pieza_id", pieza.id)
      .order("creado_en", { ascending: true })
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (error) {
      this.logger.warn(`No se pudieron leer los enlaces de la pieza ${pieza.id}: ${error.message}`);
      throw bdNoDisponible("No se pudieron leer los resultados. Inténtalo de nuevo.");
    }
    const filas = (data ?? []) as unknown as FilaEnlaceConClics[];
    const ventas = new Map((await this.ventas.ventasPorRef(filas.map((f) => f.codigo))).map((v) => [v.ref, v]));

    const total: MetricasEnlace = { clics: 0, ordenes: 0, entradas: 0, importe_centimos: 0 };
    const enlaces = filas.map(({ marketing_clics, ...enlace }) => {
      const venta = ventas.get(enlace.codigo);
      const metricas: MetricasEnlace = {
        clics: Number(marketing_clics?.[0]?.count ?? 0),
        ordenes: venta?.ordenes ?? 0,
        entradas: venta?.entradas ?? 0,
        importe_centimos: venta?.importe_centimos ?? 0,
      };
      total.clics += metricas.clics;
      total.ordenes += metricas.ordenes;
      total.entradas += metricas.entradas;
      total.importe_centimos += metricas.importe_centimos;
      return { ...enlace, ...metricas };
    });
    return ResultadosPiezaSchema.parse({ pieza_id: pieza.id, evento_id: pieza.evento_id, total, enlaces });
  }

  /** Enlaces del organizador con sus clics, para el panel de ventas (`negocio`, epic 4). */
  async enlacesConClicsDe(organizadorId: string): Promise<(Enlace & { clics: number })[]> {
    const { data, error } = await this.cliente()
      .from(TABLA_ENLACES)
      .select(`${COLUMNAS_ENLACE}, ${TABLA_CLICS}(count)`)
      .eq("organizador_id", organizadorId)
      .order("creado_en", { ascending: true })
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (error) {
      this.logger.warn(`No se pudieron leer los enlaces de ${organizadorId}: ${error.message}`);
      throw bdNoDisponible("No se pudieron leer tus enlaces. Inténtalo de nuevo.");
    }
    return ((data ?? []) as unknown as FilaEnlaceConClics[]).map(({ marketing_clics, ...enlace }) => ({
      ...enlace,
      clics: Number(marketing_clics?.[0]?.count ?? 0),
    }));
  }

  /** Pieza del organizador; ajena, inexistente o con un id que no es UUID → 404 sin revelar que existe. */
  private async piezaDelOrganizador(organizadorId: string, piezaId: string): Promise<PiezaConDueno> {
    const supabase = this.cliente();
    if (!UUID.test(piezaId)) throw piezaNoEncontrada();
    const { data, error } = await supabase
      .from(TABLA_PIEZAS)
      .select("id, evento_id, organizador_id")
      .eq("id", piezaId)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
      .maybeSingle();
    if (error) {
      this.logger.warn(`No se pudo leer la pieza ${piezaId}: ${error.message}`);
      throw bdNoDisponible("No se pudo leer la pieza. Inténtalo de nuevo.");
    }
    const pieza = data as PiezaConDueno | null;
    if (!pieza || pieza.organizador_id !== organizadorId) throw piezaNoEncontrada();
    return pieza;
  }

  private cliente(): NonNullable<ClienteSupabase> {
    if (!this.supabase) throw bdNoDisponible("Supabase no está configurado en la API");
    return this.supabase;
  }
}

/** Datos de la plantilla: siempre del evento en la BD, nunca de la IA (AD-11). */
export function datosDePieza(evento: EventoParaPieza): DatosPieza {
  return {
    evento_id: evento.id,
    titulo: evento.titulo,
    inicio: evento.inicio,
    sede: evento.sede.nombre,
    direccion: evento.sede.direccion,
    distrito: evento.distrito,
    precio_minimo_centimos: evento.precio_minimo_centimos,
    foto_url: evento.foto_url,
  };
}

function aPieza(fila: FilaPieza, evento: EventoParaPieza): Pieza {
  return PiezaSchema.parse({
    id: fila.id,
    evento_id: fila.evento_id,
    origen: fila.origen,
    textos: fila.textos,
    paleta: fila.paleta,
    campana: fila.campana,
    datos: datosDePieza(evento),
    creado_en: fila.creado_en,
  });
}

function piezaNoEncontrada(): NotFoundException {
  return new NotFoundException({ codigo: CODIGOS_MARKETING.PIEZA_NO_ENCONTRADA, mensaje: "La pieza no existe" });
}

function enlaceNoEncontrado(): NotFoundException {
  return new NotFoundException({ codigo: CODIGOS_MARKETING.ENLACE_NO_ENCONTRADO, mensaje: "El enlace no existe" });
}

function bdNoDisponible(mensaje: string): ServiceUnavailableException {
  return new ServiceUnavailableException({ codigo: CODIGOS_MARKETING.BD_NO_DISPONIBLE, mensaje });
}
