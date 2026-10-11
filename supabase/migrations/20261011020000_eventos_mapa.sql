-- Historia 2.3: mapa de la sede (crear, leer, reemplazar y duplicar) y publicación del evento.
-- Cada sede tiene dueño; solo su dueño reemplaza el mapa, y publicar un evento cierra el mapa de su sede (AD-4).

alter table public.eventos_eventos
  add column publicado boolean not null default false,
  add column publicado_en timestamptz,
  add constraint eventos_eventos_publicado_aprobado check (not publicado or estado = 'aprobado');
create index eventos_eventos_publicados_idx on public.eventos_eventos(inicio) where estado = 'aprobado' and publicado;

-- `creado_por` nulo: sede de la semilla (o de una cuenta borrada); nadie la edita.
alter table public.eventos_sedes
  add column mapa_cerrado boolean not null default false,
  add column creado_por uuid references auth.users(id) on delete set null;
create index eventos_sedes_creado_por_idx on public.eventos_sedes(creado_por);

-- Alta de la 1.4: la sede nueva queda a nombre del organizador, y una sede existente solo se usa si es
-- propia o tiene el mapa cerrado (publicada o sembrada): así los cambios de su dueño nunca afectan eventos ajenos.
-- Errores P0001: `SEDE_NO_EXISTE`, `SEDE_AJENA`, `AFORO_SUPERA_SEDE`.
create or replace function public.eventos_crear_evento(datos jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sede jsonb := datos -> 'sede';
  v_sede_id uuid;
  v_distrito text;
  v_creado_por uuid;
  v_mapa_cerrado boolean;
  v_capacidad bigint;
  v_aforo integer := (datos ->> 'aforo')::integer;
  v_seccion_general uuid;
  v_evento_id uuid;
  v_categoria jsonb;
begin
  if v_sede ->> 'tipo' = 'nueva' then
    insert into public.eventos_sedes (nombre, direccion, distrito, creado_por)
    values (v_sede ->> 'nombre', v_sede ->> 'direccion', v_sede ->> 'distrito', (datos ->> 'organizador_id')::uuid)
    returning id, distrito into v_sede_id, v_distrito;
    insert into public.eventos_secciones (sede_id, nombre, orden, tipo, capacidad)
    values (v_sede_id, 'General', 1, 'general', (v_sede ->> 'capacidad')::integer);
  else
    select s.id, s.distrito, s.creado_por, s.mapa_cerrado into v_sede_id, v_distrito, v_creado_por, v_mapa_cerrado
    from public.eventos_sedes s
    where s.id = (v_sede ->> 'sede_id')::uuid
    for share;
    if not found then
      raise exception using errcode = 'P0001', message = 'SEDE_NO_EXISTE',
        detail = 'La sede indicada no existe';
    end if;
    if not v_mapa_cerrado and v_creado_por is distinct from (datos ->> 'organizador_id')::uuid then
      raise exception using errcode = 'P0001', message = 'SEDE_AJENA',
        detail = 'La sede es de otro organizador y su mapa aún puede cambiar: crea tu propio local o duplícalo';
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

-- `propia` en la lista significa "la puedes editar": es de quien la pide y su mapa sigue abierto.
-- Si no, la UI ofrece usarla (si está cerrada) o duplicarla.
drop function public.eventos_listar_sedes();
create function public.eventos_listar_sedes(p_organizador uuid default null)
returns table (id uuid, nombre text, direccion text, distrito text, capacidad bigint, propia boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.nombre, s.direccion, s.distrito, c.capacidad,
    coalesce(s.creado_por = p_organizador and not s.mapa_cerrado, false) as propia
  from public.eventos_sedes s
  cross join lateral (select public.eventos_capacidad_sede(s.id) as capacidad) c
  where c.capacidad > 0
  order by s.nombre, s.id;
$$;

-- Mapa de una sede como jsonb (forma de `MapaSedeSchema`), ordenado. Nulo si la sede no existe.
create function public.eventos_leer_mapa(p_sede_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'nombre', s.nombre, 'direccion', s.direccion, 'distrito', s.distrito,
    'secciones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sec.id, 'nombre', sec.nombre, 'orden', sec.orden, 'tipo', sec.tipo, 'capacidad', sec.capacidad,
        'filas', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', f.id, 'nombre', f.nombre, 'orden', f.orden,
            'bloques', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', b.id, 'orden', b.orden, 'desplazamiento', b.desplazamiento,
                'asientos', coalesce((
                  select jsonb_agg(jsonb_build_object('id', a.id, 'numero', a.numero) order by a.numero)
                  from public.eventos_asientos a where a.bloque_id = b.id), '[]'::jsonb)
              ) order by b.orden)
              from public.eventos_bloques b where b.fila_id = f.id), '[]'::jsonb)
          ) order by f.orden)
          from public.eventos_filas f where f.seccion_id = sec.id), '[]'::jsonb)
      ) order by sec.orden)
      from public.eventos_secciones sec where sec.sede_id = s.id), '[]'::jsonb)
  )
  from public.eventos_sedes s
  where s.id = p_sede_id;
