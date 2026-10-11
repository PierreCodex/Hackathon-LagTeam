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
