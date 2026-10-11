-- Preparacion de Supabase remoto: 2026-10-11
-- Fuente exacta: origin/main b2209ee3b830a8198ab551a2c87fa2b7aa17ed35
-- Contiene 9 migraciones pendientes, desde eventos hasta comision.
-- Requiere salud() e identidad_perfiles ya instalados.
-- Ejecutar el archivo completo en SQL Editor. Si falla, la transaccion no aplica cambios.
-- No carga seed.sql ni copia usuarios, eventos, entradas o archivos locales.
-- No registra historial de Supabase CLI: este paquete es para SQL Editor.

begin;

do $preflight$
declare
  nombre text;
begin
  if to_regclass('public.identidad_perfiles') is null or to_regprocedure('public.salud()') is null then
    raise exception 'Falta la base de salud/identidad. Revisar el proyecto antes de ejecutar.';
  end if;
  foreach nombre in array array['eventos_sedes', 'eventos_secciones', 'eventos_filas', 'eventos_bloques', 'eventos_asientos', 'eventos_eventos', 'eventos_categorias_precio', 'marketing_piezas', 'ventas_config_comision', 'ventas_evento_cupos', 'ventas_ordenes', 'ventas_entradas', 'notificaciones_bandeja', 'marketing_enlaces', 'marketing_clics', 'eventos_precios_rango'] loop
    if to_regclass('public.' || nombre) is not null then
      raise exception 'La tabla % ya existe. No repetir este paquete; revisar migraciones pendientes.', nombre;
    end if;
  end loop;
end;
$preflight$;

-- INICIO supabase/migrations/20261010020000_eventos.sql
-- Historia 1.3: mapa de la sede y eventos, sin inventario ni ventas (AD-4).
create table public.eventos_sedes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) > 0),
  direccion text not null check (length(btrim(direccion)) > 0),
  distrito text not null check (length(btrim(distrito)) > 0),
  creado_en timestamptz not null default now()
);

