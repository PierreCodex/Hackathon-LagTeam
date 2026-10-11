import { Module } from "@nestjs/common";
import { ArchivosEventos } from "./archivos-eventos.js";
import { EventosController, MultipartAltaInterceptor } from "./eventos.controller.js";
import { EventosService } from "./eventos.service.js";

/** Módulo `eventos`: alta de eventos del organizador y sedes compartidas (AD-2). */
@Module({
  controllers: [EventosController],
  providers: [EventosService, ArchivosEventos, MultipartAltaInterceptor],
  exports: [EventosService],
})
export class EventosModule {}
