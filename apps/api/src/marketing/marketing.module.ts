import { Module } from "@nestjs/common";
import { EventosModule } from "../eventos/eventos.module.js";
import { IaModule } from "../ia/ia.module.js";
import { VentasModule } from "../ventas/ventas.module.js";
import { MarketingController } from "./marketing.controller.js";
import { MarketingService } from "./marketing.service.js";
import { PublicadorUploadPost } from "./publicador-upload-post.js";

/**
 * Módulo `marketing`: piezas, enlaces rastreables y clics (`marketing_*`). Lee eventos solo por
 * `EventosService` y ventas solo por `VentasService.ventasPorRef` (AD-2, AD-8). Exporta su servicio
 * para `negocio` (epic 4).
 */
@Module({
  imports: [EventosModule, IaModule, VentasModule],
  controllers: [MarketingController],
  providers: [MarketingService, PublicadorUploadPost],
  exports: [MarketingService],
})
export class MarketingModule {}