create table public.eventos_secciones (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references public.eventos_sedes(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  orden integer not null check (orden > 0),
  tipo text not null check (tipo in ('numerada', 'general')),
  capacidad integer,
  creado_en timestamptz not null default now(),
  check ((tipo = 'numerada' and capacidad is null) or (tipo = 'general' and capacidad > 0 and capacidad is not null)),
  unique (sede_id, orden),
  unique (sede_id, nombre),
  unique (id, tipo),
  unique (id, sede_id, tipo)
);

create table public.eventos_filas (
  id uuid primary key default gen_random_uuid(),
  seccion_id uuid not null,
  -- La FK impide filas en una sección general, también al cambiar su tipo.
  seccion_tipo text generated always as ('numerada'::text) stored,
  nombre text not null check (length(btrim(nombre)) > 0),
  orden integer not null check (orden > 0),
  creado_en timestamptz not null default now(),
  foreign key (seccion_id, seccion_tipo) references public.eventos_secciones(id, tipo) on delete cascade,
  unique (seccion_id, nombre),
  unique (seccion_id, orden)
);

create table public.eventos_bloques (
  id uuid primary key default gen_random_uuid(),
  fila_id uuid not null references public.eventos_filas(id) on delete cascade,
  orden integer not null check (orden > 0),
  desplazamiento integer not null default 0 check (desplazamiento >= 0),
  creado_en timestamptz not null default now(),
  unique (fila_id, orden),
  unique (id, fila_id)
);

create table public.eventos_asientos (
  id uuid primary key default gen_random_uuid(),
  bloque_id uuid not null,
  fila_id uuid not null,
  numero integer not null check (numero > 0),
  creado_en timestamptz not null default now(),
  foreign key (bloque_id, fila_id) references public.eventos_bloques(id, fila_id) on delete cascade,
  unique (fila_id, numero)
);
create index eventos_asientos_bloque_idx on public.eventos_asientos(bloque_id);

create table public.eventos_eventos (
  id uuid primary key default gen_random_uuid(),
  organizador_id uuid not null references auth.users(id),
  sede_id uuid not null references public.eventos_sedes(id),
  titulo text not null check (length(btrim(titulo)) > 0),
  descripcion text not null check (length(btrim(descripcion)) > 0),
  categoria text not null check (categoria in ('musica', 'teatro', 'danza', 'artes_visuales', 'cine', 'literatura', 'otro')),
  distrito text not null check (length(btrim(distrito)) > 0),
  inicio timestamptz not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  motivo_rechazo text,
  destacado boolean not null default false,
  hay_musica boolean not null default false,
  constancia_apdayc_url text,
  foto_url text,
  aforo integer not null check (aforo > 0),
  creado_en timestamptz not null default now(),
  unique (id, sede_id)
);
create index eventos_eventos_catalogo_idx on public.eventos_eventos(estado, inicio);
create index eventos_eventos_categoria_idx on public.eventos_eventos(categoria, inicio) where estado = 'aprobado';
create index eventos_eventos_distrito_idx on public.eventos_eventos(distrito, inicio) where estado = 'aprobado';
create index eventos_eventos_destacado_idx on public.eventos_eventos(inicio) where estado = 'aprobado' and destacado;
create index eventos_eventos_organizador_idx on public.eventos_eventos(organizador_id);
create index eventos_eventos_sede_idx on public.eventos_eventos(sede_id);

create table public.eventos_categorias_precio (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  sede_id uuid not null,
  nombre text not null check (length(btrim(nombre)) > 0),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  precio_centimos integer not null check (precio_centimos >= 0),
  -- Solo las zonas generales se vinculan aquí. Los rangos numerados son de la 2.4.
  seccion_id uuid,
  seccion_tipo text generated always as ('general'::text) stored,
  creado_en timestamptz not null default now(),
  -- Una única sede compartida asegura la pertenencia incluso si cambian los padres.
  foreign key (evento_id, sede_id) references public.eventos_eventos(id, sede_id) on delete cascade,
  foreign key (seccion_id, sede_id, seccion_tipo) references public.eventos_secciones(id, sede_id, tipo),
  unique (evento_id, nombre)
);
create index eventos_categorias_precio_seccion_idx on public.eventos_categorias_precio(seccion_id);
comment on column public.eventos_categorias_precio.precio_centimos is 'Céntimos de PEN, IGV incluido (AD-10).';

-- AD-1: ninguna tabla de eventos es accesible directamente desde el navegador.
alter table public.eventos_sedes enable row level security;
alter table public.eventos_secciones enable row level security;
alter table public.eventos_filas enable row level security;
alter table public.eventos_bloques enable row level security;
alter table public.eventos_asientos enable row level security;
alter table public.eventos_eventos enable row level security;
alter table public.eventos_categorias_precio enable row level security;
revoke all on public.eventos_sedes, public.eventos_secciones, public.eventos_filas,
  public.eventos_bloques, public.eventos_asientos, public.eventos_eventos,
  public.eventos_categorias_precio from public, anon, authenticated;
grant select, insert, update, delete on public.eventos_sedes, public.eventos_secciones,
  public.eventos_filas, public.eventos_bloques, public.eventos_asientos,
  public.eventos_eventos, public.eventos_categorias_precio to service_role;
-- FIN supabase/migrations/20261010020000_eventos.sql

-- INICIO supabase/migrations/20261011000000_eventos_alta.sql
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
-- FIN supabase/migrations/20261011000000_eventos_alta.sql

-- INICIO supabase/migrations/20261011010000_marketing.sql
-- Historia 3.1: módulo `marketing`, piezas de los eventos (CAP-8).
-- Una fila por generación: la IA (o el respaldo) aporta textos, paleta y campaña; fecha, sede y
-- precio no se guardan aquí, se leen del evento al servir la pieza (AD-11). La 3.2 cuelga enlaces de ella.
create table public.marketing_piezas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos_eventos(id) on delete cascade,
  organizador_id uuid not null references auth.users(id),
  origen text not null check (origen in ('ia', 'respaldo')),
  textos jsonb not null check (jsonb_typeof(textos) = 'object'),
  paleta jsonb not null check (jsonb_typeof(paleta) = 'object'),
  campana jsonb not null check (jsonb_typeof(campana) = 'object'),
  creado_en timestamptz not null default now()
);
create index marketing_piezas_evento_idx on public.marketing_piezas(evento_id, creado_en desc);
create index marketing_piezas_organizador_idx on public.marketing_piezas(organizador_id);
comment on column public.marketing_piezas.campana is 'Presupuesto en soles enteros por red y calendario (fechas en America/Lima).';

-- AD-1: ninguna tabla de marketing es accesible directamente desde el navegador.
alter table public.marketing_piezas enable row level security;
revoke all on public.marketing_piezas from public, anon, authenticated;
grant select, insert, update, delete on public.marketing_piezas to service_role;
-- FIN supabase/migrations/20261011010000_marketing.sql

