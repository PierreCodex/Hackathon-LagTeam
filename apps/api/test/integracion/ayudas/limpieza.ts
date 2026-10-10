import { afterAll } from "vitest";
import { borrarUsuariosDePrueba } from "./tokens.js";

// Se carga antes de cada archivo de pruebas (`setupFiles`): nadie tiene que acordarse de limpiar.
afterAll(async () => {
  await borrarUsuariosDePrueba();
});
