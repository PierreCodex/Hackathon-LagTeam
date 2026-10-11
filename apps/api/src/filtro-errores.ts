import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { ErrorApi } from "@reto18/shared";
import type { Response } from "express";

const CODIGOS: Record<number, string> = {
  400: "PETICION_INVALIDA",
  401: "NO_AUTENTICADO",
  403: "SIN_PERMISO",
  404: "NO_ENCONTRADO",
  409: "CONFLICTO",
  500: "ERROR_INTERNO",
  503: "SERVICIO_NO_DISPONIBLE",
};

/** Lee `{ codigo, mensaje }` del cuerpo de la excepción si quien la lanzó lo indicó. */
function errorDeRespuesta(respuesta: unknown): Partial<ErrorApi> {
  if (typeof respuesta !== "object" || respuesta === null) return {};
  const { codigo, mensaje, message, detalles } = respuesta as Record<string, unknown>;
  return {
    detalles:
      typeof detalles === "object" && detalles !== null && !Array.isArray(detalles)
        ? (detalles as Record<string, unknown>)
        : undefined,
    codigo: typeof codigo === "string" ? codigo : undefined,
    mensaje:
      typeof mensaje === "string"
        ? mensaje
        : Array.isArray(message)
          ? message.map(String).join("; ")
          : undefined,
  };
}

/** Da a todos los errores la forma `{ "error": { "codigo", "mensaje" } }`. */
@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly logger = new Logger(FiltroErrores.name);

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    let estado: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: ErrorApi = { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" };

    if (excepcion instanceof HttpException) {
      estado = excepcion.getStatus();
      const propio = errorDeRespuesta(excepcion.getResponse());
      error = {
        codigo: propio.codigo ?? CODIGOS[estado] ?? `HTTP_${estado}`,
        mensaje: propio.mensaje ?? excepcion.message,
        ...(propio.detalles ? { detalles: propio.detalles } : {}),
      };
      if (estado === HttpStatus.SERVICE_UNAVAILABLE) {
        // Dependencia caída y ya diagnosticada (Auth, BD): una línea basta, sin traza.
        this.logger.warn(`${error.codigo}: ${error.mensaje}`);
      } else if (estado >= 500) {
        this.logger.error(excepcion.stack);
      }
    } else {
      this.logger.error(excepcion instanceof Error ? excepcion.stack : String(excepcion));
    }

    res.status(estado).json({ error });
  }
}
