import { defineConfig } from "vitest/config";

// Pruebas de integración: la app real contra Supabase local (ver README, "Pruebas de integración").
export default defineConfig({
  test: {
    include: ["test/integracion/**/*.int.spec.ts"],
    environment: "node",
    globalSetup: ["test/integracion/global-setup.ts"],
    setupFiles: ["test/integracion/ayudas/limpieza.ts"],
    // En serie: todas comparten la misma BD de prueba.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
