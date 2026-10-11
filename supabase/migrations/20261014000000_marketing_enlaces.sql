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
