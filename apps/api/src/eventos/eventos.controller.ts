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
  Param,
  PayloadTooLargeException,
  type PipeTransform,
  Post,
  Put,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import {
  CODIGOS_EVENTOS,
  type DuplicarSede,
  DuplicarSedeSchema,
  type Evento,
  type EventoCreado,
  IdSchema,
  type MapaSede,
  type MapaSedeEntrada,
  MapaSedeEntradaSchema,
  type SedeResumen,
  TAMANO_MAXIMO_ARCHIVO_EVENTO,
} from "@reto18/shared";
import type { Observable } from "rxjs";
import { Roles, UsuarioActual, type UsuarioAutenticado } from "../identidad/roles.js";
import { archivoNoValido } from "./archivos-eventos.js";
import { type ArchivosAlta, type EsquemaValidable, EventosService, validarConEsquema } from "./eventos.service.js";

/** Valida un `@Body` o un `@Param` con zod: si falla, 400 `DATOS_INVALIDOS` nombrando la ruta del campo. */
class ValidarCon<T> implements PipeTransform<unknown, T> {
  constructor(
    private readonly esquema: EsquemaValidable<T>,
    private readonly raiz: string,
  ) {}

  transform(valor: unknown): T {
    return validarConEsquema(this.esquema, valor, this.raiz);
  }
}

const ID_VALIDO = new ValidarCon(IdSchema, "id");
const MAPA_VALIDO = new ValidarCon(MapaSedeEntradaSchema, "mapa");

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

  /**
   * `GET /api/v1/eventos/sedes` (organizador): sedes compartidas para elegir en el alta.
   * `propia` dice si quien llama puede reemplazar su mapa (si no, puede usarla o duplicarla).
   */
  @Get("sedes")
  @Roles("organizador")
  sedes(@UsuarioActual() usuario: UsuarioAutenticado): Promise<SedeResumen[]> {
    return this.eventos.listarSedes(usuario.id);
  }

  /** `POST /api/v1/eventos/sedes` (organizador): crea una sede con su mapa (`MapaSedeEntradaSchema`). 201 con el `MapaSede`. */
  @Post("sedes")
  @Roles("organizador")
  @HttpCode(HttpStatus.CREATED)
  crearSede(@UsuarioActual() usuario: UsuarioAutenticado, @Body(MAPA_VALIDO) mapa: MapaSedeEntrada): Promise<MapaSede> {
    return this.eventos.crearSede(usuario.id, mapa);
  }

  /** `GET /api/v1/eventos/sedes/:id/mapa` (organizador o admin): el mapa de la sede, con sus ids. */
  @Get("sedes/:id/mapa")
  @Roles("organizador", "admin")
  leerMapa(@Param("id", ID_VALIDO) id: string): Promise<MapaSede> {
    return this.eventos.leerMapa(id);
  }

  /**
   * `PUT /api/v1/eventos/sedes/:id/mapa` (organizador dueño de la sede): reemplaza el mapa entero.
   * 403 `SEDE_AJENA` si no es suya; 409 `MAPA_CERRADO` si ya tiene un evento publicado.
   */
  @Put("sedes/:id/mapa")
  @Roles("organizador")
  guardarMapa(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param("id", ID_VALIDO) id: string,
    @Body(MAPA_VALIDO) mapa: MapaSedeEntrada,
  ): Promise<MapaSede> {
    return this.eventos.guardarMapa(usuario.id, id, mapa);
  }

  /** `POST /api/v1/eventos/sedes/:id/duplicar` (organizador): copia la sede a su nombre. 201 con el `MapaSede` nuevo. */
  @Post("sedes/:id/duplicar")
  @Roles("organizador")
  @HttpCode(HttpStatus.CREATED)
  duplicarSede(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param("id", ID_VALIDO) id: string,
    @Body(new ValidarCon(DuplicarSedeSchema, "datos")) datos: DuplicarSede,
  ): Promise<MapaSede> {
    return this.eventos.duplicarSede(usuario.id, id, datos.nombre);
  }

  /**
   * `POST /api/v1/eventos/:id/publicar` (organizador del evento): publica un evento aprobado y cierra
   * el mapa de su sede. 200 con el evento; repetirlo no cambia nada.
   */
  @Post(":id/publicar")
  @Roles("organizador")
  @HttpCode(HttpStatus.OK)
  publicar(@UsuarioActual() usuario: UsuarioAutenticado, @Param("id", ID_VALIDO) id: string): Promise<Evento> {
    return this.eventos.publicarEvento(usuario.id, id);
  }
}
