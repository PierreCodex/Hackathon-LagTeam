import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { IdentidadModule } from "./identidad/identidad.module.js";
import { RolesGuard } from "./identidad/roles.js";
import { SaludModule } from "./salud/salud.module.js";
import { SupabaseModule } from "./supabase/supabase.module.js";

@Module({
  imports: [SupabaseModule, SaludModule, IdentidadModule],
  // Guard global de roles (AD-3): solo actúa en las rutas con `@Roles()`.
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule {}
