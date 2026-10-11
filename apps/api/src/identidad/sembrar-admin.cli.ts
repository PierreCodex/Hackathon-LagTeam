/** Punto de entrada de `pnpm --filter @reto18/api sembrar:admin`. La lógica está en `sembrar-admin.ts`. */
import { ejecutarSembrado } from "./sembrar-admin.js";

ejecutarSembrado(process.env, process.argv.slice(2)).then(
  (mensaje) => console.log(mensaje),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  },
);
