---
title: 'Esqueleto desplegado'
type: 'feature'
ticket: '1'
created: '2026-10-10'
status: 'done'
baseline_revision: '5ee5b51a47c60501228cfe71d6da6629c6a1b051'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-reto18-eventos/architecture-reto18-plataforma-eventos/architecture-reto18-plataforma-eventos.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No existe código: ningún epic puede empezar sin el monorepo, el despliegue y la conexión a Supabase.

**Approach:** Monorepo pnpm con `apps/web` (Next.js), `apps/api` (NestJS 12) y `packages/shared` (zod). La API expone `GET /api/v1/salud`, que consulta Supabase; la página de inicio de la web la llama y muestra "API ok · BD ok". CI de compilación y lint en GitHub Actions, y archivos de despliegue para Vercel (web) y Railway Hobby (API).

## Boundaries & Constraints

**Always:** Versiones del Stack de la arquitectura (Node 22, pnpm 9, TS 5, Next ≥ 16.3.3, NestJS 12, zod 4). Contrato bajo `/api/v1/`, errores con la forma `{ "error": { "codigo", "mensaje" } }`. El esquema de la respuesta de salud vive en `packages/shared` y lo importan API y web. Configuración solo por variables de entorno, con `.env.example` versionado. La API usa la clave de servicio de Supabase; la web nunca la recibe (AD-1). La consulta a la BD tiene tiempo límite.

**Never:** Módulos de negocio, tablas con datos, Auth ni librería de UI (son de las historias siguientes). `docker-compose.yml` y Evolution API (historia 2.2). Claves reales en el repo. Commit, push o PR sin el visto bueno de Jean Pierre.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Todo sano | `GET /api/v1/salud`, Supabase responde | 200 `{ api: "ok", bd: "ok", hora_bd: <timestamptz de Postgres> }`; la web muestra "API ok · BD ok" y la hora en `America/Lima` | No error expected |
| BD caída o clave mala | Supabase devuelve error o no responde en 3 s | 503 `{ api: "ok", bd: "error", error: { codigo: "BD_NO_DISPONIBLE", mensaje } }` | La web muestra "API ok · BD error" |
| API caída | La web no llega a la API (o `API_URL` falta) | La página carga igual y muestra "API error · BD ?" | Sin excepción sin capturar; la página no rompe |

</frozen-after-approval>

## Code Map

- Repo sin código de aplicación. No tocar `_bmad/`, `.agents/`, `.claude/` ni `_bmad-output/` (salvo este plan).
- `.gitignore` -- ya ignora `.env*` (salvo `.env.example`), `node_modules/`, `_bmad/render/`; añadir `dist/`, `.next/`, `*.tsbuildinfo`, `.vercel/`.
- `README.md` -- existe; añadir secciones, sin borrar lo que hay.
- pnpm no está global: `corepack enable` y `packageManager: "pnpm@9.x"` en la raíz.
- Versiones en npm hoy: `next` 16.4.0, `@nestjs/core` 12.1.2, `zod` 4.6.5, `@supabase/supabase-js` 2.117.3.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `.nvmrc` -- raíz del monorepo con scripts `build`, `lint`, `test` que recorren los paquetes (`pnpm -r`) -- base común
- [x] `packages/shared/` -- paquete `@reto18/shared` con `SaludRespuestaSchema` (zod) y su tipo; compila a JS para que la API lo consuma en producción -- una sola fuente del DTO
- [x] `apps/api/` -- NestJS 12: prefijo global `api/v1`, módulo `salud` con controlador y servicio que llama a `rpc('salud')` de supabase-js con tiempo límite de 3 s y devuelve el contrato de la matriz; CORS limitado a `WEB_URL`; escucha en `PORT` -- endpoint de salud
- [x] `apps/api/` (tests) -- pruebas unitarias del servicio de salud para los tres casos de la matriz del lado API (ok, error de Supabase, tiempo límite), con el cliente de Supabase simulado -- cubrir la matriz
- [x] `apps/api/Dockerfile` o `railway.json` -- construir y arrancar la API desde la raíz del monorepo en Railway, incluyendo `packages/shared` -- despliegue Railway
- [x] `apps/web/` -- Next.js App Router: `app/page.tsx` (componente de servidor, sin caché) llama a `${API_URL}/api/v1/salud`, valida con el esquema compartido y muestra el estado; maneja la API caída; `transpilePackages` para `@reto18/shared`; diseño legible en móvil -- página de salud
- [x] `supabase/migrations/20261010000000_salud.sql` -- función `public.salud()` que devuelve `now()`; `execute` revocado a `anon` y `authenticated` y concedido a `service_role` -- dato leído de Supabase sin crear tablas de negocio
- [x] `.env.example` -- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `WEB_URL` (API) y `API_URL` (web), con comentarios de dónde se carga cada una -- configuración
- [x] `.github/workflows/ci.yml` -- en push y PR: Node 22, corepack, `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm lint`, `pnpm test` -- CI
- [x] `README.md` -- arranque local y pasos de Jean Pierre: aplicar la migración, Vercel (raíz `apps/web`, `API_URL`) y Railway (variables de la API, `WEB_URL`) -- traspaso humano

