import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  CODIGOS_MARKETING,
  type DatosPieza,
  type OrigenIa,
  type Pieza,
  PiezaSchema,
  type TextosYCampana,
} from "@reto18/shared";
import { type EventoParaPieza, EventosService } from "../eventos/eventos.service.js";
import { IaService } from "../ia/ia.service.js";
import { SUPABASE_CLIENTE, type ClienteSupabase } from "../supabase/supabase.module.js";

export const TABLA_PIEZAS = "marketing_piezas";
const COLUMNAS_PIEZA = "id, evento_id, origen, textos, paleta, campana, creado_en";
/** Tiempo límite de las llamadas a la BD del módulo. */
export const TIEMPO_LIMITE_BD_MS = 10_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function bdNoDisponible(mensaje: string): ServiceUnavailableException {
  return new ServiceUnavailableException({ codigo: CODIGOS_MARKETING.BD_NO_DISPONIBLE, mensaje });
}
