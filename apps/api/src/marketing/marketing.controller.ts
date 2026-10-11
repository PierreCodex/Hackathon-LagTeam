import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import {
  type ClicRegistrado,
  type CrearEnlace,
  CrearEnlaceSchema,
  type Enlace,
  type Pieza,
  type ResultadosPieza,
} from "@reto18/shared";
import { Roles, UsuarioActual, type UsuarioAutenticado } from "../identidad/roles.js";
import { MarketingService } from "./marketing.service.js";

@Controller("marketing")
export class MarketingController {
  constructor(@Inject(MarketingService) private readonly marketing: MarketingService) {}

  /**
   * `POST /api/v1/marketing/eventos/:eventoId/piezas` (organizador dueño, evento aprobado):
   * genera textos, paleta y campaña con la IA (o el respaldo) y guarda la pieza. 201 con la pieza.
   */
  @Post("eventos/:eventoId/piezas")
  @Roles("organizador")
  @HttpCode(HttpStatus.CREATED)
  generar(@UsuarioActual() usuario: UsuarioAutenticado, @Param("eventoId") eventoId: string): Promise<Pieza> {
    return this.marketing.generarPieza(usuario.id, eventoId);
  }

  /** `GET /api/v1/marketing/piezas/:id` (público): la pieza con los datos actuales del evento. */
  @Get("piezas/:id")
  obtener(@Param("id") id: string): Promise<Pieza> {
    return this.marketing.obtenerPieza(id);
  }

  /**
   * `POST /api/v1/marketing/piezas/:id/enlaces` (organizador dueño): crea un enlace rastreable
   * `<web>/r/:codigo` de la pieza, con red y zona opcionales (AD-8). 201 con el enlace.
   */
  @Post("piezas/:id/enlaces")
  @Roles("organizador")
  @HttpCode(HttpStatus.CREATED)
  crearEnlace(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param("id") id: string,
    @Body({ schema: CrearEnlaceSchema }) datos: CrearEnlace,
  ): Promise<Enlace> {
    return this.marketing.crearEnlace(usuario.id, id, datos);
  }

  /** `GET /api/v1/marketing/piezas/:id/resultados` (organizador dueño): clics y ventas por enlace y en total. */
  @Get("piezas/:id/resultados")
  @Roles("organizador")
  resultados(@UsuarioActual() usuario: UsuarioAutenticado, @Param("id") id: string): Promise<ResultadosPieza> {
    return this.marketing.resultadosPieza(usuario.id, id);
  }

  /**
   * `POST /api/v1/marketing/enlaces/:codigo/clics` (público, lo llama la web en `/r/:codigo`):
   * registra el clic sin datos personales. 201 con el evento al que redirigir.
   */
  @Post("enlaces/:codigo/clics")
  @HttpCode(HttpStatus.CREATED)
  registrarClic(@Param("codigo") codigo: string): Promise<ClicRegistrado> {
    return this.marketing.registrarClic(codigo);
  }
}
