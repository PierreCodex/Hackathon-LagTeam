import { Body, Controller, Get, Header, Inject, Put, StreamableFile } from "@nestjs/common";
import { type Comision, ComisionSchema, type Tablero } from "@reto18/shared";
import { Roles } from "../identidad/roles.js";
import { tableroAExcel } from "./excel.js";
import { NegocioService } from "./negocio.service.js";

@Controller("negocio")
export class NegocioController {
  constructor(@Inject(NegocioService) private readonly negocio: NegocioService) {}

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
