import { Module } from "@nestjs/common";
import { EventosModule } from "../eventos/eventos.module.js";
import { NotificacionesModule } from "../notificaciones/notificaciones.module.js";
import { PASARELA_PAGO, PasarelaPagoSimulada } from "./pasarela-pago.js";
import { FirmaQr } from "./qr.js";
import { VentasController } from "./ventas.controller.js";
import { VentasService } from "./ventas.service.js";

/**
 * Módulo `ventas`: cupos, órdenes, pagos, entradas y comisión (`ventas_*`). Lee eventos solo por
 * `EventosService` y avisa solo por `NotificacionesService` (AD-2). Exporta su servicio (`ventasPorRef`,
 * `consumirEntrada`) y la firma de QR para `acceso`.
 */
@Module({
  imports: [EventosModule, NotificacionesModule],
  controllers: [VentasController],
  providers: [
    VentasService,
    { provide: PASARELA_PAGO, useClass: PasarelaPagoSimulada },
    // Se lee al construir la app: las pruebas fijan QR_SECRET antes de crearla.
    { provide: FirmaQr, useFactory: () => new FirmaQr(process.env.QR_SECRET) },
  ],
  exports: [VentasService, FirmaQr],
})
export class VentasModule {}
