import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import type { Pieza } from "@reto18/shared";
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
}
