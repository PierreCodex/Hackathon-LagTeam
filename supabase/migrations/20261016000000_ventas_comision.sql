-- Bloque C del recorte final (historias 4.2 y 4.3): cambiar la comisión vigente en un solo paso.
-- Las órdenes ya pagadas conservan la comisión que congelaron (AD-10).
create function public.ventas_cambiar_comision(p_modelo text, p_valor integer)
returns public.ventas_config_comision
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.ventas_config_comision;
begin
  update public.ventas_config_comision set vigente = false where vigente;
  insert into public.ventas_config_comision (modelo, valor) values (p_modelo, p_valor) returning * into v_fila;
  return v_fila;
end;
$$;

revoke all on function public.ventas_cambiar_comision(text, integer) from public, anon, authenticated;
grant execute on function public.ventas_cambiar_comision(text, integer) to service_role;
