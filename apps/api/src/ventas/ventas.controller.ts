import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import {
  type CrearOrden,
  CrearOrdenSchema,
  type MiEntrada,
  type Orden,
  OrdenIdSchema,
  type OrdenPagada,
  type PagarOrden,
  PagarOrdenSchema,
} from "@reto18/shared";
import { Roles, UsuarioActual, type UsuarioAutenticado } from "../identidad/roles.js";
import { VentasService } from "./ventas.service.js";

@Controller("ventas")
export class VentasController {
  constructor(@Inject(VentasService) private readonly ventas: VentasService) {}

  /**
   * `POST /api/v1/ventas/ordenes` (cualquier cuenta con perfil): orden `pendiente` de zona general
   * que reserva el cupo 10 minutos. 201 con la orden.
   */
  @Post("ordenes")
  @Roles()
  @HttpCode(HttpStatus.CREATED)
  crear(@UsuarioActual() usuario: UsuarioAutenticado, @Body({ schema: CrearOrdenSchema }) datos: CrearOrden): Promise<Orden> {
    return this.ventas.crearOrden(usuario.id, datos);
  }

  /**
   * `POST /api/v1/ventas/ordenes/:id/pagar` (dueño de la orden): pago simulado. 200 con la orden
   * `pagada` y sus entradas con QR; el aviso de WhatsApp queda en la bandeja de salida.
   */
  @Post("ordenes/:id/pagar")
  @Roles()
  @HttpCode(HttpStatus.OK)
  pagar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param("id", { schema: OrdenIdSchema }) id: string,
    @Body({ schema: PagarOrdenSchema }) datos: PagarOrden,
  ): Promise<OrdenPagada> {
    return this.ventas.pagar({ id: usuario.id, telefono: usuario.perfil.whatsapp }, id, datos.metodo);
  }

  /** `GET /api/v1/ventas/mis-entradas` (cualquier cuenta con perfil): sus entradas con evento y QR. */
  @Get("mis-entradas")
  @Roles()
  misEntradas(@UsuarioActual() usuario: UsuarioAutenticado): Promise<MiEntrada[]> {
    return this.ventas.misEntradas(usuario.id);
  }
}
