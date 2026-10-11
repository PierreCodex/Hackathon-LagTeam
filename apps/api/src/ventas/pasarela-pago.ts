import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import type { MetodoPago } from "@reto18/shared";

/** Token de inyección de la pasarela de pago de `ventas` (AD-6). */
export const PASARELA_PAGO = Symbol("PASARELA_PAGO");

/** Cobro de una orden. Nunca lleva datos de tarjeta: una pasarela real usará checkout alojado (AD-6). */
export interface Cobro {
  orden_id: string;
  importe_centimos: number;
  metodo: MetodoPago;
}

export interface CobroConfirmado {
  /** Referencia del cobro en la pasarela; sirve para anularlo. */
  referencia: string;
}

/** Interfaz de la pasarela. Una pasarela real entra como otra implementación. */
export interface PasarelaPago {
  /** Cobra la orden. Lanza si la pasarela rechaza el pago. */
  cobrar(cobro: Cobro): Promise<CobroConfirmado>;
  /** Anula un cobro confirmado (p. ej. un pago que llegó tras vencer la orden). */
  anular(referencia: string): Promise<void>;
}

const METODOS: readonly MetodoPago[] = ["tarjeta", "yape", "plin"];

/** Pasarela simulada de la demo: tarjeta, Yape o Plin, sin cargo real. Siempre confirma un cobro válido. */
@Injectable()
export class PasarelaPagoSimulada implements PasarelaPago {
  private readonly logger = new Logger(PasarelaPagoSimulada.name);

  async cobrar(cobro: Cobro): Promise<CobroConfirmado> {
    if (!Number.isInteger(cobro.importe_centimos) || cobro.importe_centimos < 0) {
      throw new Error(`Importe no válido: ${cobro.importe_centimos}`);
    }
    if (!METODOS.includes(cobro.metodo)) {
      throw new Error(`Método de pago no válido: ${String(cobro.metodo)}`);
    }
    return { referencia: `sim_${cobro.metodo}_${randomUUID()}` };
  }

  async anular(referencia: string): Promise<void> {
    if (!referencia.startsWith("sim_")) {
      throw new Error(`Referencia desconocida en la pasarela simulada: ${referencia}`);
    }
    this.logger.log(`Cobro simulado anulado: ${referencia}`);
  }
}
