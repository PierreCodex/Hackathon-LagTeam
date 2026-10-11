import { type INestApplication, StandardSchemaValidationPipe } from "@nestjs/common";
import { FiltroErrores } from "./filtro-errores.js";

/**
 * Configuración común de la app: la usan `main.ts` y las pruebas de integración,
 * para que lo que se prueba sea lo mismo que se despliega.
 */
export function configurarApp(app: INestApplication): void {
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new FiltroErrores());
  // Valida `@Body({ schema })`, `@Query({ schema })` y `@Param({ schema })` con zod (Standard Schema).
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  // CORS solo para la web (la página de salud llama desde el servidor y no lo necesita).
  const webUrl = process.env.WEB_URL;
  if (webUrl) {
    app.enableCors({ origin: webUrl.split(",").map((origen) => origen.trim().replace(/\/+$/, "")) });
  }
}
