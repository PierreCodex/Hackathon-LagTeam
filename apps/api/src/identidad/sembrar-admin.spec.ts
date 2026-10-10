import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { leerDatosAdmin, sembrarAdmin } from "./sembrar-admin.js";

/** Auth y tabla de perfiles en memoria, con lo que usa el script. */
function supabaseEnMemoria() {
  const usuarios: { id: string; email: string }[] = [];
  const perfiles = new Map<string, Record<string, unknown>>();
  const updateUserById = vi.fn(async () => ({ data: {}, error: null }));
  const cliente = {
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: [...usuarios] }, error: null }),
        createUser: async ({ email }: { email: string }) => {
          const user = { id: `id-${usuarios.length + 1}`, email };
          usuarios.push(user);
          return { data: { user }, error: null };
        },
        updateUserById,
      },
    },
    from: () => ({
      upsert: async (fila: Record<string, unknown>) => {
        perfiles.set(String(fila.id), { ...perfiles.get(String(fila.id)), ...fila });
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { cliente, usuarios, perfiles, updateUserById };
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

    expect(primera).toEqual({ id: "id-1", creado: true });
    expect(segunda).toEqual({ id: "id-1", creado: false });
    expect(sb.usuarios).toHaveLength(1);
    expect(sb.perfiles.size).toBe(1);
    expect(sb.perfiles.get("id-1")).toMatchObject({ rol: "admin", whatsapp: "+51912345678" });
    expect(sb.updateUserById).toHaveBeenCalledOnce();
  });

  it("rechaza variables que faltan nombrando la variable", () => {
    expect(() => leerDatosAdmin({ ADMIN_CORREO: "a@b.pe" })).toThrow(/ADMIN_CONTRASENA/);
  });
});
