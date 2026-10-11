-- Historias 2.5/2.6/2.11 (versión reducida del 11/10/2026, ver `recorte-final.md`): mapa del evento con
-- butacas libres u ocupadas. Sin bloqueo temporal a nivel de butaca (solo la restricción única evita la
-- doble venta) y sin pintar por categoría de precio en el mapa público. El precio de cada butaca se
-- resuelve una sola vez, al asegurar el inventario, desde los rangos de la 2.4 (`eventos_precios_asientos`).

alter table public.ventas_ordenes add column asiento_id uuid references public.eventos_asientos(id) on delete cascade;
-- Una orden de butaca no tiene cupo de zona general: con `seccion_id` nulo, Postgres no comprueba la FK
-- compuesta `(evento_id, seccion_id) references ventas_evento_cupos` (MATCH SIMPLE, comportamiento estándar).
alter table public.ventas_ordenes alter column seccion_id drop not null;
alter table public.ventas_entradas add column asiento_id uuid references public.eventos_asientos(id) on delete cascade;

-- Inventario de butacas numeradas por evento. AD-1: a diferencia de las demás tablas `ventas_*`, esta la
-- lee el navegador en vivo por Supabase Realtime (solo SELECT, sin bloqueo temporal, AD-5 adaptado).
create table public.ventas_evento_asientos (
  evento_id uuid not null references public.eventos_eventos(id) on delete cascade,
  asiento_id uuid not null references public.eventos_asientos(id) on delete cascade,
  categoria_id uuid not null references public.eventos_categorias_precio(id),
  precio_centimos integer not null check (precio_centimos >= 0),
  estado text not null default 'disponible' check (estado in ('disponible', 'vendida')),
  orden_id uuid references public.ventas_ordenes(id) on delete set null,
  creado_en timestamptz not null default now(),
  primary key (evento_id, asiento_id)
);

-- Excepción a como se protegen las demás tablas `ventas_*` (comparar con `20261013000000_ventas.sql`):
-- aquí el navegador sí lee en vivo (AD-1), nunca escribe.
alter table public.ventas_evento_asientos enable row level security;
revoke all on public.ventas_evento_asientos from public, anon, authenticated;
grant select on public.ventas_evento_asientos to anon, authenticated;
grant select, insert, update, delete on public.ventas_evento_asientos to service_role;
create policy ventas_evento_asientos_lectura_publica on public.ventas_evento_asientos for select to anon, authenticated using (true);
alter publication supabase_realtime add table public.ventas_evento_asientos;

