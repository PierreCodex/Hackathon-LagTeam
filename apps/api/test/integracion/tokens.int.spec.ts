import { describe, expect, it } from "vitest";
import { clienteAdminDePrueba } from "./ayudas/supabase.js";
import { borrarUsuariosDePrueba, type Rol, tokenPorRol } from "./ayudas/tokens.js";

describe("tokenPorRol", () => {
  const roles: Rol[] = ["admin", "organizador", "publico"];

  it("da un usuario distinto por rol, con un token válido que lleva su rol", async () => {
    const admin = clienteAdminDePrueba();
    const usuarios = await Promise.all(roles.map((rol) => tokenPorRol(rol)));

    expect(new Set(usuarios.map((u) => u.id)).size).toBe(roles.length);

    for (const [i, rol] of roles.entries()) {
      const { data, error } = await admin.auth.getUser(usuarios[i].token);
      expect(error).toBeNull();
      expect(data.user?.id).toBe(usuarios[i].id);
      expect(data.user?.app_metadata.rol).toBe(rol);
    }
  });

  it("borra los usuarios que creó", async () => {
    const admin = clienteAdminDePrueba();
    const { id } = await tokenPorRol("publico");

    await borrarUsuariosDePrueba();

    const { data } = await admin.auth.admin.getUserById(id);
    expect(data.user).toBeNull();
  });
});
