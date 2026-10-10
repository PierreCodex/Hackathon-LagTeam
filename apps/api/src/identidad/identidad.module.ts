import { Module } from "@nestjs/common";
import { IdentidadController } from "./identidad.controller.js";
import { IdentidadService } from "./identidad.service.js";
import { VerificadorToken } from "./verificador-token.js";

/** Módulo `identidad`: perfiles y roles. Exporta su servicio para otros módulos (AD-2). */
@Module({
  controllers: [IdentidadController],
  providers: [IdentidadService, VerificadorToken],
  exports: [IdentidadService, VerificadorToken],
})
export class IdentidadModule {}
