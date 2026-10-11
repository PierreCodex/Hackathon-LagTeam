import { type INestApplication, StandardSchemaValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { FiltroErrores } from "./filtro-errores.js";

/**
 * Configuración común de la app: la usan `main.ts` y las pruebas de integración,
 * para que lo que se prueba sea lo mismo que se despliega.
 */
export function configurarApp(app: INestApplication): void {
  app.setGlobalPrefix("api/v1");
  // Un mapa de sede grande (hasta 5000 asientos, `LIMITES_MAPA`) roza el límite por defecto de express (100 kB).
  (app as NestExpressApplication).useBodyParser("json", { limit: "512kb" });
  app.useGlobalFilters(new FiltroErrores());
  // Valida `@Body({ schema })`, `@Query({ schema })` y `@Param({ schema })` con zod (Standard Schema).
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  // CORS solo para la web (la página de salud llama desde el servidor y no lo necesita).
  const webUrl = process.env.WEB_URL;
  if (webUrl) {
    app.enableCors({ origin: webUrl.split(",").map((origen) => origen.trim().replace(/\/+$/, "")) });
  }
}