-- Crea las filas de inventario que falten, con el precio resuelto de los rangos de la 2.4. Idempotente:
-- una butaca que ya tiene fila no cambia (conserva su estado). Sin categoría resuelta, no se crea inventario.
create function public.ventas_asegurar_inventario_butacas(p_evento_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ventas_evento_asientos (evento_id, asiento_id, categoria_id, precio_centimos)
  select p_evento_id, p.asiento_id, p.categoria_id, c.precio_centimos
  from public.eventos_precios_asientos(p_evento_id) p
  join public.eventos_categorias_precio c on c.id = p.categoria_id
  where p.categoria_id is not null
  on conflict (evento_id, asiento_id) do nothing;
$$;

-- Orden `pendiente` de una butaca, análoga a `ventas_crear_orden` pero sin cupo de zona general ni
-- bloqueo de la butaca: dos compradores pueden tener cada uno una orden pendiente de la misma butaca;
-- solo el primero en confirmar el pago se la queda (lo decide `ventas_confirmar_pago`, abajo). El chequeo
-- de `estado <> 'disponible'` aquí es solo un filtro rápido de UX, no la garantía de unicidad.
-- Errores P0001: VENTA_CERRADA, ASIENTO_NO_EXISTE, BUTACA_NO_DISPONIBLE.
create function public.ventas_crear_orden_asiento(p_datos jsonb)
returns public.ventas_ordenes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento uuid := (p_datos ->> 'evento_id')::uuid;
  v_asiento uuid := (p_datos ->> 'asiento_id')::uuid;
  v_butaca public.ventas_evento_asientos;
  v_orden public.ventas_ordenes;
begin
  if now() >= (p_datos ->> 'inicio')::timestamptz then
    raise exception using errcode = 'P0001', message = 'VENTA_CERRADA',
      detail = 'El evento ya empezó: la venta está cerrada';
  end if;

  select * into v_butaca from public.ventas_evento_asientos
    where evento_id = v_evento and asiento_id = v_asiento for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ASIENTO_NO_EXISTE',
      detail = 'La butaca no existe en este evento';
  end if;
  if v_butaca.estado <> 'disponible' then
    raise exception using errcode = 'P0001', message = 'BUTACA_NO_DISPONIBLE',
      detail = 'Esta butaca ya no está disponible';
  end if;

  insert into public.ventas_ordenes (usuario_id, evento_id, categoria_id, asiento_id, cantidad,
    precio_unitario_centimos, total_centimos, expira_en, ref)
  values ((p_datos ->> 'usuario_id')::uuid, v_evento, v_butaca.categoria_id, v_asiento, 1,
    v_butaca.precio_centimos, v_butaca.precio_centimos,
    least(now() + interval '10 minutes', (p_datos ->> 'inicio')::timestamptz), nullif(p_datos ->> 'ref', ''))
  returning * into v_orden;
  return v_orden;
end;
$$;

-- Igual que `ventas_confirmar_pago` de `20261013000000_ventas.sql`, con dos cambios: si la orden es de una
-- butaca, la vende con un UPDATE condicional (AD-5: aquí vive la garantía de unicidad, un índice único
-- vía PK más este WHERE) y, si ya se vendió, deshace la transacción con BUTACA_NO_DISPONIBLE (la API anula
-- el cobro); y la entrada creada lleva su `asiento_id`. Errores P0001: los de la original, más BUTACA_NO_DISPONIBLE.
create or replace function public.ventas_confirmar_pago(p_orden_id uuid, p_usuario_id uuid, p_metodo text, p_pasarela_ref text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento uuid;
  v_orden public.ventas_ordenes;
  v_modelo text;
  v_valor integer;
begin
  select o.evento_id into v_evento from public.ventas_ordenes o where o.id = p_orden_id and o.usuario_id = p_usuario_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDEN_NO_ENCONTRADA', detail = 'La orden no existe';
  end if;
  perform 1 from public.ventas_evento_cupos c where c.evento_id = v_evento order by c.seccion_id for update;
  select * into v_orden from public.ventas_ordenes o where o.id = p_orden_id for update;

  if v_orden.estado = 'expirada' or (v_orden.estado = 'pendiente' and v_orden.expira_en <= now()) then
    perform public.ventas_expirar_orden(p_orden_id);
    return jsonb_build_object('resultado', 'expirada');
  end if;
  if v_orden.estado <> 'pendiente' then
    raise exception using errcode = 'P0001', message = 'ORDEN_NO_PENDIENTE',
      detail = format('La orden está %s', v_orden.estado);
  end if;

  select c.modelo, c.valor into v_modelo, v_valor from public.ventas_config_comision c where c.vigente;
  if not found then
    raise exception using errcode = 'P0001', message = 'COMISION_NO_CONFIGURADA',
      detail = 'No hay una comisión vigente';
  end if;

  if v_orden.asiento_id is not null then
    update public.ventas_evento_asientos
      set estado = 'vendida', orden_id = p_orden_id
      where evento_id = v_orden.evento_id and asiento_id = v_orden.asiento_id and estado = 'disponible';
    if not found then
      raise exception using errcode = 'P0001', message = 'BUTACA_NO_DISPONIBLE',
        detail = 'La butaca ya fue vendida';
    end if;
  end if;

  update public.ventas_ordenes o set
    estado = 'pagada',
    metodo_pago = p_metodo,
    pasarela_ref = p_pasarela_ref,
    pagada_en = now(),
    comision_modelo = v_modelo,
    comision_valor = v_valor,
    comision_importe = public.ventas_calcular_comision(v_modelo, v_valor, o.total_centimos, o.cantidad)
  where o.id = p_orden_id
  returning * into v_orden;

  insert into public.ventas_entradas (orden_id, evento_id, usuario_id, categoria_id, asiento_id)
  select v_orden.id, v_orden.evento_id, v_orden.usuario_id, v_orden.categoria_id, v_orden.asiento_id
  from generate_series(1, v_orden.cantidad);

  return jsonb_build_object(
    'resultado', 'pagada',
    'orden', to_jsonb(v_orden),
    'entradas', (select jsonb_agg(e.id order by e.id) from public.ventas_entradas e where e.orden_id = v_orden.id)
  );
end;
$$;

-- AD-1: solo la API (service_role) ejecuta estas funciones.
revoke all on function public.ventas_asegurar_inventario_butacas(uuid) from public, anon, authenticated;
revoke all on function public.ventas_crear_orden_asiento(jsonb) from public, anon, authenticated;
grant execute on function public.ventas_asegurar_inventario_butacas(uuid) to service_role;
grant execute on function public.ventas_crear_orden_asiento(jsonb) to service_role;
