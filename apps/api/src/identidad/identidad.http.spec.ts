import "reflect-metadata";
import type { AddressInfo } from "node:net";
import { Controller, Get, Global, type INestApplication, Module } from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { AuthInvalidJwtError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { configurarApp } from "../configurar-app.js";
import { SUPABASE_CLIENTE, type ClienteSupabase } from "../supabase/supabase.module.js";
import { IdentidadModule } from "./identidad.module.js";
import { Roles, RolesGuard, UsuarioActual, type UsuarioAutenticado } from "./roles.js";

const IDS = {
  admin: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  organizador: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  publico: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  sinPerfil: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  bdCaida: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  nuevo: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
} as const;

/** Tokens simulados → resultado de `auth.getClaims`. */
const TOKENS: Record<string, () => Promise<unknown>> = {
  "token-admin": async () => ({
    data: { claims: { sub: IDS.admin, email: "admin@ejemplo.pe" } },
    error: null,
  }),
  "token-organizador": async () => ({
    data: { claims: { sub: IDS.organizador, email: "org@ejemplo.pe" } },
    error: null,
  }),
  "token-publico": async () => ({
    data: { claims: { sub: IDS.publico, email: "pub@ejemplo.pe", role: "admin" } },
    error: null,
  }),
  "token-sin-perfil": async () => ({
    data: { claims: { sub: IDS.sinPerfil, email: "nadie@ejemplo.pe" } },
    error: null,
  }),
  "token-bd-caida": async () => ({
    data: { claims: { sub: IDS.bdCaida, email: "bd@ejemplo.pe" } },
    error: null,
  }),
  "token-auth-caido": async () => ({
    data: null,
    error: new AuthRetryableFetchError("fetch failed", 0),
  }),
};

const perfiles = new Map<string, Record<string, unknown>>();
const createUser = vi.fn();
const deleteUser = vi.fn(async () => ({ data: {}, error: null }));

/** Cliente de Supabase simulado: Auth (tokens y admin) y la tabla `identidad_perfiles`. */
const clienteFalso = {
  auth: {
    getClaims: async (jwt: string) =>
      (TOKENS[jwt] ?? (async () => ({ data: null, error: new AuthInvalidJwtError("Invalid JWT") })))(),
    admin: { createUser, deleteUser, getUserById: async () => ({ data: { user: null }, error: null }) },
  },
  from: () => {
    let fila: Record<string, unknown> | undefined;
    let id: unknown;
    const consulta = {
      insert: (nueva: Record<string, unknown>) => {
        fila = nueva;
        return consulta;
      },
      select: () => consulta,
      eq: (_columna: string, valor: unknown) => {
        id = valor;
        return consulta;
      },
      abortSignal: () => consulta,
      single: async () => {
        if (fila) perfiles.set(String(fila.id), fila);
        return { data: fila ?? null, error: null };
      },
      maybeSingle: async () =>
        id === IDS.bdCaida
          ? { data: null, error: { message: "canceling statement due to statement timeout" } }
          : { data: perfiles.get(String(id)) ?? null, error: null },
    };
    return consulta;
  },
} as unknown as ClienteSupabase;

@Global()
@Module({
  providers: [{ provide: SUPABASE_CLIENTE, useValue: clienteFalso }],
  exports: [SUPABASE_CLIENTE],
})
class SupabaseFalsoModule {}

/** Un endpoint por rol, más uno público sin decorador. */
@Controller("prueba")
class PruebaController {
  @Get("publica")
  publica() {
    return { ok: true };
  }

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

@Module({
  imports: [SupabaseFalsoModule, IdentidadModule],
  controllers: [PruebaController],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
class PruebaModule {}

type CuerpoRespuesta = Record<string, unknown> & { error: { codigo: string; mensaje: string } };

let app: INestApplication;
let base: string;

async function llamar(ruta: string, opciones: { token?: string; cuerpo?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opciones.token) headers.authorization = `Bearer ${opciones.token}`;
  if (opciones.cuerpo !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${base}${ruta}`, {
    method: opciones.cuerpo !== undefined ? "POST" : "GET",
    headers,
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  });
  return { estado: res.status, cuerpo: (await res.json()) as CuerpoRespuesta };
}

function filaPerfil(id: string, rol: string) {
  return { id, rol, whatsapp: "+51987654321", ciudad: "Piura", acepta_avisos: true };
}

beforeAll(async () => {
  app = await NestFactory.create(PruebaModule, { logger: false });
  configurarApp(app);
  await app.listen(0, "127.0.0.1");
  const { port } = app.getHttpServer().address() as AddressInfo;
  base = `http://127.0.0.1:${port}/api/v1`;
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  perfiles.clear();
  perfiles.set(IDS.admin, filaPerfil(IDS.admin, "admin"));
  perfiles.set(IDS.organizador, filaPerfil(IDS.organizador, "organizador"));
  perfiles.set(IDS.publico, filaPerfil(IDS.publico, "publico"));
  createUser.mockReset();
  deleteUser.mockClear();
});

describe("RolesGuard por HTTP", () => {
  const roles = ["admin", "organizador", "publico"] as const;

  for (const rolToken of roles) {
    for (const rolRuta of roles) {
      const esperado = rolToken === rolRuta ? 200 : 403;
      it(`token ${rolToken} en el endpoint de ${rolRuta} → ${esperado}`, async () => {
        const { estado, cuerpo } = await llamar(`/prueba/${rolRuta}`, { token: `token-${rolToken}` });
        expect(estado).toBe(esperado);
        if (esperado === 200) {
          expect(cuerpo).toEqual({ rol: rolToken });
        } else {
          expect(cuerpo).toEqual({ error: { codigo: "SIN_PERMISO", mensaje: expect.any(String) } });
        }
      });
    }
  }

  it("el rol sale del perfil, no del JWT (claim role=admin con perfil público → 403)", async () => {
    const { estado } = await llamar("/prueba/admin", { token: "token-publico" });
    expect(estado).toBe(403);
  });

  it("las rutas sin @Roles() siguen siendo públicas", async () => {
    expect(await llamar("/prueba/publica")).toEqual({ estado: 200, cuerpo: { ok: true } });
  });

  it("sin Authorization → 401 NO_AUTENTICADO", async () => {
    const { estado, cuerpo } = await llamar("/prueba/admin");
    expect(estado).toBe(401);
    expect(cuerpo.error.codigo).toBe("NO_AUTENTICADO");
  });

  it("token falso o caducado → 401 NO_AUTENTICADO", async () => {
    const { estado, cuerpo } = await llamar("/prueba/admin", { token: "token-falso" });
    expect(estado).toBe(401);
    expect(cuerpo.error.codigo).toBe("NO_AUTENTICADO");
  });

  it("token válido sin perfil → 403 SIN_PERFIL", async () => {
    const { estado, cuerpo } = await llamar("/identidad/perfil", { token: "token-sin-perfil" });
    expect(estado).toBe(403);
    expect(cuerpo.error.codigo).toBe("SIN_PERFIL");
  });

  it("Auth no disponible → 503 AUTH_NO_DISPONIBLE", async () => {
    const { estado, cuerpo } = await llamar("/identidad/perfil", { token: "token-auth-caido" });
    expect(estado).toBe(503);
    expect(cuerpo.error.codigo).toBe("AUTH_NO_DISPONIBLE");
  });
});

describe("RolesGuard con la base de datos caída", () => {
  it("falla la lectura del perfil → 503 BD_NO_DISPONIBLE", async () => {
    const { estado, cuerpo } = await llamar("/identidad/perfil", { token: "token-bd-caida" });
    expect(estado).toBe(503);
    expect(cuerpo.error.codigo).toBe("BD_NO_DISPONIBLE");
  });
});

describe("GET /identidad/perfil", () => {
  it("devuelve el perfil de la cuenta que llama", async () => {
    const { estado, cuerpo } = await llamar("/identidad/perfil", { token: "token-organizador" });
    expect(estado).toBe(200);
    expect(cuerpo).toEqual({
      id: IDS.organizador,
      correo: "org@ejemplo.pe",
      rol: "organizador",
      whatsapp: "+51987654321",
      ciudad: "Piura",
      acepta_avisos: true,
    });
  });
});

describe("POST /identidad/registro", () => {
  const valido = {
    correo: "nueva@ejemplo.pe",
    contrasena: "secreta123",
    rol: "organizador",
    whatsapp: "987 654 321",
    acepta_avisos: true,
  };

  it("registro válido → 201 con el perfil y el WhatsApp en E.164", async () => {
    createUser.mockResolvedValue({ data: { user: { id: IDS.nuevo, email: valido.correo } }, error: null });

    const { estado, cuerpo } = await llamar("/identidad/registro", { cuerpo: valido });

    expect(estado).toBe(201);
    expect(cuerpo).toEqual({
      id: IDS.nuevo,
      correo: "nueva@ejemplo.pe",
      rol: "organizador",
      whatsapp: "+51987654321",
      ciudad: null,
      acepta_avisos: true,
    });
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ email_confirm: true }));
  });

  it.each([
    ["rol admin", { ...valido, rol: "admin" }, "rol"],
    ["WhatsApp no válido", { ...valido, whatsapp: "12345" }, "whatsapp"],
    ["contraseña corta", { ...valido, contrasena: "corta" }, "contrasena"],
    ["falta el consentimiento", { ...valido, acepta_avisos: undefined }, "acepta_avisos"],
  ])("%s → 400 PETICION_INVALIDA sin crear la cuenta", async (_caso, cuerpoPeticion, campo) => {
    const { estado, cuerpo } = await llamar("/identidad/registro", { cuerpo: cuerpoPeticion });

    expect(estado).toBe(400);
    expect(cuerpo.error.codigo).toBe("PETICION_INVALIDA");
    expect(cuerpo.error.mensaje).toContain(campo);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("correo ya registrado → 409 CORREO_YA_REGISTRADO", async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: { code: "email_exists", status: 422, message: "already registered" },
    });

    const { estado, cuerpo } = await llamar("/identidad/registro", { cuerpo: valido });

    expect(estado).toBe(409);
    expect(cuerpo.error.codigo).toBe("CORREO_YA_REGISTRADO");
  });
});
