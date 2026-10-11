import { randomUUID } from "node:crypto";
import { Controller, Get, type INestApplication } from "@nestjs/common";
import { PerfilSchema } from "@reto18/shared";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Roles, UsuarioActual, type UsuarioAutenticado } from "../../src/identidad/roles.js";
import { crearAppDePrueba } from "./ayudas/app.js";
import { api } from "./ayudas/http.js";
import {
  clienteAdminDePrueba,
  clientePublicoDePrueba,
  entornoDePrueba,
} from "./ayudas/supabase.js";
import { type Rol, tokenPorRol, type UsuarioDePrueba } from "./ayudas/tokens.js";
import { DOMINIO_USUARIOS_DE_PRUEBA } from "./entorno.js";

/** Un endpoint por rol, solo para esta prueba: los protege el guard global real. */
@Controller("prueba-roles")
class PruebaRolesController {
  @Get("admin")
  @Roles("admin")
  admin(@UsuarioActual() u: UsuarioAutenticado) {
    return { rol: u.perfil.rol };
  }

  @Get("organizador")
  @Roles("organizador")
  organizador(@UsuarioActual() u: UsuarioAutenticado) {
    return { rol: u.perfil.rol };
  }

  @Get("publico")
  @Roles("publico")
  publico(@UsuarioActual() u: UsuarioAutenticado) {
    return { rol: u.perfil.rol };
  }
}

const ROLES: Rol[] = ["admin", "organizador", "publico"];

describe("identidad contra la BD de prueba", () => {
  let app: INestApplication;
  const usuarios = {} as Record<Rol, UsuarioDePrueba>;
  const registrados: string[] = [];

  beforeAll(async () => {
    app = await crearAppDePrueba([PruebaRolesController]);
    for (const rol of ROLES) usuarios[rol] = await tokenPorRol(rol);
  });

  afterAll(async () => {
    await app?.close();
    const admin = clienteAdminDePrueba();
    await Promise.all(registrados.map((id) => admin.auth.admin.deleteUser(id)));
  });

  describe("guard @Roles() con tres tokens reales", () => {
    for (const rolToken of ROLES) {
      for (const rolRuta of ROLES) {
        const esperado = rolToken === rolRuta ? 200 : 403;
        it(`token ${rolToken} en el endpoint de ${rolRuta} → ${esperado}`, async () => {
          const respuesta = await api(app, usuarios[rolToken].token).get(`/api/v1/prueba-roles/${rolRuta}`);

          expect(respuesta.status).toBe(esperado);
          if (esperado === 200) {
            expect(respuesta.body).toEqual({ rol: rolToken });
          } else {
            expect(respuesta.body.error.codigo).toBe("SIN_PERMISO");
          }
        });
      }
    }

    it("sin token → 401 NO_AUTENTICADO", async () => {
      const respuesta = await api(app).get("/api/v1/prueba-roles/admin");

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.codigo).toBe("NO_AUTENTICADO");
    });

    it("GET /api/v1/salud sigue respondiendo sin token", async () => {
      const respuesta = await api(app).get("/api/v1/salud");

      expect(respuesta.status).toBe(200);
    });
  });

  describe("registro y perfil", () => {
    it("POST /registro crea la cuenta y el perfil, y GET /perfil lo devuelve con su token", async () => {
      const correo = `registro-${randomUUID()}@${DOMINIO_USUARIOS_DE_PRUEBA}`;
      const contrasena = `Prueba-${randomUUID()}`;

      const registro = await api(app).post("/api/v1/identidad/registro").send({
        correo,
        contrasena,
        rol: "organizador",
        whatsapp: "987 654 321",
        ciudad: "  Piura  ",
        acepta_avisos: true,
      });

      expect(registro.status).toBe(201);
      registrados.push(registro.body.id);
      expect(PerfilSchema.parse(registro.body)).toMatchObject({
        correo,
        rol: "organizador",
        whatsapp: "+51987654321",
        ciudad: "Piura",
        acepta_avisos: true,
      });

      const { data: sesion, error } = await clientePublicoDePrueba().auth.signInWithPassword({
        email: correo,
        password: contrasena,
      });
      expect(error).toBeNull();

      const perfil = await api(app, sesion.session?.access_token).get("/api/v1/identidad/perfil");

      expect(perfil.status).toBe(200);
      expect(perfil.body).toEqual(registro.body);
    });

    it("el mismo correo otra vez → 409 CORREO_YA_REGISTRADO", async () => {
      const correo = `repetido-${randomUUID()}@${DOMINIO_USUARIOS_DE_PRUEBA}`;
      const cuerpo = {
        correo,
        contrasena: `Prueba-${randomUUID()}`,
        rol: "publico",
        whatsapp: "912345678",
        acepta_avisos: false,
      };

      const primero = await api(app).post("/api/v1/identidad/registro").send(cuerpo);
      registrados.push(primero.body.id);
      const segundo = await api(app).post("/api/v1/identidad/registro").send(cuerpo);

      expect(primero.status).toBe(201);
      expect(segundo.status).toBe(409);
      expect(segundo.body.error.codigo).toBe("CORREO_YA_REGISTRADO");
    });
  });

  describe("identidad_perfiles cerrada a la web (AD-1)", () => {
    function clienteConToken(token: string) {
      const { url, clavePublica } = entornoDePrueba();
      return createClient(url, clavePublica, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
    }

    const clientes = () => ({
      "clave anon": clientePublicoDePrueba(),
      "JWT de un usuario": clienteConToken(usuarios.publico.token),
    });

    it.each(["clave anon", "JWT de un usuario"] as const)("con la %s, select no devuelve filas", async (quien) => {
      const { data } = await clientes()[quien].from("identidad_perfiles").select("id, rol");

      expect(data ?? []).toEqual([]);
    });

    it.each(["clave anon", "JWT de un usuario"] as const)(
      "con la %s, insert y update de rol admin se rechazan",
      async (quien) => {
        const cliente = clientes()[quien];
        const { id } = usuarios.publico;

        const insercion = await cliente
          .from("identidad_perfiles")
          .insert({ id: randomUUID(), rol: "admin", whatsapp: "+51987654321" });
        await cliente.from("identidad_perfiles").update({ rol: "admin" }).eq("id", id);

        expect(insercion.error).not.toBeNull();
        const { data } = await clienteAdminDePrueba()
          .from("identidad_perfiles")
          .select("rol")
          .eq("id", id)
          .single();
        expect(data?.rol).toBe("publico");
      },
    );
  });
});
