import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  type ButacaVenta,
  CODIGOS_VENTAS,
  type Comision,
  type CrearOrden,
  type CrearOrdenAsiento,
  type Entrada,
  type MetodoPago,
  type MiEntrada,
  type ModeloComision,
  type Orden,
  type OrdenPagada,
  OrdenSchema,
  type VentasPorRef,
} from "@reto18/shared";
import { type EventoParaVenta, EventosService } from "../eventos/eventos.service.js";
import { NotificacionesService } from "../notificaciones/notificaciones.service.js";
import { SUPABASE_CLIENTE, type ClienteSupabase } from "../supabase/supabase.module.js";
import { PASARELA_PAGO, type PasarelaPago } from "./pasarela-pago.js";
import { FirmaQr } from "./qr.js";

/** Tiempo límite de las llamadas a la BD del módulo. */
export const TIEMPO_LIMITE_BD_MS = 10_000;
/** Plantilla del aviso de WhatsApp de una compra pagada (la 2.2 genera la imagen y envía). */
export const PLANTILLA_ENTRADA_PAGADA = "entrada_pagada";

const COLUMNAS_ORDEN =
  "id, usuario_id, evento_id, categoria_id, cantidad, precio_unitario_centimos, total_centimos, estado, expira_en, " +
  "ref, metodo_pago, pagada_en, creado_en";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ErrorBd {
  code?: string;
  message: string;
  details?: string | null;
}

type FilaOrden = Orden & { usuario_id: string };

/** Resultado de `ventas_confirmar_pago`. */
type ConfirmacionPago =
  | { resultado: "expirada" }
  | { resultado: "pagada"; orden: FilaOrden; entradas: string[] };

/** Resultado de consumir una entrada en la puerta (lo traduce `acceso`). */
export type ResultadoConsumo =
  | { estado: "aceptada"; usada_en: string }
  | { estado: "ya_usada"; usada_en: string }
  | { estado: "otro_evento" }
  | { estado: "no_existe" };

/** Orden pagada tal como la leen los paneles de `negocio` (epic 4). */
export interface OrdenParaNegocio {
  id: string;
  usuario_id: string;
  evento_id: string;
  categoria_id: string;
  ref: string | null;
  cantidad: number;
  total_centimos: number;
  comision_modelo: ModeloComision;
  comision_valor: number;
  comision_importe: number;
  pagada_en: string;
}

/** Quién paga: el teléfono sale del perfil del usuario autenticado (AD-9). */
export interface Comprador {
  id: string;
  telefono: string;
}

/**
 * Comisión de una orden en céntimos (AD-10). Es la misma regla que `ventas_calcular_comision` en
 * Postgres, que es la que se congela al pagar: `porcentaje` en puntos básicos sobre el total;
 * `fijo_por_entrada` en céntimos por entrada; `tarifa_evento` no carga la orden (lo liquida la 4.2).
 */
export function calcularComision(modelo: ModeloComision, valor: number, totalCentimos: number, cantidad: number): number {
  switch (modelo) {
    case "porcentaje":
      return Math.round((totalCentimos * valor) / 10_000);
    case "fijo_por_entrada":
      return valor * cantidad;
    case "tarifa_evento":
      return 0;
  }
}

/** Cupos de las zonas generales del evento: `capacidad = least(capacidad de la zona, aforo)`. */
export function cuposGenerales(evento: EventoParaVenta): { seccion_id: string; capacidad: number }[] {
  const cupos = new Map<string, number>();
  for (const c of evento.categorias) {
    if (c.seccion_id && c.capacidad_zona !== null) cupos.set(c.seccion_id, Math.min(c.capacidad_zona, evento.aforo));
  }
  return [...cupos].map(([seccion_id, capacidad]) => ({ seccion_id, capacidad }));
}

/** Servicio del módulo `ventas`. Es la única puerta a las tablas `ventas_*` (AD-2). */
@Injectable()
export class VentasService {
  private readonly logger = new Logger(VentasService.name);

