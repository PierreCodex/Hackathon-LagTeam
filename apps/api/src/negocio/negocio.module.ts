import { Module } from "@nestjs/common";
import { EventosModule } from "../eventos/eventos.module.js";
import { IdentidadModule } from "../identidad/identidad.module.js";
import { MarketingModule } from "../marketing/marketing.module.js";
import { VentasModule } from "../ventas/ventas.module.js";
import { NegocioController } from "./negocio.controller.js";
import { NegocioService } from "./negocio.service.js";

/** Módulo `negocio` (epic 4): panel de ventas del organizador, comisión, liquidación y tablero del administrador. Sin tablas propias (AD-2). */
@Module({
  imports: [EventosModule, IdentidadModule, MarketingModule, VentasModule],
  controllers: [NegocioController],
  providers: [NegocioService],
})
export class NegocioModule {}
