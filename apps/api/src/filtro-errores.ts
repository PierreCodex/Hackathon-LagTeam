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
};

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
      error = { codigo: CODIGOS[estado] ?? `HTTP_${estado}`, mensaje: excepcion.message };
    } else {
      this.logger.error(excepcion instanceof Error ? excepcion.stack : String(excepcion));
    }

    res.status(estado).json({ error });
  }
}
