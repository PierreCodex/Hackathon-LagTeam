import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import type { NextConfig } from "next";

// En local, las variables viven en el `.env` de la raíz del monorepo.
// De ahí solo se copian API_URL y las variables públicas de Supabase (URL y clave anon):
// la web nunca recibe la clave de servicio (AD-1).
// En Vercel no existe ese archivo: las variables se cargan en el proyecto.
const COPIAR = ["API_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

try {
  const raiz = parseEnv(readFileSync(path.resolve(process.cwd(), "../../.env"), "utf8"));
  for (const nombre of COPIAR) {
    if (!process.env[nombre] && raiz[nombre]) {
      process.env[nombre] = raiz[nombre];
    }
  }
  // La URL del proyecto es pública: si no hay una propia de la web, sirve la de la API.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && raiz.SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = raiz.SUPABASE_URL;
  }
} catch {
  // Sin `.env` en la raíz: se usan las variables del entorno.
}

const nextConfig: NextConfig = {
  transpilePackages: ["@reto18/shared"],
};

export default nextConfig;
