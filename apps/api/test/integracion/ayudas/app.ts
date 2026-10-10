import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module.js";
import { configurarApp } from "../../../src/configurar-app.js";
import { entornoDePrueba } from "./supabase.js";

/**
 * La app NestJS real (los mismos módulos y la misma configuración que `main.ts`), en memoria
 * y conectada a la BD de prueba. Ciérrala con `await app.close()` en `afterAll`.
 */
export async function crearAppDePrueba(): Promise<INestApplication> {
  // SupabaseModule lee el entorno al construirse: se fija antes de compilar el módulo,
  // y siempre con la BD de prueba (nunca la del `.env` de desarrollo).
  const { url, claveServicio } = entornoDePrueba();
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = claveServicio;

  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication({ logger: ["error", "warn"] });
  configurarApp(app);
  await app.init();
  return app;
}
