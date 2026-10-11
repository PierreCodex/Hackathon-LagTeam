-- Las categorías del alta (1.4) se crean vinculadas a la zona general de la sede (`seccion_id`), y la pizarra de
-- precios (2.4/2.10) solo aceptaba categorías sin zona general: ninguna categoría del evento servía para las
-- butacas numeradas («la categoría no es de este evento o es de una zona general»).
-- Ahora vale cualquier categoría del evento; la que se usa en un rango numerado se desvincula de la zona general
-- (pasa a venderse por butaca). Decisión del 11/10/2026 para cuadrar el croquis con las categorías del alta.

create or replace function public.eventos_guardar_precios(p_organizador uuid, p_evento_id uuid, p_rangos jsonb)
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
      where c.id = (v_rango ->> 'categoria_id')::uuid and c.evento_id = p_evento_id
    ) then
      raise exception using errcode = 'P0001', message = 'CATEGORIA_NO_VALIDA',
        detail = format('rangos.%s.categoria_id: la categoría no es de este evento', v_indice);
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

  -- Las categorías usadas en butacas numeradas dejan de ser de la zona general.
  update public.eventos_categorias_precio c set seccion_id = null
  where c.evento_id = p_evento_id and c.seccion_id is not null
    and c.id in (select r.categoria_id from public.eventos_precios_rango r where r.evento_id = p_evento_id);

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