-- INICIO supabase/migrations/20261011020000_eventos_mapa.sql
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
-- FIN supabase/migrations/20261011020000_eventos_mapa.sql

-- INICIO supabase/migrations/20261012000000_eventos_aprobacion.sql
-- Historia 1.5: señal informativa para la revisión; no ejecuta IA.
-- Conserva RLS y los permisos exclusivos de service_role (AD-1).
alter table public.eventos_eventos add column alerta_apdayc text;
comment on column public.eventos_eventos.alerta_apdayc is
  'Alerta nullable para la revisión administrativa de música/APDAYC.';
-- FIN supabase/migrations/20261012000000_eventos_aprobacion.sql

-- INICIO supabase/migrations/20261013000000_ventas.sql
-- Historia 2.1: compra mínima de zona general y bandeja de salida de WhatsApp.
-- Módulo `ventas`: comisión vigente, cupos por zona general, órdenes y entradas (AD-5, AD-6, AD-7, AD-10).
-- Módulo `notificaciones`: bandeja de salida (AD-9); el envío real llega en la 2.2.
-- Sin butacas numeradas (`ventas_evento_asientos` es de la 2.5).

-- Comisión de la plataforma. Una sola fila vigente; la orden la congela al pagarse (AD-10).
create table public.ventas_config_comision (
  id uuid primary key default gen_random_uuid(),
  modelo text not null check (modelo in ('porcentaje', 'fijo_por_entrada', 'tarifa_evento')),
  valor integer not null check (valor >= 0),
  vigente boolean not null default true,
  creado_en timestamptz not null default now(),
  check (modelo <> 'porcentaje' or valor <= 10000)
);
create unique index ventas_config_comision_vigente_idx on public.ventas_config_comision (vigente) where vigente;
comment on column public.ventas_config_comision.valor is
  'porcentaje: puntos básicos (500 = 5 %); fijo_por_entrada: céntimos por entrada; tarifa_evento: céntimos por evento (lo liquida la 4.2).';
-- Decisión del 11/10/2026: 5 % sobre el total de la orden.
insert into public.ventas_config_comision (modelo, valor) values ('porcentaje', 500);

-- Cupo de cada zona general de un evento. `vendidas` cuenta las entradas pagadas y las reservadas por
-- órdenes pendientes no vencidas. `capacidad` = least(capacidad de la zona, aforo del evento).
create table public.ventas_evento_cupos (
  evento_id uuid not null references public.eventos_eventos(id) on delete cascade,
  seccion_id uuid not null references public.eventos_secciones(id) on delete cascade,
  capacidad integer not null check (capacidad > 0),
  vendidas integer not null default 0 check (vendidas >= 0),
  creado_en timestamptz not null default now(),
  primary key (evento_id, seccion_id),
  check (vendidas <= capacidad)
);

create table public.ventas_ordenes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  evento_id uuid not null references public.eventos_eventos(id) on delete cascade,
  categoria_id uuid not null references public.eventos_categorias_precio(id) on delete cascade,
  seccion_id uuid not null,
  cantidad integer not null check (cantidad between 1 and 10),
  precio_unitario_centimos integer not null check (precio_unitario_centimos >= 0),
  total_centimos integer not null check (total_centimos >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagada', 'expirada')),
  expira_en timestamptz not null,
  -- Código del enlace rastreable (AD-8): se guarda tal cual, sin validarlo.
  ref text check (ref is null or length(ref) between 1 and 64),
  metodo_pago text check (metodo_pago in ('tarjeta', 'yape', 'plin')),
  pasarela_ref text,
  comision_modelo text check (comision_modelo in ('porcentaje', 'fijo_por_entrada', 'tarifa_evento')),
  comision_valor integer check (comision_valor >= 0),
  comision_importe integer check (comision_importe >= 0),
  pagada_en timestamptz,
  creado_en timestamptz not null default now(),
  foreign key (evento_id, seccion_id) references public.ventas_evento_cupos(evento_id, seccion_id) on delete cascade,
  check (total_centimos = precio_unitario_centimos * cantidad),
  -- Una orden pagada lleva siempre el pago y la comisión congelada; las demás, nunca.
  check ((estado = 'pagada') = (metodo_pago is not null and pasarela_ref is not null and pagada_en is not null
    and comision_modelo is not null and comision_valor is not null and comision_importe is not null))
);
create index ventas_ordenes_pendientes_idx on public.ventas_ordenes(evento_id, expira_en) where estado = 'pendiente';
create index ventas_ordenes_usuario_idx on public.ventas_ordenes(usuario_id);
create index ventas_ordenes_ref_idx on public.ventas_ordenes(ref) where estado = 'pagada';
comment on column public.ventas_ordenes.total_centimos is 'Céntimos de PEN, IGV incluido (AD-10).';
comment on column public.ventas_ordenes.comision_importe is 'Céntimos; congelado al pagarse con la configuración vigente (AD-10).';

