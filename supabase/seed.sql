-- Demo ficticia de Piura. Repetible en `supabase db reset` y en el SQL Editor.
-- IDs reservados para esta semilla; no crea perfiles de identidad ni credenciales conocidas.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('13000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'organizador.eventos@example.invalid', '', now(), '{"provider":"email","providers":["email"]}',
  '{"nombre":"Organizador de demo"}', now(), now())
on conflict (id) do nothing;

-- Sin dueño (`creado_por` nulo) y con el mapa cerrado: tienen eventos publicados (historia 2.3).
insert into public.eventos_sedes (id, nombre, direccion, distrito, mapa_cerrado) values
  ('13100000-0000-4000-8000-000000000001', 'Teatro de ejemplo de Piura', 'Sede ficticia · centro de Piura', 'Piura', true),
  ('13100000-0000-4000-8000-000000000002', 'Patio cultural de Castilla', 'Sede ficticia · plaza de Castilla', 'Castilla', true)
on conflict (id) do update set nombre = excluded.nombre, direccion = excluded.direccion, distrito = excluded.distrito,
  mapa_cerrado = excluded.mapa_cerrado, creado_por = null;

insert into public.eventos_secciones (id, sede_id, nombre, orden, tipo, capacidad) values
  ('13200000-0000-4000-8000-000000000001', '13100000-0000-4000-8000-000000000001', 'Platea baja', 1, 'numerada', null),
  ('13200000-0000-4000-8000-000000000002', '13100000-0000-4000-8000-000000000001', 'Platea media', 2, 'numerada', null),
  ('13200000-0000-4000-8000-000000000003', '13100000-0000-4000-8000-000000000001', 'Mezanine', 3, 'numerada', null),
  ('13200000-0000-4000-8000-000000000004', '13100000-0000-4000-8000-000000000002', 'General', 1, 'general', 120)
on conflict (id) do update set nombre = excluded.nombre, orden = excluded.orden, tipo = excluded.tipo, capacidad = excluded.capacidad;

-- Transcripción exacta de los croquis: rangos y desplazamientos por bloque.
do $$
declare
  fila record;
  fila_uuid uuid;
  bloque_uuid uuid;
  asiento_uuid uuid;
  b integer;
  n integer;
begin
  for fila in select * from (values
    (1, 1, 'A', 1, array[1,12], array[11,22], array[2,0]),
    (2, 1, 'B', 2, array[1,12], array[11,22], array[2,0]),
    (3, 1, 'C', 3, array[1,12], array[11,22], array[2,0]),
    (4, 1, 'D', 4, array[1,13], array[12,24], array[1,0]),
    (5, 1, 'E', 5, array[1,13], array[12,24], array[1,0]),
    (6, 1, 'F', 6, array[1,13], array[12,24], array[1,0]),
    (7, 1, 'G', 7, array[1,14], array[13,26], array[0,0]),
    (8, 1, 'H', 8, array[1,14], array[13,26], array[0,0]),
    (9, 2, 'I', 1, array[1,15], array[14,28], array[1,0]),
    (10, 2, 'J', 2, array[1,15], array[14,28], array[1,0]),
    (11, 2, 'K', 3, array[1,15], array[14,28], array[1,0]),
    (12, 2, 'L', 4, array[1,16], array[15,30], array[0,0]),
    (13, 2, 'M', 5, array[1,16], array[15,30], array[0,0]),
    (14, 2, 'N', 6, array[1,16], array[15,30], array[0,0]),
    (15, 2, 'O', 7, array[1,16], array[15,30], array[0,0]),
    (16, 3, 'P', 1, array[1,9,27], array[8,26,34], array[1,0,0]),
    (17, 3, 'Q', 2, array[1,9,27], array[8,26,36], array[1,0,0]),
    (18, 3, 'R', 3, array[1,10,28], array[9,27,37], array[0,0,0]),
    (19, 3, 'S', 4, array[1,10,27], array[9,26,36], array[0,0,0]),
    (20, 3, 'T', 5, array[1,10,27], array[9,26,36], array[0,0,0]),
    (21, 3, 'U', 6, array[1,8,15], array[7,14,22], array[2,5,0]),
    (22, 3, 'V', 7, array[1,9,16], array[8,15,23], array[1,5,0]),
    (23, 3, 'W', 8, array[1,9,18], array[8,17,25], array[1,4,0])
  ) as croquis(numero, seccion, nombre, orden, inicios, finales, desplazamientos)
  loop
    fila_uuid := ('13300000-0000-4000-8000-' || lpad(fila.numero::text, 12, '0'))::uuid;
    insert into public.eventos_filas (id, seccion_id, nombre, orden)
    values (fila_uuid, ('13200000-0000-4000-8000-' || lpad(fila.seccion::text, 12, '0'))::uuid, fila.nombre, fila.orden)
    on conflict (id) do update set nombre = excluded.nombre, orden = excluded.orden;
    for b in 1..array_length(fila.inicios, 1) loop
      bloque_uuid := ('13400000-0000-4000-8000-' || lpad((fila.numero * 10 + b)::text, 12, '0'))::uuid;
      insert into public.eventos_bloques (id, fila_id, orden, desplazamiento)
      values (bloque_uuid, fila_uuid, b, fila.desplazamientos[b])
      on conflict (id) do update set orden = excluded.orden, desplazamiento = excluded.desplazamiento;
      for n in fila.inicios[b]..fila.finales[b] loop
        asiento_uuid := ('13500000-0000-4000-8000-' || lpad((fila.numero * 100 + n)::text, 12, '0'))::uuid;
        insert into public.eventos_asientos (id, bloque_id, fila_id, numero)
        values (asiento_uuid, bloque_uuid, fila_uuid, n)
        on conflict (id) do update set bloque_id = excluded.bloque_id, fila_id = excluded.fila_id, numero = excluded.numero;
      end loop;
    end loop;
  end loop;
