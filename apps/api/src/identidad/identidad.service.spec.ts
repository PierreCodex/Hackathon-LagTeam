import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PerfilSchema, RegistroSchema } from "@reto18/shared";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { ClienteSupabase } from "../supabase/supabase.module.js";
import { IdentidadService, TABLA_PERFILES } from "./identidad.service.js";

const ID = "11111111-1111-4111-8111-111111111111";

type Resultado = { data: unknown; error: { message: string } | null };

/** Cliente simulado con lo que usa el servicio: `auth.admin.*` y `from(tabla)`. */
type ResultadoCrear = { data: { user: { id: string; email?: string } | null }; error: unknown };

function clienteSimulado(opciones: {
  /** Uno, o varios en orden (uno por llamada a `createUser`). */
  crear?: ResultadoCrear | ResultadoCrear[];
  insertar?: Resultado | (() => Promise<Resultado>);
  leer?: Resultado;
  cuenta?: { data: { user: { email?: string } | null }; error: { message: string } | null };
  /** Cuentas que devuelve `listUsers`. */
  cuentas?: { id: string; email: string }[];
  borrar?: () => Promise<{ data: unknown; error: { message: string } | null }>;
}) {
  const respuestasCrear = Array.isArray(opciones.crear) ? [...opciones.crear] : null;
  const createUser = vi.fn<(datos: Record<string, unknown>) => Promise<ResultadoCrear>>(
    async () =>
      (respuestasCrear ? respuestasCrear.shift() : (opciones.crear as ResultadoCrear | undefined)) ?? {
        data: { user: null },
        error: null,
      },
  );
  const deleteUser = vi.fn<(id: string) => Promise<{ data: unknown; error: { message: string } | null }>>(
    async () => (opciones.borrar ? opciones.borrar() : { data: {}, error: null }),
  );
  const listUsers = vi.fn(async () => ({ data: { users: opciones.cuentas ?? [] }, error: null }));
  const getUserById = vi.fn(
    async () => opciones.cuenta ?? { data: { user: { email: "auth@ejemplo.pe" } }, error: null },
  );
  const insert = vi.fn();
  const from = vi.fn((tabla: string) => {
    void tabla;
    const consulta = {
      insert: (fila: unknown) => {
        insert(fila);
        return consulta;
      },
      select: () => consulta,
      eq: () => consulta,
      abortSignal: () => consulta,
      single: async () =>
        typeof opciones.insertar === "function"
          ? opciones.insertar()
          : (opciones.insertar ?? { data: null, error: null }),
      maybeSingle: async () => opciones.leer ?? { data: null, error: null },
    };
    return consulta;
  });
  const cliente = {
    auth: { admin: { createUser, deleteUser, getUserById, listUsers } },
    from,
  } as unknown as ClienteSupabase;
  return { cliente, createUser, deleteUser, getUserById, listUsers, insert, from };
}

const registro = RegistroSchema.parse({
  correo: "Ana@Ejemplo.pe",
  contrasena: "secreta123",
  rol: "organizador",
  whatsapp: "987 654 321",
  acepta_avisos: true,
});

const fila = {
  id: ID,
  rol: "organizador",
  whatsapp: "+51987654321",
  ciudad: null,
  acepta_avisos: true,
};