  constructor(
    @Inject(SUPABASE_CLIENTE) private readonly supabase: ClienteSupabase,
    @Inject(EventosService) private readonly eventos: EventosService,
    @Inject(NotificacionesService) private readonly notificaciones: NotificacionesService,
    @Inject(PASARELA_PAGO) private readonly pasarela: PasarelaPago,
    @Inject(FirmaQr) private readonly qr: FirmaQr,
  ) {}

  /**
   * Orden `pendiente` de entradas de zona general de un evento aprobado y publicado. Reserva el cupo
   * 10 minutos (AD-5). `ref` se guarda sin validar (AD-8).
   */
  async crearOrden(usuarioId: string, datos: CrearOrden): Promise<Orden> {
    this.cliente();
    const evento = await this.eventos.datosParaVenta(datos.evento_id);
    if (!evento || evento.estado !== "aprobado" || !evento.publicado) throw eventoNoEncontrado();
    const categoria = evento.categorias.find((c) => c.id === datos.categoria_id);
    if (!categoria || !categoria.seccion_id || categoria.capacidad_zona === null) {
      throw new BadRequestException({
        codigo: CODIGOS_VENTAS.CATEGORIA_NO_VALIDA,
        mensaje: "categoria_id: la categoría no es de este evento o no tiene zona general a la venta",
      });
    }
    const fila = await this.rpc<FilaOrden>(
      "ventas_crear_orden",
      {
        p_datos: {
          usuario_id: usuarioId,
          evento_id: evento.id,
          categoria_id: categoria.id,
          seccion_id: categoria.seccion_id,
          cantidad: datos.cantidad,
          precio_unitario_centimos: categoria.precio_centimos,
          inicio: evento.inicio,
          aforo: evento.aforo,
          ref: datos.ref ?? null,
          cupos: cuposGenerales(evento),
        },
      },
      "crear la orden",
    );
    return aOrden(fila);
  }

  /**
   * Butacas de un evento numerado a la venta: asegura el inventario (idempotente, resuelve el precio de
   * cada butaca desde los rangos de la 2.4) y devuelve su estado actual (sin pintar por categoría, AD-1
   * y la decisión del recorte del 11/10/2026). El navegador lee las actualizaciones en vivo por Realtime.
   */
  async butacasDeVenta(eventoId: string): Promise<ButacaVenta[]> {
    const evento = await this.eventos.datosParaVenta(eventoId);
    if (!evento || evento.estado !== "aprobado" || !evento.publicado) throw eventoNoEncontrado();
    await this.rpc<void>("ventas_asegurar_inventario_butacas", { p_evento_id: eventoId }, "preparar las butacas");
    const { data, error } = await this.cliente()
      .from("ventas_evento_asientos")
      .select("asiento_id, precio_centimos, estado")
      .eq("evento_id", eventoId)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (error) {
      this.logger.warn(`No se pudieron leer las butacas del evento ${eventoId}: ${error.message}`);
      throw bdNoDisponible("No se pudieron leer las butacas. Inténtalo de nuevo.");
    }
    const filas = (data ?? []) as { asiento_id: string; precio_centimos: number; estado: "disponible" | "vendida" }[];
    const etiquetas = await this.eventos.etiquetasDeAsientos(filas.map((f) => f.asiento_id));
    return filas
      .flatMap((f) => {
        const etiqueta = etiquetas.get(f.asiento_id);
        if (!etiqueta) return [];
        return [{
          asiento_id: f.asiento_id,
          seccion: etiqueta.seccion,
          fila: etiqueta.fila,
          numero: etiqueta.numero,
          precio_centimos: Number(f.precio_centimos),
          estado: f.estado,
        }];
      })
      .sort((a, b) => a.seccion.localeCompare(b.seccion) || a.fila.localeCompare(b.fila) || a.numero - b.numero);
  }

