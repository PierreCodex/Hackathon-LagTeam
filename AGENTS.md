# Instrucciones para agentes (Claude Code, Codex y otros)

Plataforma de eventos culturales de Piura (Reto 18). Monorepo pnpm: `apps/web` (Next.js), `apps/api` (NestJS), `packages/shared` (zod) y `supabase/migrations`. Arranque y pruebas: `README.md`.

## Reglas del equipo

- **No subir nada sin validar.** No hagas commit, push ni PR de archivos nuevos o cambios hasta que la persona que te dirige confirme que el equipo los validó. Trabaja en local y pregunta antes de subir.
- **Una rama por historia**, creada desde `main` (`feat/<historia>`), y entrada por PR. Nunca trabajes directamente en `main`.
- **Nunca subas secretos.** `.env` está ignorado; las variables se documentan en `.env.example`.

## Dónde está el plan

- Iniciativa, spec, arquitectura y epics: `_bmad-output/initiative-reto18-eventos/`. La arquitectura (`architecture-reto18-plataforma-eventos/`) fija las reglas AD-1 a AD-12 y las convenciones.
- Tickets por epic en `tickets.toml`; el plan de cada historia junto a su epic (`story-*-plan.md`).
- Lo aplazado: `_bmad-output/initiative-reto18-eventos/deferred-work.md`.
- Para construir una historia, usa el skill de BMad `bmad-build` con su referencia (por ejemplo, `1.3`).

## Antes de abrir un PR

`pnpm build && pnpm lint && pnpm test`, y `pnpm test:int` si tocas la API (necesita Docker y `pnpm db:start`).
