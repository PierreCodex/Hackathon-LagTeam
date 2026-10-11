-- Historia 1.4: alta de evento por el organizador.
-- Buckets de Storage, capacidad de una sede, lista de sedes y alta atómica (supabase-js no tiene transacciones).

-- Foto del evento: pública (la muestra el catálogo). Constancia de APDAYC: privada (la 1.10 la firma para el admin).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('eventos-fotos', 'eventos-fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('eventos-constancias', 'eventos-constancias', false, 5242880,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Capacidad de una sede: asientos numerados más capacidades de las zonas generales.
create function public.eventos_capacidad_sede(p_sede_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce((select sum(s.capacidad) from public.eventos_secciones s
                   where s.sede_id = p_sede_id and s.tipo = 'general'), 0)
       + (select count(*) from public.eventos_asientos a
            join public.eventos_filas f on f.id = a.fila_id
            join public.eventos_secciones s on s.id = f.seccion_id
          where s.sede_id = p_sede_id);
$$;

-- Sedes compartidas para el formulario del alta, con su capacidad (el máximo del aforo).
-- Las sedes sin capacidad no admiten ningún evento y no se listan.
create function public.eventos_listar_sedes()
returns table (id uuid, nombre text, direccion text, distrito text, capacidad bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.nombre, s.direccion, s.distrito, c.capacidad
  from public.eventos_sedes s
  cross join lateral (select public.eventos_capacidad_sede(s.id) as capacidad) c
  where c.capacidad > 0
  order by s.nombre, s.id;
$$;

-- Alta atómica: sede nueva (zona general) si hace falta, comprobación del aforo, evento `pendiente`
-- y sus categorías de precio. Devuelve el id del evento.
-- Errores: excepción P0001 con el mensaje `SEDE_NO_EXISTE` o `AFORO_SUPERA_SEDE`.
create function public.eventos_crear_evento(datos jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sede jsonb := datos -> 'sede';
  v_sede_id uuid;
  v_distrito text;
  v_capacidad bigint;
  v_aforo integer := (datos ->> 'aforo')::integer;
  v_seccion_general uuid;
  v_evento_id uuid;
  v_categoria jsonb;
begin
  if v_sede ->> 'tipo' = 'nueva' then
    insert into public.eventos_sedes (nombre, direccion, distrito)
    values (v_sede ->> 'nombre', v_sede ->> 'direccion', v_sede ->> 'distrito')
    returning id, distrito into v_sede_id, v_distrito;
    insert into public.eventos_secciones (sede_id, nombre, orden, tipo, capacidad)
    values (v_sede_id, 'General', 1, 'general', (v_sede ->> 'capacidad')::integer);
  else
    select s.id, s.distrito into v_sede_id, v_distrito
    from public.eventos_sedes s
    where s.id = (v_sede ->> 'sede_id')::uuid
    for share;
    if not found then
      raise exception using errcode = 'P0001', message = 'SEDE_NO_EXISTE',
        detail = 'La sede indicada no existe';
    end if;
  end if;

  v_capacidad := public.eventos_capacidad_sede(v_sede_id);
  if v_aforo > v_capacidad then
    raise exception using errcode = 'P0001', message = 'AFORO_SUPERA_SEDE',
      detail = format('El aforo (%s) supera la capacidad de la sede (%s)', v_aforo, v_capacidad);
  end if;

  -- Las categorías se vinculan a la zona general solo si es la única sección de la sede.
  -- En sedes numeradas o con varias zonas, los precios por sección o rango son de la pizarra (2.3 y 2.4).
  select s.id into v_seccion_general
  from public.eventos_secciones s
  where s.sede_id = v_sede_id and s.tipo = 'general'
    and (select count(*) from public.eventos_secciones t where t.sede_id = v_sede_id) = 1;

  insert into public.eventos_eventos (organizador_id, sede_id, titulo, descripcion, categoria, distrito,
    inicio, estado, hay_musica, constancia_apdayc_url, foto_url, aforo)
  values ((datos ->> 'organizador_id')::uuid, v_sede_id, datos ->> 'titulo', datos ->> 'descripcion',
    datos ->> 'categoria', v_distrito, (datos ->> 'inicio')::timestamptz, 'pendiente',
    (datos ->> 'hay_musica')::boolean, datos ->> 'constancia_apdayc_url', datos ->> 'foto_url', v_aforo)
  returning id into v_evento_id;

  for v_categoria in select * from jsonb_array_elements(datos -> 'categorias') loop
    insert into public.eventos_categorias_precio (evento_id, sede_id, nombre, color, precio_centimos, seccion_id)
    values (v_evento_id, v_sede_id, v_categoria ->> 'nombre', v_categoria ->> 'color',
      (v_categoria ->> 'precio_centimos')::integer, v_seccion_general);
  end loop;

  return v_evento_id;
end;
$$;

-- AD-1: solo la API (service_role) ejecuta estas funciones.
revoke all on function public.eventos_capacidad_sede(uuid) from public, anon, authenticated;
revoke all on function public.eventos_listar_sedes() from public, anon, authenticated;
revoke all on function public.eventos_crear_evento(jsonb) from public, anon, authenticated;
grant execute on function public.eventos_capacidad_sede(uuid) to service_role;
grant execute on function public.eventos_listar_sedes() to service_role;
grant execute on function public.eventos_crear_evento(jsonb) to service_role;
