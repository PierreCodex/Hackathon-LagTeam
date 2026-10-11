-- Historia 2.4: precios por rango de asientos.
-- Cada rango dice "sección, fila, desde–hasta → categoría" de un evento. Se guarda por nombre de sección y
-- de fila y por número de asiento (no por id), para que reemplazar el mapa antes de publicar (2.3) no lo rompa:
-- un rango que ya no casa con el mapa simplemente no resuelve ningún asiento. Sin inventario (2.5, AD-4).

-- La categoría de un rango es del mismo evento (FK compuesta).
alter table public.eventos_categorias_precio
  add constraint eventos_categorias_precio_id_evento_key unique (id, evento_id);

create table public.eventos_precios_rango (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos_eventos(id) on delete cascade,
  categoria_id uuid not null,
  seccion text not null check (length(btrim(seccion)) > 0),
  fila text not null check (length(btrim(fila)) > 0),
  desde integer not null,
  hasta integer not null,
  creado_en timestamptz not null default now(),
  check (desde > 0 and desde <= hasta),
  foreign key (categoria_id, evento_id) references public.eventos_categorias_precio(id, evento_id) on delete cascade
);
create index eventos_precios_rango_evento_idx on public.eventos_precios_rango(evento_id, seccion, fila, desde);
create index eventos_precios_rango_categoria_idx on public.eventos_precios_rango(categoria_id);

-- AD-1: sin acceso desde el navegador.
alter table public.eventos_precios_rango enable row level security;
revoke all on public.eventos_precios_rango from public, anon, authenticated;
grant select, insert, update, delete on public.eventos_precios_rango to service_role;

-- Cada asiento numerado del mapa vigente de la sede del evento con la categoría de su rango (o null),
-- ordenado por sección, fila y número. Es la única resolución de precios: también la usará `ventas` (2.5).
create function public.eventos_precios_asientos(p_evento_id uuid)
returns table (asiento_id uuid, seccion text, fila text, numero integer, categoria_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, sec.nombre, f.nombre, a.numero, r.categoria_id
  from public.eventos_eventos e
  join public.eventos_secciones sec on sec.sede_id = e.sede_id and sec.tipo = 'numerada'
  join public.eventos_filas f on f.seccion_id = sec.id
  join public.eventos_asientos a on a.fila_id = f.id
  left join lateral (
    select r.categoria_id
    from public.eventos_precios_rango r
    where r.evento_id = e.id and r.seccion = sec.nombre and r.fila = f.nombre and a.numero between r.desde and r.hasta
    order by r.desde
    limit 1
  ) r on true
  where e.id = p_evento_id
  order by sec.orden, f.orden, a.numero;
$$;

-- Precios del evento como jsonb (forma de `PreciosEventoSchema`): los rangos en el orden del mapa (los que no
-- casan con él, al final) y cada asiento con su categoría. En jsonb para no chocar con `max_rows` de PostgREST
-- (un mapa admite hasta 5000 asientos). Nulo si el evento no existe.
create function public.eventos_leer_precios(p_evento_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'rangos', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'categoria_id', r.categoria_id, 'seccion', r.seccion,
          'fila', r.fila, 'desde', r.desde, 'hasta', r.hasta)
        order by sec.orden nulls last, f.orden nulls last, r.seccion, r.fila, r.desde)
      from public.eventos_precios_rango r
      left join public.eventos_secciones sec on sec.sede_id = e.sede_id and sec.nombre = r.seccion and sec.tipo = 'numerada'
      left join public.eventos_filas f on f.seccion_id = sec.id and f.nombre = r.fila
      where r.evento_id = e.id), '[]'::jsonb),
    'asientos', coalesce((
      select jsonb_agg(jsonb_build_object('asiento_id', p.asiento_id, 'seccion', p.seccion, 'fila', p.fila,
          'numero', p.numero, 'categoria_id', p.categoria_id) order by p.orden)
      from public.eventos_precios_asientos(e.id) with ordinality as p(asiento_id, seccion, fila, numero, categoria_id, orden)),
      '[]'::jsonb)
  )
  from public.eventos_eventos e
  where e.id = p_evento_id;
