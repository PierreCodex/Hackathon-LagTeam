import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configurarApp } from "./configurar-app.js";

async function arrancar(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configurarApp(app);

  const puerto = Number(process.env.PORT ?? 3001);
  await app.listen(puerto, "0.0.0.0");
  new Logger("Arranque").log(`API escuchando en el puerto ${puerto} (prefijo /api/v1)`);
}

void arrancar();
