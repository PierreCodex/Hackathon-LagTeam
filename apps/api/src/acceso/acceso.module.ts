import { Module } from "@nestjs/common";
import { VentasModule } from "../ventas/ventas.module.js";
import { AccesoController } from "./acceso.controller.js";
import { AccesoService } from "./acceso.service.js";

/** Módulo `acceso`: validación de QR en la puerta (AD-7). Depende solo de `ventas` (AD-2). */
@Module({
  imports: [VentasModule],
  controllers: [AccesoController],
  providers: [AccesoService],
})
export class AccesoModule {}