-- Una fila por entrada. El QR (`id.firma`) se calcula en la API con QR_SECRET y no se guarda (AD-7).
create table public.ventas_entradas (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ventas_ordenes(id) on delete cascade,
  evento_id uuid not null references public.eventos_eventos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id),
  categoria_id uuid not null references public.eventos_categorias_precio(id) on delete cascade,
  -- Solo la escribe `acceso` (a través de `VentasService.consumirEntrada`).
  usada_en timestamptz,
  creado_en timestamptz not null default now()
);
create index ventas_entradas_orden_idx on public.ventas_entradas(orden_id);
create index ventas_entradas_usuario_idx on public.ventas_entradas(usuario_id, creado_en desc);
create index ventas_entradas_evento_idx on public.ventas_entradas(evento_id);

-- Bandeja de salida de WhatsApp (AD-9). Los módulos solo insertan `pendiente`; el envío es de la 2.2.
create table public.notificaciones_bandeja (
  id uuid primary key default gen_random_uuid(),
  telefono text not null check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  plantilla text not null check (length(btrim(plantilla)) > 0),
  datos jsonb not null default '{}'::jsonb check (jsonb_typeof(datos) = 'object'),
  adjunto_url text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'fallido')),
  intentos integer not null default 0 check (intentos between 0 and 3),
  enviado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index notificaciones_bandeja_pendientes_idx on public.notificaciones_bandeja(creado_en) where estado = 'pendiente';

-- AD-1: ninguna tabla de ventas ni de notificaciones es accesible desde el navegador.
alter table public.ventas_config_comision enable row level security;
alter table public.ventas_evento_cupos enable row level security;
alter table public.ventas_ordenes enable row level security;
alter table public.ventas_entradas enable row level security;
alter table public.notificaciones_bandeja enable row level security;
revoke all on public.ventas_config_comision, public.ventas_evento_cupos, public.ventas_ordenes,
  public.ventas_entradas, public.notificaciones_bandeja from public, anon, authenticated;
grant select, insert, update, delete on public.ventas_config_comision, public.ventas_evento_cupos,
  public.ventas_ordenes, public.ventas_entradas, public.notificaciones_bandeja to service_role;

