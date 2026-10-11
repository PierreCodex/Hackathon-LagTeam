import { Body, Controller, Get, Header, Inject, Put, StreamableFile } from "@nestjs/common";
import { type Comision, ComisionSchema, type Tablero, type VentasOrganizador } from "@reto18/shared";
import { Roles, UsuarioActual, type UsuarioAutenticado } from "../identidad/roles.js";
import { tableroAExcel } from "./excel.js";
import { NegocioService } from "./negocio.service.js";

@Controller("negocio")
export class NegocioController {
  constructor(@Inject(NegocioService) private readonly negocio: NegocioService) {}

  /** `GET /api/v1/negocio/mis-ventas` (organizador): sus ventas por evento, categoría de precio y pieza. */
  @Get("mis-ventas")
  @Roles("organizador")
  misVentas(@UsuarioActual() usuario: UsuarioAutenticado): Promise<VentasOrganizador> {
    return this.negocio.ventasDe(usuario.id);
  }

  /** `GET /api/v1/negocio/tablero` (administrador): ventas, asistencia, categorías, público, liquidación y comisión. */
  @Get("tablero")
  @Roles("admin")
  tablero(): Promise<Tablero> {
    return this.negocio.tablero();
  }

  /** `GET /api/v1/negocio/tablero/excel` (administrador): el mismo tablero en `.xlsx`. */
  @Get("tablero/excel")
  @Roles("admin")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Disposition", 'attachment; filename="tablero-piura-cultural.xlsx"')
  async excel(): Promise<StreamableFile> {
    return new StreamableFile(await tableroAExcel(await this.negocio.tablero()));
  }

  /** `PUT /api/v1/negocio/comision` (administrador): nueva comisión; las órdenes pagadas conservan la suya (AD-10). */
  @Put("comision")
  @Roles("admin")
  cambiarComision(@Body({ schema: ComisionSchema }) comision: Comision): Promise<Comision> {
    return this.negocio.cambiarComision(comision);
  }
}
