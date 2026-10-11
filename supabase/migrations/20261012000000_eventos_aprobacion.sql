-- Historia 1.5: señal informativa para la revisión; no ejecuta IA.
-- Conserva RLS y los permisos exclusivos de service_role (AD-1).
alter table public.eventos_eventos add column alerta_apdayc text;
comment on column public.eventos_eventos.alerta_apdayc is
  'Alerta nullable para la revisión administrativa de música/APDAYC.';
