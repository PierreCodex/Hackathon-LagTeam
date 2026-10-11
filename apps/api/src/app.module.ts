import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AccesoModule } from "./acceso/acceso.module.js";
import { EventosModule } from "./eventos/eventos.module.js";
import { IaModule } from "./ia/ia.module.js";
import { IdentidadModule } from "./identidad/identidad.module.js";
import { RolesGuard } from "./identidad/roles.js";
import { MarketingModule } from "./marketing/marketing.module.js";
import { NotificacionesModule } from "./notificaciones/notificaciones.module.js";
import { SaludModule } from "./salud/salud.module.js";
import { SupabaseModule } from "./supabase/supabase.module.js";
import { VentasModule } from "./ventas/ventas.module.js";

@Module({
  imports: [
    SupabaseModule,
    SaludModule,
    IdentidadModule,
    EventosModule,
    IaModule,
    MarketingModule,
    NotificacionesModule,
    VentasModule,
    AccesoModule,
  ],
  // Guard global de roles (AD-3): solo actúa en las rutas con `@Roles()`.
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule {}