  /**
   * Orden `pendiente` de una butaca numerada de un evento aprobado y publicado. Sin bloqueo temporal de
   * la butaca (decisión del recorte del 11/10/2026): dos compradores pueden tener cada uno una orden
   * pendiente de la misma butaca; solo quien paga primero se la queda (lo decide `pagar`, AD-5).
   */
  async crearOrdenAsiento(usuarioId: string, datos: CrearOrdenAsiento): Promise<Orden> {
    this.cliente();
    const evento = await this.eventos.datosParaVenta(datos.evento_id);
    if (!evento || evento.estado !== "aprobado" || !evento.publicado) throw eventoNoEncontrado();
    const fila = await this.rpc<FilaOrden>(
      "ventas_crear_orden_asiento",
      {
        p_datos: {
          usuario_id: usuarioId,
          evento_id: evento.id,
          asiento_id: datos.asiento_id,
          inicio: evento.inicio,
          ref: datos.ref ?? null,
        },
      },
      "crear la orden de la butaca",
    );
    return aOrden(fila);
  }

  /**
   * Paga una orden propia `pendiente` con la pasarela (AD-6). Si la orden venció, anula el cobro y
   * responde 409 `ORDEN_EXPIRADA`. Al pagar se congelan la comisión (AD-10), se crean las entradas y
   * se encola el aviso de WhatsApp (si falla la bandeja, la compra sigue: AD-9).
   */
  async pagar(comprador: Comprador, ordenId: string, metodo: MetodoPago): Promise<OrdenPagada> {
    this.qr.exigir(); // Sin QR_SECRET no se cobra: no se podrían emitir las entradas.
    const orden = await this.leerOrden(ordenId, comprador.id);
    if (!orden) throw ordenNoEncontrada();
    if (orden.estado === "pagada") throw ordenNoPendiente("La orden ya está pagada");
    if (orden.estado === "expirada") throw ordenExpirada();

    let referencia: string;
    try {
      ({ referencia } = await this.pasarela.cobrar({ orden_id: orden.id, importe_centimos: orden.total_centimos, metodo }));
    } catch (e) {
      this.logger.warn(`La pasarela rechazó el pago de la orden ${orden.id}: ${e instanceof Error ? e.message : String(e)}`);
      throw new HttpException(
        { codigo: CODIGOS_VENTAS.PAGO_RECHAZADO, mensaje: "La pasarela rechazó el pago. Inténtalo de nuevo." },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    let confirmacion: ConfirmacionPago;
    try {
      confirmacion = await this.rpc<ConfirmacionPago>(
        "ventas_confirmar_pago",
        { p_orden_id: orden.id, p_usuario_id: comprador.id, p_metodo: metodo, p_pasarela_ref: referencia },
        "confirmar el pago",
      );
    } catch (e) {
      // Sin respuesta de la BD no se sabe si la orden quedó pagada: no se anula el cobro.
      // Cualquier otro error (incluido el 503 COMISION_NO_CONFIGURADA) deshizo la transacción: se anula.
      if (e instanceof ServiceUnavailableException && codigoDe(e) === CODIGOS_VENTAS.BD_NO_DISPONIBLE) {
        this.logger.error(`Pago ${referencia} de la orden ${orden.id} sin confirmar en la BD: revisar a mano`);
      } else {
        await this.anularCobro(referencia, orden.id);
      }
      throw e;
    }
    if (confirmacion.resultado === "expirada") {
      await this.anularCobro(referencia, orden.id);
      throw ordenExpirada();
    }

    const pagada = aOrden(confirmacion.orden);
    const entradas: Entrada[] = confirmacion.entradas.map((id) => ({
      id,
      orden_id: pagada.id,
      evento_id: pagada.evento_id,
      qr: this.qr.firmar(id),
      usada_en: null,
      asiento: null,
    }));
    // Cantidad siempre 1 en una orden de butaca (2.11): hay exactamente una entrada que etiquetar.
    if (pagada.asiento_id && entradas.length > 0) {
      const etiquetas = await this.eventos.etiquetasDeAsientos([pagada.asiento_id]);
      entradas[0]!.asiento = etiquetas.get(pagada.asiento_id) ?? null;
    }
    await this.avisarCompra(comprador.telefono, pagada, entradas);
    return { orden: pagada, entradas };
  }

  /** Entradas de la cuenta con su evento (título, inicio y sede), su QR firmado, `usada_en` y su butaca (si tiene). */
  async misEntradas(usuarioId: string): Promise<MiEntrada[]> {
    const { data, error } = await this.cliente()
      .from("ventas_entradas")
      .select("id, orden_id, evento_id, categoria_id, asiento_id, usada_en, creado_en")
      .eq("usuario_id", usuarioId)
      .order("creado_en", { ascending: false })
      .order("id")
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (error) {
      this.logger.warn(`No se pudieron leer las entradas de ${usuarioId}: ${error.message}`);
      throw bdNoDisponible("No se pudieron leer tus entradas. Inténtalo de nuevo.");
    }
    const filas = (data ?? []) as {
      id: string; orden_id: string; evento_id: string; categoria_id: string; asiento_id: string | null; usada_en: string | null;
    }[];
    if (filas.length === 0) return [];
    this.qr.exigir();
    const ids = [...new Set(filas.map((f) => f.evento_id))];
    const [eventos, etiquetas] = await Promise.all([
      Promise.all(ids.map((id) => this.eventos.datosParaVenta(id))).then(
        (lista) => new Map(lista.flatMap((e) => (e ? [[e.id, e] as const] : []))),
      ),
      this.eventos.etiquetasDeAsientos([...new Set(filas.flatMap((f) => (f.asiento_id ? [f.asiento_id] : [])))]),
    ]);
    return filas.flatMap((f) => {
      const evento = eventos.get(f.evento_id);
      if (!evento) return [];
      return [{
        id: f.id,
        orden_id: f.orden_id,
        evento_id: f.evento_id,
        qr: this.qr.firmar(f.id),
        usada_en: f.usada_en,
        asiento: f.asiento_id ? etiquetas.get(f.asiento_id) ?? null : null,
        categoria: evento.categorias.find((c) => c.id === f.categoria_id)?.nombre ?? "",
        evento: { id: evento.id, titulo: evento.titulo, inicio: evento.inicio, sede: evento.sede },
      }];
    });
  }

  /**
   * Órdenes, entradas e importe (céntimos) de las órdenes **pagadas** de cada `ref` (AD-8). Las
   * pendientes y las expiradas no cuentan. Devuelve una fila por `ref` pedido, con ceros si no vendió.
   */
  async ventasPorRef(refs: string[]): Promise<VentasPorRef[]> {
    const unicos = [...new Set(refs.filter((r) => r.length > 0))];
    if (unicos.length === 0) return [];
    const { data, error } = await this.cliente()
      .from("ventas_ordenes")
      .select("ref, cantidad, total_centimos")
      .eq("estado", "pagada")
      .in("ref", unicos)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (error) {
      this.logger.warn(`No se pudieron leer las ventas por ref: ${error.message}`);
      throw bdNoDisponible("No se pudieron leer las ventas. Inténtalo de nuevo.");
    }
    const totales = new Map(unicos.map((ref) => [ref, { ref, ordenes: 0, entradas: 0, importe_centimos: 0 }]));
    for (const fila of (data ?? []) as { ref: string; cantidad: number; total_centimos: number }[]) {
      const total = totales.get(fila.ref);
      if (!total) continue;
      total.ordenes += 1;
      total.entradas += Number(fila.cantidad);
      total.importe_centimos += Number(fila.total_centimos);
    }
    return [...totales.values()];
  }

  /** Comisión vigente (AD-10). */
  async comisionVigente(): Promise<Comision> {
    const { data, error } = await this.cliente()
      .from("ventas_config_comision")
      .select("modelo, valor")
      .eq("vigente", true)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
      .maybeSingle();
    if (error) {
      this.logger.warn(`No se pudo leer la comisión: ${error.message}`);
      throw bdNoDisponible("No se pudo leer la comisión. Inténtalo de nuevo.");
    }
    if (!data) throw new ServiceUnavailableException({ codigo: CODIGOS_VENTAS.COMISION_NO_CONFIGURADA, mensaje: "No hay comisión vigente" });
    const fila = data as { modelo: ModeloComision; valor: number };
    return { modelo: fila.modelo, valor: Number(fila.valor) };
  }

  /** Cambia la comisión vigente. Las órdenes ya pagadas conservan la suya (AD-10). */
  async cambiarComision(comision: Comision): Promise<Comision> {
    const fila = await this.rpc<{ modelo: ModeloComision; valor: number }>(
      "ventas_cambiar_comision",
      { p_modelo: comision.modelo, p_valor: comision.valor },
      "cambiar la comisión",
    );
    return { modelo: fila.modelo, valor: Number(fila.valor) };
  }

  /** Órdenes pagadas con su comisión congelada, para los paneles de `negocio`. Con `eventoIds`, solo de esos eventos. */
  async ordenesPagadas(eventoIds?: string[]): Promise<OrdenParaNegocio[]> {
    if (eventoIds && eventoIds.length === 0) return [];
    let consulta = this.cliente()
      .from("ventas_ordenes")
      .select(
        "id, usuario_id, evento_id, categoria_id, ref, cantidad, total_centimos, comision_modelo, comision_valor, comision_importe, pagada_en",
      )
      .eq("estado", "pagada");
    if (eventoIds) consulta = consulta.in("evento_id", eventoIds);
    const { data, error } = await consulta.order("pagada_en").abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (error) {
      this.logger.warn(`No se pudieron leer las órdenes pagadas: ${error.message}`);
      throw bdNoDisponible("No se pudieron leer las ventas. Inténtalo de nuevo.");
    }
    return ((data ?? []) as OrdenParaNegocio[]).map((o) => ({
      ...o,
      cantidad: Number(o.cantidad),
      total_centimos: Number(o.total_centimos),
      comision_valor: Number(o.comision_valor),
      comision_importe: Number(o.comision_importe),
    }));
  }

  /** Entradas usadas en la puerta por evento (asistencia). Con `eventoIds`, solo de esos eventos. */
  async asistenciaPorEvento(eventoIds?: string[]): Promise<Map<string, number>> {
    if (eventoIds && eventoIds.length === 0) return new Map();
    let consulta = this.cliente().from("ventas_entradas").select("evento_id").not("usada_en", "is", null);
    if (eventoIds) consulta = consulta.in("evento_id", eventoIds);
    const { data, error } = await consulta.abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (error) {
      this.logger.warn(`No se pudo leer la asistencia: ${error.message}`);
      throw bdNoDisponible("No se pudo leer la asistencia. Inténtalo de nuevo.");
    }
    const asistencia = new Map<string, number>();
    for (const { evento_id } of (data ?? []) as { evento_id: string }[]) {
      asistencia.set(evento_id, (asistencia.get(evento_id) ?? 0) + 1);
    }
    return asistencia;
  }

  /** Organizador dueño de un evento, para que `acceso` decida quién valida en la puerta. `null` si no existe. */
  async organizadorDelEvento(eventoId: string): Promise<string | null> {
    return (await this.eventos.datosParaVenta(eventoId))?.organizador_id ?? null;
  }

  /**
   * Marca la entrada como usada si es de ese evento y no se usó (un solo `UPDATE … WHERE usada_en IS NULL`,
   * AD-7). Solo la llama `AccesoService`: es la única escritura de `usada_en`.
   */
  async consumirEntrada(entradaId: string, eventoId: string): Promise<ResultadoConsumo> {
    if (!UUID.test(entradaId)) return { estado: "no_existe" };
    const supabase = this.cliente();
    const { data, error } = await supabase
      .from("ventas_entradas")
      .update({ usada_en: new Date().toISOString() })
      .eq("id", entradaId)
      .eq("evento_id", eventoId)
      .is("usada_en", null)
      .select("usada_en")
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
      .maybeSingle();
    if (error) {
      this.logger.warn(`No se pudo validar la entrada ${entradaId}: ${error.message}`);
      throw bdNoDisponible("No se pudo validar la entrada. Vuelve a escanearla.");
    }
    if (data) return { estado: "aceptada", usada_en: (data as { usada_en: string }).usada_en };

    const lectura = await supabase
      .from("ventas_entradas")
      .select("evento_id, usada_en")
      .eq("id", entradaId)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
      .maybeSingle();
    if (lectura.error) {
      this.logger.warn(`No se pudo leer la entrada ${entradaId}: ${lectura.error.message}`);
      throw bdNoDisponible("No se pudo validar la entrada. Vuelve a escanearla.");
    }
    const fila = lectura.data as { evento_id: string; usada_en: string | null } | null;
    if (!fila) return { estado: "no_existe" };
    if (fila.evento_id !== eventoId) return { estado: "otro_evento" };
    if (fila.usada_en) return { estado: "ya_usada", usada_en: fila.usada_en };
    return { estado: "no_existe" };
  }

  private async leerOrden(ordenId: string, usuarioId: string): Promise<FilaOrden | null> {
    const { data, error } = await this.cliente()
      .from("ventas_ordenes")
      .select(COLUMNAS_ORDEN)
      .eq("id", ordenId)
      .eq("usuario_id", usuarioId)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS))
      .maybeSingle();
    if (error) {
      this.logger.warn(`No se pudo leer la orden ${ordenId}: ${error.message}`);
      throw bdNoDisponible("No se pudo leer la orden. Inténtalo de nuevo.");
    }
    return (data as unknown as FilaOrden | null) ?? null;
  }