**Acceptance Criteria:**
- Given un clon limpio con Node 22, when se ejecutan `pnpm install`, `pnpm build`, `pnpm lint` y `pnpm test` en la raíz, then los cuatro terminan sin errores.
- Given la API en local con un `.env` válido y la migración aplicada, when se abre la web en local, then se ve "API ok · BD ok" con la hora de Postgres.
- Given los proyectos de Vercel, Railway y Supabase creados por Jean Pierre con las variables de `.env.example`, when se abre la URL de Vercel desde un móvil, then se ve "API ok · BD ok" con datos leídos de Supabase a través de la API en Railway.
- Given un PR a `main`, when corre el workflow de CI, then ejecuta compilación, lint y pruebas, y falla si alguno falla.

## Implementation Notes

- NestJS 12 es solo ESM: `apps/api` y `packages/shared` usan `"type": "module"` y `NodeNext` (imports con `.js`). Las inyecciones usan `@Inject(...)` explícito para no depender de los metadatos de decoradores en Vitest.
- Pruebas con Vitest 5. `pnpm test` en la API hace también `tsc` sin emitir, para comprobar los tipos de los `.spec.ts`.
- Lint: ESLint 10 + typescript-eslint en `eslint.config.mjs` de la raíz; cada paquete corre `eslint .`. A `apps/web` se le añaden las reglas de `@next/eslint-plugin-next` y `react-hooks` (Next 16 ya no trae `next lint`).
- Si faltan `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY`, la API arranca igual y la salud devuelve 503 `BD_NO_DISPONIBLE` (en vez de no arrancar), para poder diagnosticar el despliegue.
- Tiempo límite: `Promise.race` de 3 s y además `abortSignal` en el `rpc` para cancelar el fetch.
- Filtro global `FiltroErrores`: cualquier otro error (404, 500) sale con la forma `{ "error": { "codigo", "mensaje" } }`.
- En local, la API lee el `.env` de la raíz con `node --env-file-if-exists`; la web, con `process.loadEnvFile` en `next.config.ts`.
- Railway: `apps/api/Dockerfile` (contexto = raíz) usa `pnpm deploy --prod`; `apps/api/railway.json` como config-as-code. La API declara `"files": ["dist"]` porque `pnpm deploy` respeta `.gitignore`.
- Vercel: `apps/web/vercel.json` compila `packages/shared` antes de `next build`, porque con raíz `apps/web` solo se compila la web.
- `next-env.d.ts` se ignora en Git (lo genera Next).
- Auditoría de la matriz (paso 3): la fila "API caída" y la parte web de las otras dos solo tenían comprobación manual. La lógica de la página pasó a `apps/web/lib/salud.ts` (`consultarSalud`, `resumir`) y se añadieron 5 pruebas Vitest en `apps/web/lib/salud.spec.ts` (ok con hora en Lima, 503, API inalcanzable, falta `API_URL`, respuesta fuera de contrato). `pnpm build`, `lint` y `test` en verde (web 5, API 4).

## Plan Change Log

## Review Triage Log

Pasada 1 (lente `quick`). Veredictos: high 0 · medium 1 · low 4 · false 0 · maybe-false 0.

| Hallazgo | Veredicto | Ruta | Evidencia / acción |
|---|---|---|---|
| `next.config.ts` carga todo el `.env` raíz en la web, incluida `SUPABASE_SERVICE_ROLE_KEY` | medium | patch | Rompe la regla congelada "la web nunca la recibe (AD-1)" en local; no llega al navegador. Fix: copiar solo `API_URL`. |
| `--env-file-if-exists` exige Node ≥ 22.9 y `engines` permite 22.0 | low | patch | `pnpm dev:api` falla en 22.0–22.8; un miembro del equipo puede tenerlo. Fix: `engines` ≥ 22.9. |
| `WEB_URL` con `/` final nunca coincide con el `Origin` (CORS) | low | patch | Fallo silencioso fácil de cometer al pegar la URL de Vercel. Fix directo: quitar la barra final. |
| Cuerpo no JSON de la API se informa como "No se pudo conectar" | low | patch | Estado "API error · BD ?" correcto, pero el detalle confunde el diagnóstico del despliegue. Fix directo + 1 prueba. |
| Rutas fuera de `/api/v1` (p. ej. `/`) devuelven el HTML de Express, no la forma de error | low | rejected | El contrato de la arquitectura es solo bajo `/api/v1/`; `railway.json` no define health check en `/`; arreglarlo añade un manejador de rutas no encontradas fuera del prefijo. Raro en el uso diario. |

Parches aplicados por el implementador; verificación completa en verde (`pnpm install --frozen-lockfile`, `build`, `lint`, `test`: web 6, API 4).

## Design Notes

La salud lee la hora de Postgres con una función RPC, no una tabla: prueba conexión y credenciales sin adelantar el esquema de la historia 1.3, y respeta AD-1 (solo `service_role` la ejecuta). La web llama a la API desde el servidor, así que no depende de CORS; se deja CORS con `WEB_URL` para las historias siguientes.

## Verification

**Commands:**
- `pnpm install && pnpm build && pnpm lint && pnpm test` -- expected: todo en verde
- `curl localhost:$PORT/api/v1/salud` con la API en local -- expected: 200 con `bd: "ok"`; con una clave falsa, 503 con `bd: "error"`
