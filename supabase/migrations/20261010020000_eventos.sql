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
