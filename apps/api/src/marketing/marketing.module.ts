import { Module } from "@nestjs/common";
import { EventosModule } from "../eventos/eventos.module.js";
import { IaModule } from "../ia/ia.module.js";
import { MarketingController } from "./marketing.controller.js";
import { MarketingService } from "./marketing.service.js";

/** Módulo `marketing`: piezas de los eventos (`marketing_*`). Lee eventos solo por `EventosService` (AD-2). */
@Module({
  imports: [EventosModule, IaModule],
  controllers: [MarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
