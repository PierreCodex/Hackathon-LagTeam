import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import { IdSchema, type ResultadoValidacion, type ValidarEntrada, ValidarEntradaSchema } from "@reto18/shared";
import { Roles, UsuarioActual, type UsuarioAutenticado } from "../identidad/roles.js";
import { AccesoService } from "./acceso.service.js";

@Controller("acceso")
export class AccesoController {
  constructor(@Inject(AccesoService) private readonly acceso: AccesoService) {}

  /**
   * `POST /api/v1/acceso/eventos/:eventoId/validar` (organizador dueño del evento o admin): valida el QR
   * y marca la entrada como usada. 200 `aceptada`; 409 `ENTRADA_YA_USADA` (con `detalles.usada_en`),
   * 409 `ENTRADA_DE_OTRO_EVENTO`, 400 `QR_INVALIDO`.
   */
  @Post("eventos/:eventoId/validar")
  @Roles("organizador", "admin")
  @HttpCode(HttpStatus.OK)
  validar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param("eventoId", { schema: IdSchema }) eventoId: string,
    @Body({ schema: ValidarEntradaSchema }) datos: ValidarEntrada,
  ): Promise<ResultadoValidacion> {
    return this.acceso.validar(usuario, eventoId, datos.qr);
  }
}
