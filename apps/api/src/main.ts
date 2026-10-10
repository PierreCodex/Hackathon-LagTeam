import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { FiltroErrores } from "./filtro-errores.js";

async function arrancar(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new FiltroErrores());

  // CORS solo para la web (la página de salud llama desde el servidor y no lo necesita).
  const webUrl = process.env.WEB_URL;
  if (webUrl) {
    app.enableCors({ origin: webUrl.split(",").map((origen) => origen.trim().replace(/\/+$/, "")) });
  }

  const puerto = Number(process.env.PORT ?? 3001);
  await app.listen(puerto, "0.0.0.0");
  new Logger("Arranque").log(`API escuchando en el puerto ${puerto} (prefijo /api/v1)`);
}

void arrancar();
