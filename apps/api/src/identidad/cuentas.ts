import type { SupabaseClient, User } from "@supabase/supabase-js";

const POR_PAGINA = 1000;

/**
 * Busca una cuenta de Supabase Auth por correo (Auth no tiene búsqueda directa por correo).
 * `correo` debe llegar en minúsculas, como lo deja `RegistroSchema`.
 */
export async function buscarCuentaPorCorreo(
  supabase: SupabaseClient,
  correo: string,
): Promise<User | null> {
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: POR_PAGINA });
    if (error) throw error;
    const usuario = data.users.find((u) => u.email?.toLowerCase() === correo);
    if (usuario) return usuario;
    if (data.users.length < POR_PAGINA) return null;
  }
}
