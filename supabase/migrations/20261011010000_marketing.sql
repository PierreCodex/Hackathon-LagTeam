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