  private async anularCobro(referencia: string, ordenId: string): Promise<void> {
    try {
      await this.pasarela.anular(referencia);
    } catch (e) {
      this.logger.error(
        `No se pudo anular el cobro ${referencia} de la orden ${ordenId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Encola el aviso de la compra. Nunca rompe el pago (AD-9). */
  private async avisarCompra(telefono: string, orden: Orden, entradas: Entrada[]): Promise<void> {
    let evento: EventoParaVenta | null = null;
    try {
      evento = await this.eventos.datosParaVenta(orden.evento_id);
    } catch (e) {
      this.logger.warn(`Aviso de la orden ${orden.id} sin datos del evento: ${e instanceof Error ? e.message : String(e)}`);
    }
    await this.notificaciones.encolar({
      telefono,
      plantilla: PLANTILLA_ENTRADA_PAGADA,
      datos: {
        orden_id: orden.id,
        evento: evento?.titulo ?? null,
        inicio: evento?.inicio ?? null,
        entradas: entradas.map((e) => ({ id: e.id, qr: e.qr })),
      },
      adjunto_url: null,
    });
  }

  /**
   * Llama a una RPC y traduce sus errores `P0001` a los códigos del módulo. `T` puede ser `void`
   * (una RPC SQL `void`, como `ventas_asegurar_inventario_butacas`, siempre devuelve `data: null` sin error).
   */
  private async rpc<T>(nombre: string, args: Record<string, unknown>, accion: string): Promise<T> {
    const { data, error, status } = await this.cliente()
      .rpc(nombre, args)
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_BD_MS));
    if (!error) return data as T;
    const errorBd = error as ErrorBd | null;
    const traducido = errorBd?.code === "P0001" ? ERRORES_RPC[errorBd.message] : undefined;
    if (traducido) throw traducido(errorBd?.details ?? errorBd!.message);
    if (status === 0) {
      // Sin respuesta (tiempo límite o red): no se sabe si la BD lo confirmó.
      throw bdNoDisponible(`No se pudo confirmar la operación (${accion}). Recarga antes de repetirla.`);
    }
    this.logger.error(`La BD rechazó ${accion} (${status} ${errorBd?.code ?? ""}): ${errorBd?.message ?? "sin datos"}`);
    throw new InternalServerErrorException({ codigo: "ERROR_INTERNO", mensaje: `No se pudo ${accion}` });
  }

  private cliente(): NonNullable<ClienteSupabase> {
    if (!this.supabase) throw bdNoDisponible("Supabase no está configurado en la API");
    return this.supabase;
  }
}

function aOrden(fila: FilaOrden): Orden {
  return OrdenSchema.parse({
    id: fila.id,
    evento_id: fila.evento_id,
    categoria_id: fila.categoria_id,
    cantidad: fila.cantidad,
    precio_unitario_centimos: fila.precio_unitario_centimos,
    total_centimos: fila.total_centimos,
    estado: fila.estado,
    expira_en: fila.expira_en,
    ref: fila.ref ?? null,
    metodo_pago: fila.metodo_pago ?? null,
    pagada_en: fila.pagada_en ?? null,
    creado_en: fila.creado_en,
    asiento_id: fila.asiento_id ?? null,
  });
}

/** Excepción HTTP de cada código `P0001` de las RPC de ventas. */
const ERRORES_RPC: Record<string, (mensaje: string) => HttpException> = {
  [CODIGOS_VENTAS.VENTA_CERRADA]: (m) => new ConflictException({ codigo: CODIGOS_VENTAS.VENTA_CERRADA, mensaje: m }),
  [CODIGOS_VENTAS.SIN_CUPO]: (m) => new ConflictException({ codigo: CODIGOS_VENTAS.SIN_CUPO, mensaje: m }),
  [CODIGOS_VENTAS.CATEGORIA_NO_VALIDA]: (m) =>
    new BadRequestException({ codigo: CODIGOS_VENTAS.CATEGORIA_NO_VALIDA, mensaje: `categoria_id: ${m}` }),
  [CODIGOS_VENTAS.ASIENTO_NO_EXISTE]: (m) =>
    new NotFoundException({ codigo: CODIGOS_VENTAS.ASIENTO_NO_EXISTE, mensaje: m }),
  [CODIGOS_VENTAS.BUTACA_NO_DISPONIBLE]: (m) =>
    new ConflictException({ codigo: CODIGOS_VENTAS.BUTACA_NO_DISPONIBLE, mensaje: m }),
  [CODIGOS_VENTAS.ORDEN_NO_ENCONTRADA]: (m) =>
    new NotFoundException({ codigo: CODIGOS_VENTAS.ORDEN_NO_ENCONTRADA, mensaje: m }),
  [CODIGOS_VENTAS.ORDEN_NO_PENDIENTE]: (m) => ordenNoPendiente(m),
  [CODIGOS_VENTAS.COMISION_NO_CONFIGURADA]: (m) =>
    new ServiceUnavailableException({ codigo: CODIGOS_VENTAS.COMISION_NO_CONFIGURADA, mensaje: m }),
};

function codigoDe(e: ServiceUnavailableException): unknown {
  const respuesta = e.getResponse();
  return typeof respuesta === "object" && respuesta !== null ? (respuesta as { codigo?: unknown }).codigo : undefined;
}

function eventoNoEncontrado(): NotFoundException {
  return new NotFoundException({ codigo: CODIGOS_VENTAS.EVENTO_NO_ENCONTRADO, mensaje: "El evento no existe o no está a la venta" });
}

function ordenNoEncontrada(): NotFoundException {
  return new NotFoundException({ codigo: CODIGOS_VENTAS.ORDEN_NO_ENCONTRADA, mensaje: "La orden no existe" });
}

function ordenNoPendiente(mensaje: string): ConflictException {
  return new ConflictException({ codigo: CODIGOS_VENTAS.ORDEN_NO_PENDIENTE, mensaje });
}

function ordenExpirada(): ConflictException {
  return new ConflictException({
    codigo: CODIGOS_VENTAS.ORDEN_EXPIRADA,
    mensaje: "La reserva venció: el pago se anuló. Vuelve a elegir tus entradas.",
  });
}

function bdNoDisponible(mensaje: string): ServiceUnavailableException {
  return new ServiceUnavailableException({ codigo: CODIGOS_VENTAS.BD_NO_DISPONIBLE, mensaje });
}
