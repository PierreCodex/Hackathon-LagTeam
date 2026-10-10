import { Controller, Get, HttpStatus, Inject, Res } from "@nestjs/common";
import type { SaludRespuesta } from "@reto18/shared";
import type { Response } from "express";
import { SaludService } from "./salud.service.js";

@Controller("salud")
export class SaludController {
  constructor(@Inject(SaludService) private readonly salud: SaludService) {}

  /** `GET /api/v1/salud`: 200 si la base de datos responde, 503 si no. */
  @Get()
  async obtener(@Res({ passthrough: true }) res: Response): Promise<SaludRespuesta> {
    const respuesta = await this.salud.comprobar();
    res.status(respuesta.bd === "ok" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return respuesta;
  }
}
