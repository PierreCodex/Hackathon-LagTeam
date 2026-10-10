import { Module } from "@nestjs/common";
import { SaludModule } from "./salud/salud.module.js";
import { SupabaseModule } from "./supabase/supabase.module.js";

@Module({
  imports: [SupabaseModule, SaludModule],
})
export class AppModule {}