end $$;

-- Viernes, sábado y domingo (16–18 de octubre) para la selección Weekend.
-- Los aprobados están publicados (salen al público); el pendiente y el rechazado, no.
insert into public.eventos_eventos (id, organizador_id, sede_id, titulo, descripcion, categoria,
  distrito, inicio, estado, motivo_rechazo, destacado, hay_musica, aforo, publicado, publicado_en, alerta_apdayc)
select ('13600000-0000-4000-8000-' || lpad(e.numero::text, 12, '0'))::uuid,
  '13000000-0000-4000-8000-000000000001'::uuid,
  ('13100000-0000-4000-8000-' || lpad(e.sede::text, 12, '0'))::uuid,
  e.titulo, e.descripcion, e.categoria, case when e.sede = 1 then 'Piura' else 'Castilla' end,
  e.inicio::timestamptz, e.estado, case when e.estado = 'rechazado' then 'Completar la descripción del programa.' end,
  e.numero = 1, e.categoria in ('musica', 'danza'), case when e.sede = 1 then 643 else 120 end,
  e.estado = 'aprobado', case when e.estado = 'aprobado' then '2026-10-01 09:00:00-05'::timestamptz end,
  case when e.numero = 7 then 'La descripción menciona DJ, pero el organizador no declaró música. Revisar APDAYC.' end
from (values
  (1, 1, 'Noche de música piurana', 'Concierto ficticio de artistas locales.', 'musica', '2026-10-16 20:00:00-05', 'aprobado'),
  (2, 1, 'Historias del río Piura', 'Teatro ficticio para compartir en familia.', 'teatro', '2026-10-17 19:00:00-05', 'aprobado'),
  (3, 2, 'Domingo de danza norteña', 'Encuentro ficticio de danza en el patio cultural.', 'danza', '2026-10-18 17:00:00-05', 'aprobado'),
  (4, 2, 'Muestra de arte: colores del norte', 'Exposición ficticia de arte visual.', 'artes_visuales', '2026-10-24 16:00:00-05', 'aprobado'),
  (5, 1, 'Cine bajo el cielo de Piura', 'Proyección ficticia y conversación con el público.', 'cine', '2026-10-31 18:30:00-05', 'aprobado'),
  (6, 2, 'Voces y versos de Castilla', 'Lecturas ficticias de literatura regional.', 'literatura', '2026-11-07 17:00:00-05', 'aprobado'),
  (7, 1, 'Encuentro cultural de noviembre', 'Evento ficticio con DJ invitado, pendiente de revisión.', 'otro', '2026-11-14 19:00:00-05', 'pendiente'),
  (8, 2, 'Taller de relatos del norte', 'Propuesta ficticia para corregir antes de publicar.', 'literatura', '2026-11-21 16:00:00-05', 'rechazado')
) as e(numero, sede, titulo, descripcion, categoria, inicio, estado)
on conflict (id) do update set titulo = excluded.titulo, descripcion = excluded.descripcion,
  categoria = excluded.categoria, distrito = excluded.distrito, inicio = excluded.inicio,
  estado = excluded.estado, motivo_rechazo = excluded.motivo_rechazo, destacado = excluded.destacado,
  hay_musica = excluded.hay_musica, aforo = excluded.aforo, publicado = excluded.publicado,
  publicado_en = excluded.publicado_en, alerta_apdayc = excluded.alerta_apdayc;

insert into public.eventos_categorias_precio (id, evento_id, sede_id, nombre, color, precio_centimos, seccion_id)
select ('13700000-0000-4000-8000-' || lpad((e.numero * 10 + p.orden)::text, 12, '0'))::uuid,
  ('13600000-0000-4000-8000-' || lpad(e.numero::text, 12, '0'))::uuid,
  '13100000-0000-4000-8000-000000000001'::uuid, p.nombre, p.color, e.base + p.extra, null
from (values (1, 4000), (2, 2500), (5, 1000), (7, 2000)) as e(numero, base)
cross join (values (1, 'Platea baja', '#D97706', 2000), (2, 'Platea media', '#2563EB', 1000),
  (3, 'Mezanine', '#7C3AED', 0)) as p(orden, nombre, color, extra)
on conflict (id) do update set nombre = excluded.nombre, color = excluded.color, precio_centimos = excluded.precio_centimos;

insert into public.eventos_categorias_precio (id, evento_id, sede_id, nombre, color, precio_centimos, seccion_id)
select ('13700000-0000-4000-8000-' || lpad((e.numero * 10 + 1)::text, 12, '0'))::uuid,
  ('13600000-0000-4000-8000-' || lpad(e.numero::text, 12, '0'))::uuid,
  '13100000-0000-4000-8000-000000000002'::uuid,
  'General', '#059669', e.precio, '13200000-0000-4000-8000-000000000004'::uuid
from (values (3, 1500), (4, 0), (6, 500), (8, 1000)) as e(numero, precio)
on conflict (id) do update set nombre = excluded.nombre, color = excluded.color,
  precio_centimos = excluded.precio_centimos, seccion_id = excluded.seccion_id;
commit;
