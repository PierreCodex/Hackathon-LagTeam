-- Historia 1.2 (API: registro, inicio de sesión y roles): perfiles con rol.
-- Una fila por cuenta de Supabase Auth, con su único rol (AD-3) y su WhatsApp en E.164 (AD-9).
-- Solo la API escribe y lee esta tabla con la clave de servicio (AD-1): RLS activo y sin políticas.

create table public.identidad_perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol text not null check (rol in ('admin', 'organizador', 'publico')),
  whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  ciudad text,
  acepta_avisos boolean not null default false,
  creado_en timestamptz not null default now()
);

comment on table public.identidad_perfiles is 'Perfil y rol de cada cuenta (módulo identidad). Solo la API escribe (AD-1).';

alter table public.identidad_perfiles enable row level security;

-- Sin políticas para anon ni authenticated: además se revocan todos los permisos.
revoke all on table public.identidad_perfiles from public;
revoke all on table public.identidad_perfiles from anon;
revoke all on table public.identidad_perfiles from authenticated;
grant select, insert, update, delete on table public.identidad_perfiles to service_role;
