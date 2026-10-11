import {
  BadRequestException,
  Body,
  type CallHandler,
  Controller,
  type ExecutionContext,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
  Post,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { CODIGOS_EVENTOS, type EventoCreado, type SedeResumen, TAMANO_MAXIMO_ARCHIVO_EVENTO } from "@reto18/shared";
import type { Observable } from "rxjs";
import { Roles, UsuarioActual, type UsuarioAutenticado } from "../identidad/roles.js";
import { archivoNoValido } from "./archivos-eventos.js";
import { type ArchivosAlta, EventosService } from "./eventos.service.js";

const MultipartAlta = FileFieldsInterceptor(
  [
    { name: "foto", maxCount: 1 },
    { name: "constancia", maxCount: 1 },
  ],
  {
    // Memoria (por defecto): los archivos se validan y se suben a Storage; nunca tocan el disco.
    limits: { fileSize: TAMANO_MAXIMO_ARCHIVO_EVENTO, files: 2, fields: 5, fieldSize: 64 * 1024, parts: 7 },
  },
);

/** Mensajes de multer que son de un archivo (el resto son del formulario). */
const ERRORES_DE_ARCHIVO = ["Too many files", "Unexpected file field"];

/**
 * Lee el multipart del alta con multer y da a sus errores los códigos del módulo:
 * un archivo de más de 5 MB o un campo de archivo inesperado → 400 `ARCHIVO_NO_VALIDO`;
 * un formulario mal formado → 400 `DATOS_INVALIDOS`.
 */
@Injectable()
export class MultipartAltaInterceptor implements NestInterceptor {
  private readonly multer = new MultipartAlta();

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.multer.intercept(ctx, next);
    } catch (e) {
      if (e instanceof PayloadTooLargeException) throw archivoNoValido("El archivo pasa de 5 MB");
      if (e instanceof BadRequestException) {
        if (ERRORES_DE_ARCHIVO.some((m) => e.message.startsWith(m))) {
          throw archivoNoValido(`Solo se aceptan los archivos «foto» y «constancia», uno de cada (${e.message})`);
        }
        throw new BadRequestException({ codigo: CODIGOS_EVENTOS.DATOS_INVALIDOS, mensaje: `Formulario no válido: ${e.message}` });
      }
      throw e;
    }
  }
}

@Controller("eventos")
export class EventosController {
  constructor(@Inject(EventosService) private readonly eventos: EventosService) {}

  /**
   * `POST /api/v1/eventos` (organizador): alta multipart. Campo `datos` (JSON de `AltaEventoSchema`),
   * archivo `foto` y, si hay música, archivo `constancia`. Responde 201 con el evento `pendiente`.
   */
  @Post()
  @Roles("organizador")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(MultipartAltaInterceptor)
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body("datos") datos: unknown,
    @UploadedFiles() archivos: ArchivosAlta | undefined,
  ): Promise<EventoCreado> {
    return this.eventos.crear(usuario.id, datos, archivos ?? {});
  }

  /** `GET /api/v1/eventos/sedes` (organizador): sedes compartidas para elegir en el alta. */
  @Get("sedes")
  @Roles("organizador")
  sedes(): Promise<SedeResumen[]> {
    return this.eventos.listarSedes();
  }
}
