import type { INestApplication } from "@nestjs/common";
import request from "supertest";

type Metodo = "get" | "post" | "put" | "patch" | "delete";

/**
 * Llamadas HTTP a la app de prueba, con `Authorization: Bearer <token>` si se da un token.
 * La ruta es completa, con el prefijo: `api(app, token).get("/api/v1/salud")`.
 */
export function api(app: INestApplication, token?: string) {
  const agente = request(app.getHttpServer());
  const llamar = (metodo: Metodo) => (ruta: string) => {
    const peticion = agente[metodo](ruta);
    return token ? peticion.set("Authorization", `Bearer ${token}`) : peticion;
  };
  return {
    get: llamar("get"),
    post: llamar("post"),
    put: llamar("put"),
    patch: llamar("patch"),
    delete: llamar("delete"),
  };
}
