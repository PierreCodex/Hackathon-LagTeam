-- Historia 1.1 (esqueleto desplegado): función de salud.
-- Devuelve la hora de Postgres para comprobar conexión y credenciales sin crear tablas.
-- Solo la ejecuta `service_role`, que es la clave que usa la API (AD-1).

create or replace function public.salud()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

revoke execute on function public.salud() from public;
revoke execute on function public.salud() from anon;
revoke execute on function public.salud() from authenticated;
grant execute on function public.salud() to service_role;
