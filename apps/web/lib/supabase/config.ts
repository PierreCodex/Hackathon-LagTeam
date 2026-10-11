/**
 * Configuración pública de Supabase para la web (AD-1): solo la URL y la clave pública (anon).
 * La clave de servicio nunca llega aquí. Las referencias a `process.env.NEXT_PUBLIC_*` van
 * escritas tal cual para que Next las incruste al compilar.
 */
export type ConfigSupabase = { url: string; clavePublica: string };

export function configSupabase(): ConfigSupabase | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clavePublica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && clavePublica ? { url, clavePublica } : null;
}