$$;

-- Inserta secciones (con sus filas, bloques y asientos) en una sede. Solo la usan las RPC de este archivo.
-- `p_secciones`: arreglo con la forma de `MapaSedeEntradaSchema.secciones`; los ids se ignoran.
create function public.eventos_insertar_secciones(p_sede_id uuid, p_secciones jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_seccion jsonb;
  v_fila jsonb;
  v_bloque jsonb;
  v_seccion_id uuid;
  v_fila_id uuid;
  v_bloque_id uuid;
begin
  for v_seccion in select * from jsonb_array_elements(coalesce(p_secciones, '[]'::jsonb)) loop
    insert into public.eventos_secciones (sede_id, nombre, orden, tipo, capacidad)
    values (p_sede_id, v_seccion ->> 'nombre', (v_seccion ->> 'orden')::integer, v_seccion ->> 'tipo',
      case when v_seccion ->> 'tipo' = 'general' then (v_seccion ->> 'capacidad')::integer end)
    returning id into v_seccion_id;
    if v_seccion ->> 'tipo' <> 'numerada' then
      continue;
    end if;
    for v_fila in select * from jsonb_array_elements(coalesce(v_seccion -> 'filas', '[]'::jsonb)) loop
      insert into public.eventos_filas (seccion_id, nombre, orden)
      values (v_seccion_id, v_fila ->> 'nombre', (v_fila ->> 'orden')::integer)
      returning id into v_fila_id;
      for v_bloque in select * from jsonb_array_elements(coalesce(v_fila -> 'bloques', '[]'::jsonb)) loop
        insert into public.eventos_bloques (fila_id, orden, desplazamiento)
        values (v_fila_id, (v_bloque ->> 'orden')::integer, (v_bloque ->> 'desplazamiento')::integer)
        returning id into v_bloque_id;
        insert into public.eventos_asientos (bloque_id, fila_id, numero)
        select v_bloque_id, v_fila_id, (a ->> 'numero')::integer
        from jsonb_array_elements(coalesce(v_bloque -> 'asientos', '[]'::jsonb)) a;
      end loop;
    end loop;
  end loop;
end;
$$;

-- Crea una sede con su mapa (`p_sede_id` nulo) o reemplaza el mapa entero de una sede propia, en una transacción.
-- Las zonas generales que traen el `id` de una zona general de esta sede se conservan (con sus categorías);
-- el resto de secciones, filas, bloques y asientos se borra y se inserta de nuevo. Devuelve el id de la sede.
-- Errores P0001: `SEDE_NO_EXISTE`, `SEDE_AJENA`, `MAPA_CERRADO`, `SECCION_EN_USO`.
create function public.eventos_guardar_mapa(p_organizador uuid, p_sede_id uuid, p_mapa jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sede public.eventos_sedes%rowtype;
  v_sede_id uuid;
  v_conservadas uuid[];
  v_seccion jsonb;
begin
  if p_sede_id is null then
    insert into public.eventos_sedes (nombre, direccion, distrito, creado_por)
    values (p_mapa ->> 'nombre', p_mapa ->> 'direccion', p_mapa ->> 'distrito', p_organizador)
    returning id into v_sede_id;
    perform public.eventos_insertar_secciones(v_sede_id, p_mapa -> 'secciones');
    return v_sede_id;
  end if;

  select * into v_sede from public.eventos_sedes s where s.id = p_sede_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SEDE_NO_EXISTE', detail = 'La sede indicada no existe';
  end if;
  if v_sede.creado_por is distinct from p_organizador then
    raise exception using errcode = 'P0001', message = 'SEDE_AJENA',
      detail = 'La sede no es tuya: puedes usarla o duplicarla, pero no cambiar su mapa';
  end if;
  if v_sede.mapa_cerrado then
    raise exception using errcode = 'P0001', message = 'MAPA_CERRADO',
      detail = 'La sede tiene un evento publicado y su mapa ya no cambia: duplícala para usar otro mapa';
  end if;

  update public.eventos_sedes
  set nombre = p_mapa ->> 'nombre', direccion = p_mapa ->> 'direccion', distrito = p_mapa ->> 'distrito'
  where id = p_sede_id;
  -- El distrito de los eventos es el de su sede (lo copia el alta).
  update public.eventos_eventos e
  set distrito = p_mapa ->> 'distrito'
  where e.sede_id = p_sede_id and e.distrito is distinct from p_mapa ->> 'distrito';

  select coalesce(array_agg(s.id), '{}') into v_conservadas
  from public.eventos_secciones s
  where s.sede_id = p_sede_id and s.tipo = 'general'
    and s.id in (select (x ->> 'id')::uuid from jsonb_array_elements(p_mapa -> 'secciones') x
                 where x ->> 'tipo' = 'general' and x ? 'id');

  begin
    delete from public.eventos_secciones s where s.sede_id = p_sede_id and not (s.id = any (v_conservadas));
  exception when foreign_key_violation then
    raise exception using errcode = 'P0001', message = 'SECCION_EN_USO',
      detail = 'Una zona general que se quita tiene categorías de precio de un evento: consérvala enviando su id';
  end;

  -- Nombres y órdenes provisionales para que intercambiarlos entre zonas conservadas no choque con los únicos.
  update public.eventos_secciones s
  set nombre = '~' || s.id::text, orden = 1000000 + s.orden
  where s.id = any (v_conservadas);
  for v_seccion in select * from jsonb_array_elements(p_mapa -> 'secciones') loop
    if v_seccion ->> 'tipo' = 'general' and (v_seccion ->> 'id')::uuid = any (v_conservadas) then
      update public.eventos_secciones s
      set nombre = v_seccion ->> 'nombre', orden = (v_seccion ->> 'orden')::integer,
        capacidad = (v_seccion ->> 'capacidad')::integer
      where s.id = (v_seccion ->> 'id')::uuid;
    end if;
  end loop;

  perform public.eventos_insertar_secciones(p_sede_id, (
    select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(p_mapa -> 'secciones') x
    where not (x ->> 'tipo' = 'general' and x ? 'id' and (x ->> 'id')::uuid = any (v_conservadas))));
  return p_sede_id;
end;
$$;

-- Copia una sede y todo su mapa con ids nuevos, a nombre de quien la duplica, con el mapa abierto.
-- Errores P0001: `SEDE_NO_EXISTE`.
create function public.eventos_duplicar_sede(p_organizador uuid, p_sede_id uuid, p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mapa jsonb;
  v_sede_id uuid;
begin
  perform 1 from public.eventos_sedes s where s.id = p_sede_id for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'SEDE_NO_EXISTE', detail = 'La sede indicada no existe';
  end if;
  v_mapa := public.eventos_leer_mapa(p_sede_id);
  insert into public.eventos_sedes (nombre, direccion, distrito, creado_por)
  values (p_nombre, v_mapa ->> 'direccion', v_mapa ->> 'distrito', p_organizador)
  returning id into v_sede_id;
  perform public.eventos_insertar_secciones(v_sede_id, v_mapa -> 'secciones');
  return v_sede_id;
end;
$$;

-- Publica un evento aprobado de su organizador si la sede alcanza el aforo, y cierra el mapa de la sede.
-- Idempotente: publicar un evento ya publicado no cambia nada. Devuelve el id del evento.
-- Errores P0001: `EVENTO_NO_EXISTE`, `EVENTO_AJENO`, `EVENTO_NO_APROBADO`, `AFORO_SUPERA_SEDE`.
create function public.eventos_publicar_evento(p_organizador uuid, p_evento_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sede_id uuid;
  v_evento public.eventos_eventos%rowtype;
  v_capacidad bigint;
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

  update public.eventos_eventos set publicado = true, publicado_en = now() where id = v_evento.id;
  update public.eventos_sedes set mapa_cerrado = true where id = v_evento.sede_id;
  return v_evento.id;
end;
$$;

-- AD-1: solo la API (service_role) ejecuta estas funciones.
revoke all on function public.eventos_listar_sedes(uuid) from public, anon, authenticated;
revoke all on function public.eventos_leer_mapa(uuid) from public, anon, authenticated;
revoke all on function public.eventos_insertar_secciones(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.eventos_guardar_mapa(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.eventos_duplicar_sede(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.eventos_publicar_evento(uuid, uuid) from public, anon, authenticated;
grant execute on function public.eventos_listar_sedes(uuid) to service_role;
grant execute on function public.eventos_leer_mapa(uuid) to service_role;
grant execute on function public.eventos_guardar_mapa(uuid, uuid, jsonb) to service_role;
grant execute on function public.eventos_duplicar_sede(uuid, uuid, text) to service_role;
grant execute on function public.eventos_publicar_evento(uuid, uuid) to service_role;
