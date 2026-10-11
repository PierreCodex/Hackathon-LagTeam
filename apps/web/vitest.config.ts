import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Las pruebas de componentes se pintan con react-dom/server: JSX automático y el alias "@/".
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["lib/**/*.spec.ts", "components/**/*.spec.tsx", "app/**/*.spec.{ts,tsx}"],
    environment: "node",
  },
});
