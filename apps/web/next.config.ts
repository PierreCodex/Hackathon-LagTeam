import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import type { NextConfig } from "next";

// En local, las variables viven en el `.env` de la raíz del monorepo.
// De ahí solo se copia API_URL: la web nunca recibe la clave de servicio (AD-1).
// En Vercel no existe ese archivo: las variables se cargan en el proyecto.
try {
  const raiz = parseEnv(readFileSync(path.resolve(process.cwd(), "../../.env"), "utf8"));
  if (!process.env.API_URL && raiz.API_URL) {
    process.env.API_URL = raiz.API_URL;
  }
} catch {
  // Sin `.env` en la raíz: se usan las variables del entorno.
}

const nextConfig: NextConfig = {
  transpilePackages: ["@reto18/shared"],
};

export default nextConfig;
