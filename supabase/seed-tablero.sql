-- Datos del tablero del administrador (bloque C del recorte final, CAP-12 y CAP-13).
-- Ficticios y repetibles: `supabase db reset` lo carga después de `seed.sql`; en producción se pega
-- en el SQL Editor. Crea un segundo organizador con dos eventos ya pasados (con asistencia), público
-- con ciudad y órdenes pagadas con la comisión congelada (5 %). No crea credenciales conocidas.
begin;

-- Segundo organizador y 24 compradores (cuentas sin contraseña).
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select u.id, 'authenticated', 'authenticated', u.email, '', now(), '{"provider":"email","providers":["email"]}',
  '{}', now(), now()
from (
  select '13000000-0000-4000-8000-000000000002'::uuid as id, 'colectivo.marinera@example.invalid' as email
  union all
  select ('13900000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'publico' || n || '@example.invalid'
  from generate_series(1, 24) n
) u
on conflict (id) do nothing;

-- Auth (`getUserById`) no encuentra cuentas sin `instance_id` y falla con los tokens en NULL:
-- así se lee el correo en la liquidación.
update auth.users set instance_id = coalesce(instance_id, '00000000-0000-0000-0000-000000000000'),
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''), email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''), email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''), phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where id::text like '13000000-0000-4000-8000-%' or id::text like '13900000-0000-4000-8000-%';

insert into public.identidad_perfiles (id, rol, whatsapp, ciudad, acepta_avisos)
select ('13900000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'publico',
  '+51900000' || lpad(n::text, 3, '0'),
  (array['Piura', 'Piura', 'Castilla', 'Sullana', 'Veintiséis de Octubre', 'Talara', 'Paita', null])[1 + n % 8],
  n % 2 = 0
from generate_series(1, 24) n
on conflict (id) do nothing;

-- Dos eventos ya pasados del segundo organizador, en la zona general del patio de Castilla.
-- Sin publicar: ya pasaron y no deben salir en el catálogo; el tablero los lee igual.
insert into public.eventos_eventos (id, organizador_id, sede_id, titulo, descripcion, categoria,
  distrito, inicio, estado, destacado, hay_musica, aforo, publicado, publicado_en)
values
  ('13600000-0000-4000-8000-000000000009', '13000000-0000-4000-8000-000000000002',
   '13100000-0000-4000-8000-000000000002', 'Festival de marinera norteña',
   'Concurso ficticio de parejas de marinera.', 'danza', 'Castilla', '2026-10-10 20:00:00-05',
   'aprobado', false, true, 120, false, null),
  ('13600000-0000-4000-8000-000000000010', '13000000-0000-4000-8000-000000000002',
   '13100000-0000-4000-8000-000000000002', 'Tondero y cumanana en vivo',
   'Noche ficticia de música tradicional.', 'musica', 'Sullana', '2026-10-09 20:00:00-05',
   'aprobado', false, true, 120, false, null)
on conflict (id) do nothing;

insert into public.eventos_categorias_precio (id, evento_id, sede_id, nombre, color, precio_centimos, seccion_id)
values
  ('13700000-0000-4000-8000-000000000091', '13600000-0000-4000-8000-000000000009',
   '13100000-0000-4000-8000-000000000002', 'General', '#059669', 3000, '13200000-0000-4000-8000-000000000004'),
  ('13700000-0000-4000-8000-000000000101', '13600000-0000-4000-8000-000000000010',
   '13100000-0000-4000-8000-000000000002', 'General', '#059669', 2000, '13200000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

-- Cupos de la zona general de los eventos con ventas (se recalculan al final).
insert into public.ventas_evento_cupos (evento_id, seccion_id, capacidad)
select ('13600000-0000-4000-8000-' || lpad(e::text, 12, '0'))::uuid, '13200000-0000-4000-8000-000000000004', 120
from unnest(array[3, 6, 9, 10]) e
on conflict (evento_id, seccion_id) do nothing;

-- 40 órdenes pagadas entre el 1 y el 8 de octubre, con la comisión del 5 % congelada.
with ordenes as (
  select n,
    md5('seed-tablero-orden-' || n)::uuid as id,
    ('13900000-0000-4000-8000-' || lpad((1 + n % 24)::text, 12, '0'))::uuid as usuario_id,
    (array[9, 10, 3, 6, 9])[1 + n % 5] as evento,
    1 + n % 3 as cantidad,
    ('2026-10-01 15:00:00-05'::timestamptz + make_interval(days => n % 8, hours => n % 5)) as pagada_en
  from generate_series(1, 40) n
), con_precio as (
  select o.*, c.id as categoria_id, c.precio_centimos
  from ordenes o
  join public.eventos_categorias_precio c
    on c.evento_id = ('13600000-0000-4000-8000-' || lpad(o.evento::text, 12, '0'))::uuid
   and c.seccion_id = '13200000-0000-4000-8000-000000000004'
)
insert into public.ventas_ordenes (id, usuario_id, evento_id, categoria_id, seccion_id, cantidad,
  precio_unitario_centimos, total_centimos, estado, expira_en, ref, metodo_pago, pasarela_ref,
  comision_modelo, comision_valor, comision_importe, pagada_en, creado_en)
select id, usuario_id, ('13600000-0000-4000-8000-' || lpad(evento::text, 12, '0'))::uuid, categoria_id,
  '13200000-0000-4000-8000-000000000004', cantidad, precio_centimos, precio_centimos * cantidad, 'pagada',
  pagada_en + interval '10 minutes', null, (array['yape', 'plin', 'tarjeta'])[1 + n % 3], 'semilla-' || n,
  'porcentaje', 500, public.ventas_calcular_comision('porcentaje', 500, precio_centimos * cantidad, cantidad),
  pagada_en, pagada_en - interval '2 minutes'
from con_precio
on conflict (id) do nothing;

-- Una entrada por unidad. En los eventos ya pasados, tres de cada cuatro se validaron en la puerta.
insert into public.ventas_entradas (id, orden_id, evento_id, usuario_id, categoria_id, usada_en, creado_en)
select md5('seed-tablero-entrada-' || o.id || '-' || k)::uuid, o.id, o.evento_id, o.usuario_id, o.categoria_id,
  case when e.inicio < now() and (k + get_byte(decode(md5(o.id::text), 'hex'), 0)) % 4 <> 0
    then e.inicio + interval '20 minutes' end,
  o.pagada_en
from public.ventas_ordenes o
join public.eventos_eventos e on e.id = o.evento_id
cross join lateral generate_series(1, o.cantidad) k
where o.pasarela_ref like 'semilla-%'
on conflict (id) do nothing;

-- El cupo cuenta las entradas pagadas de todas las órdenes (también las de la demo en vivo).
update public.ventas_evento_cupos c
set vendidas = (select coalesce(sum(o.cantidad), 0) from public.ventas_ordenes o
  where o.evento_id = c.evento_id and o.seccion_id = c.seccion_id
    and (o.estado = 'pagada' or (o.estado = 'pendiente' and o.expira_en > now())))
where c.seccion_id = '13200000-0000-4000-8000-000000000004'
  and c.evento_id in (select ('13600000-0000-4000-8000-' || lpad(e::text, 12, '0'))::uuid from unnest(array[3, 6, 9, 10]) e);

commit;
