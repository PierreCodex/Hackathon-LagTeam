import { createHmac, timingSafeEqual } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";
import { CODIGOS_VENTAS } from "@reto18/shared";

const FORMATO_QR = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

/** Firma de una entrada: HMAC-SHA256 del id con el secreto, en base64url (43 caracteres). */
export function firmaDe(entradaId: string, secreto: string): string {
  return createHmac("sha256", secreto).update(entradaId).digest("base64url");
}

/** Texto del QR de una entrada: `entrada_id.firma` (AD-7). */
export function firmarQr(entradaId: string, secreto: string): string {
  return `${entradaId}.${firmaDe(entradaId, secreto)}`;
}

/**
 * Verifica el texto de un QR y devuelve el id de la entrada, o `null` si el formato está roto o la
 * firma no coincide. La firma se compara en tiempo constante.
 */
export function verificarQr(qr: string, secreto: string): string | null {
  const partes = FORMATO_QR.exec(qr.trim());
  if (!partes) return null;
  const [, entradaId, firma] = partes as unknown as [string, string, string];
  const esperada = Buffer.from(firmaDe(entradaId, secreto));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  return entradaId;
}

/**
 * Firma y verificación de QR con `QR_SECRET` (AD-7). Sin secreto, ni se emiten ni se validan entradas.
 * Se crea con `useFactory` en `VentasModule`, que lee el entorno al construir la app.
 */
export class FirmaQr {
  private readonly secreto: string | null;

  constructor(secreto: string | undefined) {
    this.secreto = secreto?.trim() ? secreto : null;
  }

  /** Lanza 503 `QR_NO_CONFIGURADO` si falta el secreto (se comprueba antes de cobrar). */
  exigir(): string {
    if (!this.secreto) {
      throw new ServiceUnavailableException({
        codigo: CODIGOS_VENTAS.QR_NO_CONFIGURADO,
        mensaje: "La API no tiene QR_SECRET: no se pueden emitir ni validar entradas",
      });
    }
    return this.secreto;
  }

  firmar(entradaId: string): string {
    return firmarQr(entradaId, this.exigir());
  }

  verificar(qr: string): string | null {
    return verificarQr(qr, this.exigir());
  }
}
