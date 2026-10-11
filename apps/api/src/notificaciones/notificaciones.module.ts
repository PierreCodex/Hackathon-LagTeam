import { Module } from "@nestjs/common";
import { NotificacionesService } from "./notificaciones.service.js";

/** Módulo `notificaciones`: bandeja de salida de WhatsApp (`notificaciones_*`, AD-9). */
@Module({
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