$$;

-- Reemplaza todos los rangos de precio de un evento no publicado de su organizador, en una transacción.
-- `p_rangos`: arreglo con la forma de `PreciosEntradaSchema.rangos`. Devuelve el id del evento.
-- Errores P0001: `EVENTO_NO_EXISTE`, `EVENTO_AJENO`, `EVENTO_PUBLICADO`, `CATEGORIA_NO_VALIDA`,
-- `RANGO_FUERA_DEL_MAPA`, `DATOS_INVALIDOS` (rango invertido o solapado).
create function public.eventos_guardar_precios(p_organizador uuid, p_evento_id uuid, p_rangos jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sede_id uuid;
  v_evento public.eventos_eventos%rowtype;
  v_rango jsonb;
  v_indice integer := 0;
  v_seccion_id uuid;
  v_desde integer;
  v_hasta integer;
  v_solape record;
begin
  select e.sede_id into v_sede_id from public.eventos_eventos e where e.id = p_evento_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'EVENTO_NO_EXISTE', detail = 'El evento indicado no existe';
  end if;
  -- Primero la sede y luego el evento, en el mismo orden que `eventos_publicar_evento` (sin interbloqueos).
  -- La sede en `share`: el mapa no cambia mientras se validan los rangos.
  perform 1 from public.eventos_sedes s where s.id = v_sede_id for share;
  select * into v_evento from public.eventos_eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'EVENTO_NO_EXISTE', detail = 'El evento indicado no existe';
  end if;
  if v_evento.organizador_id is distinct from p_organizador then
    raise exception using errcode = 'P0001', message = 'EVENTO_AJENO', detail = 'El evento es de otro organizador';
  end if;
  if v_evento.publicado then
    raise exception using errcode = 'P0001', message = 'EVENTO_PUBLICADO',
      detail = 'El evento ya está publicado: sus precios por asiento ya no cambian';
  end if;

  delete from public.eventos_precios_rango r where r.evento_id = p_evento_id;

  for v_rango in select * from jsonb_array_elements(coalesce(p_rangos, '[]'::jsonb)) loop
    v_desde := (v_rango ->> 'desde')::integer;
    v_hasta := (v_rango ->> 'hasta')::integer;
    if v_desde is null or v_hasta is null or v_desde < 1 or v_desde > v_hasta then
      raise exception using errcode = 'P0001', message = 'DATOS_INVALIDOS',
        detail = format('rangos.%s.hasta: debe ser igual o mayor que desde', v_indice);
    end if;
    if not exists (
      select 1 from public.eventos_categorias_precio c
      where c.id = (v_rango ->> 'categoria_id')::uuid and c.evento_id = p_evento_id and c.seccion_id is null
    ) then
      raise exception using errcode = 'P0001', message = 'CATEGORIA_NO_VALIDA',
        detail = format('rangos.%s.categoria_id: la categoría no es de este evento o es de una zona general', v_indice);
    end if;
    select s.id into v_seccion_id
    from public.eventos_secciones s
    where s.sede_id = v_evento.sede_id and s.nombre = v_rango ->> 'seccion' and s.tipo = 'numerada';
    if not found then
      raise exception using errcode = 'P0001', message = 'RANGO_FUERA_DEL_MAPA',
        detail = format('rangos.%s.seccion: «%s» no es una sección numerada del mapa', v_indice, v_rango ->> 'seccion');
    end if;
    if not exists (select 1 from public.eventos_filas f where f.seccion_id = v_seccion_id and f.nombre = v_rango ->> 'fila') then
      raise exception using errcode = 'P0001', message = 'RANGO_FUERA_DEL_MAPA',
        detail = format('rangos.%s.fila: «%s» no es una fila de «%s»', v_indice, v_rango ->> 'fila', v_rango ->> 'seccion');
    end if;
    insert into public.eventos_precios_rango (evento_id, categoria_id, seccion, fila, desde, hasta)
    values (p_evento_id, (v_rango ->> 'categoria_id')::uuid, v_rango ->> 'seccion', v_rango ->> 'fila', v_desde, v_hasta);
    v_indice := v_indice + 1;
  end loop;

  select a.seccion, a.fila, b.desde into v_solape
  from public.eventos_precios_rango a
  join public.eventos_precios_rango b
    on b.evento_id = a.evento_id and b.seccion = a.seccion and b.fila = a.fila and b.id <> a.id
    and b.desde <= a.hasta and a.desde <= b.hasta
  where a.evento_id = p_evento_id
  limit 1;
  if found then
    raise exception using errcode = 'P0001', message = 'DATOS_INVALIDOS',
      detail = format('rangos: dos rangos de «%s», fila «%s», se solapan', v_solape.seccion, v_solape.fila);
  end if;
  return p_evento_id;
end;
$$;

-- Publicar (2.3) exige además que todo asiento numerado de la sede tenga categoría (decisión del 11/10/2026).
-- Misma firma y orden de bloqueo. Errores P0001: los de la 2.3 y `ASIENTOS_SIN_PRECIO`.
create or replace function public.eventos_publicar_evento(p_organizador uuid, p_evento_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sede_id uuid;
  v_evento public.eventos_eventos%rowtype;
  v_capacidad bigint;
  v_sin_precio bigint;
begin
  select e.sede_id into v_sede_id from public.eventos_eventos e where e.id = p_evento_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'EVENTO_NO_EXISTE', detail = 'El evento indicado no existe';
  end if;
  -- Primero la sede y luego el evento, en el mismo orden que `eventos_guardar_mapa` (sin interbloqueos).
  perform 1 from public.eventos_sedes s where s.id = v_sede_id for update;
  select * into v_evento from public.eventos_eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'EVENTO_NO_EXISTE', detail = 'El evento indicado no existe';
  end if;

  if v_evento.organizador_id is distinct from p_organizador then
    raise exception using errcode = 'P0001', message = 'EVENTO_AJENO', detail = 'El evento es de otro organizador';
  end if;
  if v_evento.publicado then
    return v_evento.id;
  end if;
  if v_evento.estado <> 'aprobado' then
    raise exception using errcode = 'P0001', message = 'EVENTO_NO_APROBADO',
      detail = format('El evento está %s: solo se publica un evento aprobado', v_evento.estado);
  end if;
  v_capacidad := public.eventos_capacidad_sede(v_evento.sede_id);
  if v_evento.aforo > v_capacidad then
    raise exception using errcode = 'P0001', message = 'AFORO_SUPERA_SEDE',
      detail = format('El aforo (%s) supera la capacidad de la sede (%s)', v_evento.aforo, v_capacidad);
  end if;
  select count(*) into v_sin_precio from public.eventos_precios_asientos(v_evento.id) p where p.categoria_id is null;
  if v_sin_precio > 0 then
    raise exception using errcode = 'P0001', message = 'ASIENTOS_SIN_PRECIO',
      detail = format('%s asientos numerados no tienen categoría de precio: asígnales un rango antes de publicar', v_sin_precio);
  end if;

  update public.eventos_eventos set publicado = true, publicado_en = now() where id = v_evento.id;
  update public.eventos_sedes set mapa_cerrado = true where id = v_evento.sede_id;
  return v_evento.id;
end;
$$;

-- AD-1: solo la API (service_role) ejecuta estas funciones.
revoke all on function public.eventos_precios_asientos(uuid) from public, anon, authenticated;
revoke all on function public.eventos_leer_precios(uuid) from public, anon, authenticated;
revoke all on function public.eventos_guardar_precios(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.eventos_publicar_evento(uuid, uuid) from public, anon, authenticated;
grant execute on function public.eventos_precios_asientos(uuid) to service_role;
grant execute on function public.eventos_leer_precios(uuid) to service_role;
grant execute on function public.eventos_guardar_precios(uuid, uuid, jsonb) to service_role;
grant execute on function public.eventos_publicar_evento(uuid, uuid) to service_role;