describe("IdentidadService.registrar", () => {
  it("crea la cuenta confirmada y el perfil con el WhatsApp en E.164", async () => {
    const simulado = clienteSimulado({
      crear: { data: { user: { id: ID, email: "ana@ejemplo.pe" } }, error: null },
      insertar: { data: fila, error: null },
    });

    const perfil = await new IdentidadService(simulado.cliente).registrar(registro);

    expect(simulado.createUser).toHaveBeenCalledWith({
      email: "ana@ejemplo.pe",
      password: "secreta123",
      email_confirm: true,
    });
    expect(simulado.from).toHaveBeenCalledWith(TABLA_PERFILES);
    expect(simulado.insert).toHaveBeenCalledWith({
      id: ID,
      rol: "organizador",
      whatsapp: "+51987654321",
      ciudad: null,
      acepta_avisos: true,
    });
    expect(perfil).toEqual({ ...fila, correo: "ana@ejemplo.pe" });
    expect(PerfilSchema.safeParse(perfil).success).toBe(true);
    expect(simulado.deleteUser).not.toHaveBeenCalled();
  });

  it("responde 409 CORREO_YA_REGISTRADO y no crea perfil si el correo existe", async () => {
    const simulado = clienteSimulado({
      crear: {
        data: { user: null },
        error: new AuthApiError("A user with this email address has already been registered", 422, "email_exists"),
      },
    });

    const promesa = new IdentidadService(simulado.cliente).registrar(registro);

    await expect(promesa).rejects.toBeInstanceOf(ConflictException);
    await expect(promesa).rejects.toMatchObject({
      response: { codigo: "CORREO_YA_REGISTRADO" },
    });
    expect(simulado.insert).not.toHaveBeenCalled();
  });

  it("borra la cuenta recién creada si falla el perfil (sin cuentas huérfanas)", async () => {
    const simulado = clienteSimulado({
      crear: { data: { user: { id: ID, email: "ana@ejemplo.pe" } }, error: null },
      insertar: { data: null, error: { message: "violates check constraint" } },
    });

    const promesa = new IdentidadService(simulado.cliente).registrar(registro);

    await expect(promesa).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(simulado.deleteUser).toHaveBeenCalledWith(ID);
  });

  it.each([
    ["weak_password", /^contrasena: /],
    ["email_address_invalid", /^correo: /],
    ["validation_failed", /^Los datos de la cuenta no son válidos$/],
  ])("Auth rechaza con %s → 400 con mensaje en español que nombra el campo", async (codigo, mensaje) => {
    const simulado = clienteSimulado({
      crear: { data: { user: null }, error: new AuthApiError("raw english", 422, codigo) },
    });

    const promesa = new IdentidadService(simulado.cliente).registrar(registro);

    await expect(promesa).rejects.toBeInstanceOf(BadRequestException);
    await expect(promesa).rejects.toMatchObject({ message: expect.stringMatching(mensaje) });
    expect(simulado.insert).not.toHaveBeenCalled();
  });

  it("responde 503 AUTH_NO_DISPONIBLE si Auth no responde", async () => {
    const simulado = clienteSimulado({
      crear: { data: { user: null }, error: new AuthRetryableFetchError("fetch failed", 0) },
    });

    await expect(new IdentidadService(simulado.cliente).registrar(registro)).rejects.toMatchObject({
      response: { codigo: "AUTH_NO_DISPONIBLE" },
    });
  });

  it("responde 503 AUTH_NO_DISPONIBLE si Auth limita las peticiones (429)", async () => {
    const simulado = clienteSimulado({
      crear: {
        data: { user: null },
        error: new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit"),
      },
    });

    await expect(new IdentidadService(simulado.cliente).registrar(registro)).rejects.toMatchObject({
      response: { codigo: "AUTH_NO_DISPONIBLE" },
    });
  });

  it("borra la cuenta si el insert del perfil lanza en vez de devolver error", async () => {
    const simulado = clienteSimulado({
      crear: { data: { user: { id: ID, email: "ana@ejemplo.pe" } }, error: null },
      insertar: () => Promise.reject(new TypeError("fetch failed")),
    });

    await expect(new IdentidadService(simulado.cliente).registrar(registro)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(simulado.deleteUser).toHaveBeenCalledWith(ID);
  });

  it("si también falla el borrado, responde 500 igualmente (el próximo registro la repara)", async () => {
    const simulado = clienteSimulado({
      crear: { data: { user: { id: ID, email: "ana@ejemplo.pe" } }, error: null },
      insertar: { data: null, error: { message: "violates check constraint" } },
      borrar: () => Promise.reject(new TypeError("fetch failed")),
    });

    await expect(new IdentidadService(simulado.cliente).registrar(registro)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it("correo repetido de una cuenta sin perfil: la borra y repite el registro", async () => {
    const huerfana = "22222222-2222-4222-8222-222222222222";
    const simulado = clienteSimulado({
      crear: [
        {
          data: { user: null },
          error: new AuthApiError("already registered", 422, "email_exists"),
        },
        { data: { user: { id: ID, email: "ana@ejemplo.pe" } }, error: null },
      ],
      cuentas: [{ id: huerfana, email: "ana@ejemplo.pe" }],
      leer: { data: null, error: null },
      insertar: { data: fila, error: null },
    });

    const perfil = await new IdentidadService(simulado.cliente).registrar(registro);

    expect(simulado.deleteUser).toHaveBeenCalledWith(huerfana);
    expect(simulado.createUser).toHaveBeenCalledTimes(2);
    expect(perfil.id).toBe(ID);
  });

  it("correo repetido de una cuenta con perfil: 409 y no borra nada", async () => {
    const simulado = clienteSimulado({
      crear: { data: { user: null }, error: new AuthApiError("already registered", 422, "email_exists") },
      cuentas: [{ id: ID, email: "ana@ejemplo.pe" }],
      leer: { data: { id: ID }, error: null },
    });

    await expect(new IdentidadService(simulado.cliente).registrar(registro)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(simulado.deleteUser).not.toHaveBeenCalled();
    expect(simulado.createUser).toHaveBeenCalledOnce();
  });

  it.each([
    ["  Piura  ", "Piura"],
    ["", null],
    [null, null],
  ])("guarda la ciudad %j como %j", async (ciudad, guardada) => {
    const simulado = clienteSimulado({
      crear: { data: { user: { id: ID, email: "ana@ejemplo.pe" } }, error: null },
      insertar: { data: { ...fila, ciudad: guardada }, error: null },
    });
    const datos = RegistroSchema.parse({ ...registro, contrasena: "secreta123", ciudad });

    await new IdentidadService(simulado.cliente).registrar(datos);

    expect(simulado.insert).toHaveBeenCalledWith(expect.objectContaining({ ciudad: guardada }));
  });

  it("responde 503 si Supabase no está configurado", async () => {
    await expect(new IdentidadService(null).registrar(registro)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe("IdentidadService.perfilDe", () => {
  it("devuelve el perfil con el correo que se le pasa", async () => {
    const simulado = clienteSimulado({ leer: { data: fila, error: null } });

    const perfil = await new IdentidadService(simulado.cliente).perfilDe(ID, "ana@ejemplo.pe");

    expect(perfil).toEqual({ ...fila, correo: "ana@ejemplo.pe" });
    expect(simulado.getUserById).not.toHaveBeenCalled();
  });

  it("pide el correo a Auth si no se lo pasan", async () => {
    const simulado = clienteSimulado({ leer: { data: fila, error: null } });

    const perfil = await new IdentidadService(simulado.cliente).perfilDe(ID);

    expect(perfil?.correo).toBe("auth@ejemplo.pe");
    expect(simulado.getUserById).toHaveBeenCalledWith(ID);
  });

  it("responde 503 AUTH_NO_DISPONIBLE si Auth falla al dar el correo", async () => {
    const simulado = clienteSimulado({
      leer: { data: fila, error: null },
      cuenta: { data: { user: null }, error: { message: "fetch failed" } },
    });

    const promesa = new IdentidadService(simulado.cliente).perfilDe(ID);

    await expect(promesa).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(promesa).rejects.toMatchObject({ response: { codigo: "AUTH_NO_DISPONIBLE" } });
  });

  it("devuelve null si Auth ya no tiene la cuenta", async () => {
    const simulado = clienteSimulado({
      leer: { data: fila, error: null },
      cuenta: { data: { user: null }, error: null },
    });

    expect(await new IdentidadService(simulado.cliente).perfilDe(ID)).toBeNull();
  });

  it("devuelve null si la cuenta no tiene perfil", async () => {
    const simulado = clienteSimulado({ leer: { data: null, error: null } });

    expect(await new IdentidadService(simulado.cliente).perfilDe(ID, "x@y.pe")).toBeNull();
  });

  it("responde 503 si la base de datos falla", async () => {
    const simulado = clienteSimulado({ leer: { data: null, error: { message: "timeout" } } });

    await expect(new IdentidadService(simulado.cliente).perfilDe(ID, "x@y.pe")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