-- Comisión de una orden en céntimos (AD-10). La API tiene la misma regla en `calcularComision`.
create function public.ventas_calcular_comision(p_modelo text, p_valor integer, p_total integer, p_cantidad integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_modelo
    when 'porcentaje' then round(p_total::numeric * p_valor / 10000)::integer
    when 'fijo_por_entrada' then p_valor * p_cantidad
    when 'tarifa_evento' then 0
  end;
$$;

-- Cupos de las zonas generales de un evento. Idempotente: un cupo existente no cambia.
-- `p_cupos`: [{ "seccion_id": uuid, "capacidad": int }], calculado por la API desde `eventos`.
create function public.ventas_asegurar_cupos(p_evento_id uuid, p_cupos jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ventas_evento_cupos (evento_id, seccion_id, capacidad)
  select p_evento_id, (c ->> 'seccion_id')::uuid, (c ->> 'capacidad')::integer
  from jsonb_array_elements(coalesce(p_cupos, '[]'::jsonb)) c
  on conflict (evento_id, seccion_id) do nothing;
$$;

-- Orden `pendiente` que reserva el cupo 10 minutos, o hasta el inicio si llega antes (AD-5).
-- Bloquea los cupos del evento (siempre en el mismo orden), expira las pendientes vencidas
-- devolviendo su cupo, descuenta con un UPDATE condicional y comprueba el aforo del evento.
-- Errores P0001: VENTA_CERRADA, CATEGORIA_NO_VALIDA, SIN_CUPO.
create function public.ventas_crear_orden(p_datos jsonb)
returns public.ventas_ordenes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento uuid := (p_datos ->> 'evento_id')::uuid;
  v_seccion uuid := (p_datos ->> 'seccion_id')::uuid;
  v_cantidad integer := (p_datos ->> 'cantidad')::integer;
  v_precio integer := (p_datos ->> 'precio_unitario_centimos')::integer;
  v_aforo integer := (p_datos ->> 'aforo')::integer;
  v_orden public.ventas_ordenes;
begin
  if now() >= (p_datos ->> 'inicio')::timestamptz then
    raise exception using errcode = 'P0001', message = 'VENTA_CERRADA',
      detail = 'El evento ya empezó: la venta está cerrada';
  end if;

  perform public.ventas_asegurar_cupos(v_evento, p_datos -> 'cupos');
  perform 1 from public.ventas_evento_cupos c where c.evento_id = v_evento order by c.seccion_id for update;

  -- Vencimiento perezoso: las pendientes vencidas del evento devuelven su cupo.
  with vencidas as (
    update public.ventas_ordenes o set estado = 'expirada'
    where o.evento_id = v_evento and o.estado = 'pendiente' and o.expira_en <= now()
    returning o.seccion_id, o.cantidad
  )
  update public.ventas_evento_cupos c set vendidas = c.vendidas - v.total
  from (select seccion_id, sum(cantidad)::integer as total from vencidas group by seccion_id) v
  where c.evento_id = v_evento and c.seccion_id = v.seccion_id;

  update public.ventas_evento_cupos c set vendidas = c.vendidas + v_cantidad
  where c.evento_id = v_evento and c.seccion_id = v_seccion and c.vendidas + v_cantidad <= c.capacidad;
  if not found then
    if not exists (select 1 from public.ventas_evento_cupos c where c.evento_id = v_evento and c.seccion_id = v_seccion) then
      raise exception using errcode = 'P0001', message = 'CATEGORIA_NO_VALIDA',
        detail = 'La categoría no tiene una zona general a la venta';
    end if;
    raise exception using errcode = 'P0001', message = 'SIN_CUPO',
      detail = 'No quedan entradas suficientes en esta zona';
  end if;
  if (select sum(c.vendidas) from public.ventas_evento_cupos c where c.evento_id = v_evento) > v_aforo then
    raise exception using errcode = 'P0001', message = 'SIN_CUPO',
      detail = 'No quedan entradas suficientes: se alcanzó el aforo del evento';
  end if;

  insert into public.ventas_ordenes (usuario_id, evento_id, categoria_id, seccion_id, cantidad,
    precio_unitario_centimos, total_centimos, expira_en, ref)
  values ((p_datos ->> 'usuario_id')::uuid, v_evento, (p_datos ->> 'categoria_id')::uuid, v_seccion, v_cantidad,
    v_precio, v_precio * v_cantidad,
    -- La reserva nunca pasa del inicio: el vencimiento cierra también el pago a esa hora (AD-5).
    least(now() + interval '10 minutes', (p_datos ->> 'inicio')::timestamptz), nullif(p_datos ->> 'ref', ''))
  returning * into v_orden;
  return v_orden;
end;
$$;

-- Expira una orden pendiente vencida y devuelve su cupo. `true` si la orden queda (o ya estaba) expirada.
create function public.ventas_expirar_orden(p_orden_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento uuid;
  v_orden public.ventas_ordenes;
begin
  select o.evento_id into v_evento from public.ventas_ordenes o where o.id = p_orden_id;
  if not found then
    return false;
  end if;
  -- Primero los cupos y luego la orden, en el mismo orden que `ventas_crear_orden` (sin interbloqueos).
  perform 1 from public.ventas_evento_cupos c where c.evento_id = v_evento order by c.seccion_id for update;
  select * into v_orden from public.ventas_ordenes o where o.id = p_orden_id for update;
  if v_orden.estado = 'expirada' then
    return true;
  end if;
  if v_orden.estado <> 'pendiente' or v_orden.expira_en > now() then
    return false;
  end if;
  update public.ventas_ordenes set estado = 'expirada' where id = p_orden_id;
  update public.ventas_evento_cupos c set vendidas = c.vendidas - v_orden.cantidad
  where c.evento_id = v_orden.evento_id and c.seccion_id = v_orden.seccion_id;
  return true;
end;
$$;

-- Paso a `pagada` tras la confirmación de `PasarelaPago` (AD-6): congela la comisión vigente (AD-10)
-- y crea las entradas. Si la orden venció, la expira y devuelve { resultado: 'expirada' } (la API anula
-- el cobro). Errores P0001: ORDEN_NO_ENCONTRADA, ORDEN_NO_PENDIENTE, COMISION_NO_CONFIGURADA.
create function public.ventas_confirmar_pago(p_orden_id uuid, p_usuario_id uuid, p_metodo text, p_pasarela_ref text)
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

  insert into public.ventas_entradas (orden_id, evento_id, usuario_id, categoria_id)
  select v_orden.id, v_orden.evento_id, v_orden.usuario_id, v_orden.categoria_id
  from generate_series(1, v_orden.cantidad);

  return jsonb_build_object(
    'resultado', 'pagada',
    'orden', to_jsonb(v_orden),
    'entradas', (select jsonb_agg(e.id order by e.id) from public.ventas_entradas e where e.orden_id = v_orden.id)
  );
end;
$$;

-- AD-1: solo la API (service_role) ejecuta estas funciones.
revoke all on function public.ventas_calcular_comision(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.ventas_asegurar_cupos(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.ventas_crear_orden(jsonb) from public, anon, authenticated;
revoke all on function public.ventas_expirar_orden(uuid) from public, anon, authenticated;
revoke all on function public.ventas_confirmar_pago(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.ventas_calcular_comision(text, integer, integer, integer) to service_role;
grant execute on function public.ventas_asegurar_cupos(uuid, jsonb) to service_role;
grant execute on function public.ventas_crear_orden(jsonb) to service_role;
grant execute on function public.ventas_expirar_orden(uuid) to service_role;
grant execute on function public.ventas_confirmar_pago(uuid, uuid, text, text) to service_role;
-- FIN supabase/migrations/20261013000000_ventas.sql

-- INICIO supabase/migrations/20261014000000_marketing_enlaces.sql
-- Historia 3.2: enlaces rastreables y clics (CAP-10, AD-8).
-- El enlace `<web>/r/:codigo` registra un clic y redirige a la ficha con `?ref=:codigo`. Las ventas no se
-- guardan aquí: se leen con `VentasService.ventasPorRef` uniendo `ventas_ordenes.ref` con `codigo`.
create table public.marketing_enlaces (
  id uuid primary key default gen_random_uuid(),
  -- Base62 de 8 caracteres, aleatorio; la API reintenta si choca con uno existente.
  codigo char(8) not null unique check (codigo ~ '^[0-9A-Za-z]{8}$'),
  evento_id uuid not null references public.eventos_eventos(id) on delete cascade,
  -- Nullable: las campañas del Weekend (3.7) cuelgan enlaces sin pieza.
  pieza_id uuid references public.marketing_piezas(id) on delete cascade,
  red text check (red in ('instagram', 'facebook', 'whatsapp', 'tiktok', 'x')),
  zona text check (zona is null or char_length(zona) between 1 and 60),
  organizador_id uuid not null references auth.users(id),
  creado_en timestamptz not null default now()
);
create index marketing_enlaces_pieza_idx on public.marketing_enlaces(pieza_id, creado_en);
create index marketing_enlaces_evento_idx on public.marketing_enlaces(evento_id);
create index marketing_enlaces_organizador_idx on public.marketing_enlaces(organizador_id);

-- Un clic por visita a `/r/:codigo`. Sin datos personales: ni IP ni user-agent.
create table public.marketing_clics (
  id uuid primary key default gen_random_uuid(),
  enlace_id uuid not null references public.marketing_enlaces(id) on delete cascade,
  creado_en timestamptz not null default now()
);
create index marketing_clics_enlace_idx on public.marketing_clics(enlace_id, creado_en);

-- AD-1: ninguna tabla de marketing es accesible directamente desde el navegador.
alter table public.marketing_enlaces enable row level security;
revoke all on public.marketing_enlaces from public, anon, authenticated;
grant select, insert, update, delete on public.marketing_enlaces to service_role;

alter table public.marketing_clics enable row level security;
revoke all on public.marketing_clics from public, anon, authenticated;
grant select, insert, update, delete on public.marketing_clics to service_role;
-- FIN supabase/migrations/20261014000000_marketing_enlaces.sql

-- INICIO supabase/migrations/20261015000000_eventos_precios.sql
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
-- FIN supabase/migrations/20261015000000_eventos_precios.sql

-- INICIO supabase/migrations/20261016000000_ventas_comision.sql
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
-- FIN supabase/migrations/20261016000000_ventas_comision.sql

notify pgrst, 'reload schema';
commit;
