import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { leerDatosAdmin, sembrarAdmin } from "./sembrar-admin.js";

/** Auth y tabla de perfiles en memoria, con lo que usa el script. */
function supabaseEnMemoria(opciones: { carreraAlCrear?: boolean } = {}) {
  const usuarios: { id: string; email: string }[] = [];
  const perfiles = new Map<string, Record<string, unknown>>();
  let ocultarEnLaPrimeraBusqueda = opciones.carreraAlCrear ?? false;

  const createUser = vi.fn(async ({ email }: { email: string; password: string; email_confirm: boolean }) => {
    if (usuarios.some((u) => u.email === email)) {
      return { data: { user: null }, error: { code: "email_exists", message: "already registered" } };
    }
    const user = { id: `id-${usuarios.length + 1}`, email };
    usuarios.push(user);
    return { data: { user }, error: null };
  });
  const updateUserById = vi.fn<(id: string, datos: Record<string, unknown>) => Promise<unknown>>(
    async () => ({ data: {}, error: null }),
  );

  const cliente = {
    auth: {
      admin: {
        listUsers: async () => {
          if (ocultarEnLaPrimeraBusqueda) {
            // Simula otra ejecución que crea la cuenta justo después de esta búsqueda.
            ocultarEnLaPrimeraBusqueda = false;
            usuarios.push({ id: "id-otro", email: "admin@ejemplo.pe" });
            return { data: { users: [] }, error: null };
          }
          return { data: { users: [...usuarios] }, error: null };
        },
        createUser,
        updateUserById,
      },
    },
    from: () => {
      let id = "";
      const consulta = {
        select: () => consulta,
        eq: (_columna: string, valor: string) => {
          id = valor;
          return consulta;
        },
        maybeSingle: async () => ({ data: perfiles.get(id) ?? null, error: null }),
        upsert: async (fila: Record<string, unknown>) => {
          perfiles.set(String(fila.id), { ...perfiles.get(String(fila.id)), ...fila });
          return { error: null };
        },
      };
      return consulta;
    },
  } as unknown as SupabaseClient;
  return { cliente, usuarios, perfiles, createUser, updateUserById };
}

describe("sembrarAdmin", () => {
  const datos = leerDatosAdmin({
    ADMIN_CORREO: "Admin@Ejemplo.pe",
    ADMIN_CONTRASENA: "no-real-123",
    ADMIN_WHATSAPP: "912-345-678",
  });

  it("normaliza las variables (correo en minúsculas, WhatsApp en E.164)", () => {
    expect(datos).toEqual({
      correo: "admin@ejemplo.pe",
      contrasena: "no-real-123",
      whatsapp: "+51912345678",
    });
  });

  it("se puede ejecutar dos veces sin duplicar el admin", async () => {
    const sb = supabaseEnMemoria();

    const primera = await sembrarAdmin(sb.cliente, datos);
    const segunda = await sembrarAdmin(sb.cliente, datos);

    expect(primera).toEqual({ id: "id-1", creado: true, rolAnterior: null });
    expect(segunda).toEqual({ id: "id-1", creado: false, rolAnterior: "admin" });
    expect(sb.usuarios).toHaveLength(1);
    expect(sb.perfiles.size).toBe(1);
    expect(sb.perfiles.get("id-1")).toMatchObject({ rol: "admin", whatsapp: "+51912345678" });
    expect(sb.createUser).toHaveBeenCalledWith({
      email: "admin@ejemplo.pe",
      password: "no-real-123",
      email_confirm: true,
    });
    expect(sb.updateUserById).toHaveBeenCalledOnce();
    expect(sb.updateUserById).toHaveBeenCalledWith("id-1", {
      password: "no-real-123",
      email_confirm: true,
    });
  });

  it("se niega a ascender una cuenta que ya tiene otro rol, sin tocarla", async () => {
    const sb = supabaseEnMemoria();
    sb.usuarios.push({ id: "id-org", email: "admin@ejemplo.pe" });
    sb.perfiles.set("id-org", { id: "id-org", rol: "organizador" });

    await expect(sembrarAdmin(sb.cliente, datos)).rejects.toThrow(/organizador.*--forzar/);
    expect(sb.updateUserById).not.toHaveBeenCalled();
    expect(sb.perfiles.get("id-org")).toMatchObject({ rol: "organizador" });
  });

  it("con --forzar asciende la cuenta e informa del rol anterior", async () => {
    const sb = supabaseEnMemoria();
    sb.usuarios.push({ id: "id-org", email: "admin@ejemplo.pe" });
    sb.perfiles.set("id-org", { id: "id-org", rol: "organizador" });

    const resultado = await sembrarAdmin(sb.cliente, datos, { forzar: true });

    expect(resultado).toEqual({ id: "id-org", creado: false, rolAnterior: "organizador" });
    expect(sb.perfiles.get("id-org")).toMatchObject({ rol: "admin" });
  });

  it("si createUser responde email_exists, busca la cuenta y la actualiza", async () => {
    const sb = supabaseEnMemoria({ carreraAlCrear: true });

    const resultado = await sembrarAdmin(sb.cliente, datos);

    expect(resultado).toEqual({ id: "id-otro", creado: false, rolAnterior: null });
    expect(sb.updateUserById).toHaveBeenCalledWith("id-otro", {
      password: "no-real-123",
      email_confirm: true,
    });
    expect(sb.perfiles.get("id-otro")).toMatchObject({ rol: "admin" });
  });

  it("rechaza variables que faltan nombrando la variable", () => {
    expect(() => leerDatosAdmin({ ADMIN_CORREO: "a@b.pe" })).toThrow(/ADMIN_CONTRASENA/);
  });
});
