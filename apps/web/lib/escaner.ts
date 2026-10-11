import { CODIGOS_ACCESO, type ErrorApi, type ResultadoValidacion } from "@reto18/shared";
import type { TipoAviso } from "@/components/ui";
import { fechaPieza } from "./pieza";

/**
 * Lógica pura del escáner de la puerta (historia 8, Flow 3): qué aviso pintar tras validar un QR,
 * cuándo volver a procesar el mismo texto decodificado (para no mandar la misma imagen de la cámara
 * varias veces por segundo mientras sigue frente al lente) y cómo distinguir un permiso de cámara
 * negado de cualquier otro fallo al abrirla. Sin React ni cámara: así se prueba sin navegador real.
 */

export type EstadoAvisoEscaneo = { tipo: TipoAviso; titulo: string; detalle?: string };

/** 200 `aceptada`: la entrada queda usada y puede pasar. El resultado no cambia el mensaje (ver matriz I/O). */
export function avisoDeResultadoValidacion(resultado: ResultadoValidacion): EstadoAvisoEscaneo {
  void resultado;
  return { tipo: "exito", titulo: "Entrada aceptada. Puede pasar." };
}

/**
 * Error de `POST acceso/eventos/:eventoId/validar`. `ENTRADA_YA_USADA` trae la hora de uso en
 * `detalles.usada_en` (AD-7); el resto se pinta con el mensaje de la API tal cual.
 */
export function avisoDeErrorValidacion(error: Pick<ErrorApi, "codigo" | "mensaje" | "detalles">): EstadoAvisoEscaneo {
  if (error.codigo === CODIGOS_ACCESO.ENTRADA_YA_USADA) {
    const usadaEn = error.detalles?.usada_en;
    return {
      tipo: "advertencia",
      titulo: "Esta entrada ya se usó.",
      detalle: typeof usadaEn === "string" ? `Se usó el ${fechaPieza(usadaEn)}.` : error.mensaje,
    };
  }
  return { tipo: "error", titulo: "No se aceptó la entrada.", detalle: error.mensaje };
}

/** Ventana en la que se ignora el mismo texto decodificado, mientras sigue frente a la cámara. */
export const VENTANA_REPETIDO_MS = 3000;

/** `false` solo si es el mismo texto que la última vez y todavía no pasó la ventana. */
export function debeProcesarCodigo(ultimo: { texto: string; en: number } | null, texto: string, ahora: number): boolean {
  if (!ultimo || ultimo.texto !== texto) return true;
  return ahora - ultimo.en >= VENTANA_REPETIDO_MS;
}

/** El navegador negó `getUserMedia` (vs. otro fallo al abrir la cámara, p. ej. sin cámara en el dispositivo). */
export function esErrorPermisoCamara(error: unknown): boolean {
  const nombre = error instanceof Error ? error.name : undefined;
  return nombre === "NotAllowedError" || nombre === "PermissionDeniedError" || nombre === "SecurityError";
}

export const MENSAJE_PERMISO_CAMARA = "Dale permiso de cámara a esta página en tu navegador y vuelve a intentarlo.";
export const MENSAJE_SIN_CAMARA = "No pudimos usar la cámara en este dispositivo.";

/** Mensaje para la pantalla cuando no se pudo abrir la cámara, sin reintentar solo (el organizador recarga). */
export function mensajeErrorCamara(error: unknown): string {
  return esErrorPermisoCamara(error) ? MENSAJE_PERMISO_CAMARA : MENSAJE_SIN_CAMARA;
}
