import { Module } from "@nestjs/common";
import { AdaptadorOllama } from "./adaptador-ollama.js";
import { IaService } from "./ia.service.js";

/** Módulo `ia`: adaptador único del proveedor de IA (AD-11). */
@Module({
  providers: [AdaptadorOllama, IaService],
  exports: [IaService],
})
export class IaModule {}
