---
title: 'Pruebas de integración de la API (parte 1 de la historia 1.3)'
type: 'feature'
ticket: '3a'
created: '2026-10-10'
status: 'done'
baseline_revision: '70d97a07cbfbf7dd3ef6a24d8f61f4b088f5ebfc'
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

**Problem:** Las historias API (1.2, 1.4, 1.5, 1.6 y los epics 2 a 4) se verifican con "pruebas de integración", pero no existe ni el ejecutor, ni una base de datos de prueba, ni una forma de obtener un token por rol. La 1.2 de Luis lo necesita ya.

**Approach:** En `apps/api`, un comando `pnpm test:int` que levanta la app NestJS real contra una base de datos de prueba aislada, con ayudas para crear usuarios de Supabase Auth y obtener su token por rol, y para llamar a la API con ese token. Lo prueba un primer caso sobre `/api/v1/salud` y sobre los tokens. El esquema de sedes y eventos y la semilla son la parte 2 de la 1.3 (aplazada).

**Decisiones (10/10/2026):**
- La BD de prueba es **Supabase local con la CLI** (`supabase start`, en Docker), en cada máquina y en la CI. El proyecto en la nube sigue solo para desarrollo.
- Los tokens llevan el rol en **`app_metadata.rol`** del usuario de Auth (`admin | organizador | publico`). La historia 1.2 añade a la misma ayuda el alta en `identidad_perfiles`.

## Boundaries & Constraints

**Always:** La app de prueba se configura con el mismo código que `main.ts` (prefijo `api/v1`, filtro de errores, CORS), sin duplicarlo. Las ayudas solo usan Supabase Auth y la clave de servicio; no crean tablas de negocio. Cada ejecución limpia los usuarios que creó. Las pruebas unitarias (`pnpm test`) siguen sin necesitar base de datos.

**Never:** Ejecutar las pruebas de integración contra la base de datos de desarrollo que comparte el equipo. Crear `identidad_perfiles` ni el guard `@Roles()` (historia 1.2). Migraciones o semilla de sedes y eventos (parte 2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Salud contra la BD de prueba | `pnpm test:int` con la BD de prueba arriba | `GET /api/v1/salud` → 200 `bd: "ok"` | No error expected |
| Token por rol | `tokenPorRol(rol)` para los tres roles | Tres usuarios distintos; cada token lo acepta `auth.getUser` y trae su `app_metadata.rol` | No error expected |
| BD de prueba no disponible | `pnpm test:int` sin la BD de prueba | Falla al inicio con un mensaje que dice cómo levantarla | No ejecuta ninguna prueba |
| Apunta a una BD que no es local | La URL de la BD de prueba no es `localhost`/`127.0.0.1` (p. ej. el proyecto en la nube) | Se niega a ejecutar | Mensaje explícito; no crea ni borra nada |
</frozen-after-approval>

## Code Map

- `apps/api/src/main.ts` -- arranque actual: prefijo, `FiltroErrores`, CORS desde `WEB_URL`. Extraer esa configuración a una función que usen `main.ts` y las pruebas.
- `apps/api/src/supabase/supabase.module.ts` -- crea el cliente con `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` leídos al construir el módulo: la prueba debe fijar el entorno antes de crear la app.
- `apps/api/src/salud/*` -- caso de humo; usa `@Inject(...)` explícito porque Vitest no emite metadatos de decoradores: mantenerlo.
- `apps/api/vitest.config.ts` -- solo `src/**/*.spec.ts`; `pnpm test` no debe recoger las de integración.
- `supabase/migrations/` -- solo `20261010000000_salud.sql`; no hay `supabase/config.toml` (lo crea `supabase init`). `supabase start` aplica las migraciones; `supabase status -o env` da la URL y las claves locales, así que las pruebas no necesitan un `.env` propio.
- Docker Desktop está instalado y funciona en esta máquina; CLI de Supabase no instalada (usar el paquete npm `supabase` como devDependency de la raíz).
- `.github/workflows/ci.yml` -- build, lint, test.
- Versiones hoy: `supabase` (CLI) 2.120.0, `@nestjs/testing` 12.1.2, `supertest` 7.3.1.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/configurar-app.ts`, `apps/api/src/main.ts` -- extraer la configuración de la app y usarla en `main.ts` -- una sola fuente para producción y pruebas
- [x] `supabase/config.toml`, `package.json` raíz -- `supabase init`; CLI `supabase` como devDependency; scripts `db:start`, `db:stop` y `test:int` -- BD de prueba local
- [x] `apps/api/vitest.integracion.config.ts`, `apps/api/package.json` -- `test:int` con Vitest, archivos `test/integracion/**/*.int.spec.ts`, en serie; un `globalSetup` lee URL y claves de `supabase status`, se niega si la URL no es `localhost`/`127.0.0.1` y, si la BD local no responde, falla diciendo que se ejecute `pnpm db:start` -- ejecutor seguro
- [x] `apps/api/test/integracion/ayudas/app.ts` -- `crearAppDePrueba()` con `@nestjs/testing` y la configuración compartida -- app real en memoria
- [x] `apps/api/test/integracion/ayudas/tokens.ts` -- `tokenPorRol(rol)`: crea un usuario de Auth con la clave de servicio y `app_metadata.rol`, inicia sesión con la clave pública y devuelve `{ id, token }`; borra los usuarios creados al terminar; un comentario marca dónde la 1.2 añade el alta en `identidad_perfiles` -- tokens por rol
- [x] `apps/api/test/integracion/ayudas/http.ts` -- llamadas con `supertest` y cabecera `Authorization: Bearer` -- comodidad para las historias API
- [x] `apps/api/test/integracion/salud.int.spec.ts`, `tokens.int.spec.ts` -- cubren las cuatro filas de la matriz -- prueba del montaje
- [x] `README.md` -- cómo levantar la BD local y correr `pnpm test:int`, y cómo escribir una prueba de integración con las ayudas -- traspaso al equipo
- [x] `.github/workflows/ci.yml` -- tras las pruebas unitarias, `pnpm db:start` y `pnpm test:int` -- que la CI lo cubra

**Acceptance Criteria:**
- Given la BD de prueba levantada según el README, when se ejecuta `pnpm test:int` en la raíz, then pasan los casos de salud y de tokens.
- Given una historia API nueva, when su autor escribe `test/integracion/<algo>.int.spec.ts` usando `crearAppDePrueba`, `tokenPorRol` y la ayuda HTTP, then puede probar un endpoint con un token de cualquier rol sin código de montaje propio.
- Given un PR, when corre la CI, then ejecuta también las pruebas de integración y falla si fallan.
- Given `pnpm test` sin ninguna BD disponible, when se ejecuta, then sigue pasando.

## Implementation Notes

- La lógica de `globalSetup` vive en `test/integracion/entorno.ts` (`prepararEntornoDePrueba` con dependencias inyectables), para que las filas 3 y 4 de la matriz se prueben dentro de `salud.int.spec.ts` sin apagar la BD.
- El entorno pasa a las pruebas con `project.provide`/`inject` de Vitest; `crearAppDePrueba` fija `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` con él, así que el `.env` de desarrollo nunca se usa.
- Limpieza: `setupFiles` (`ayudas/limpieza.ts`) borra en `afterAll` los usuarios de cada archivo; el teardown global borra además los que queden con el dominio `@prueba.reto18.local`.
- `supabase init` creó `config.toml` con `project_id = "reto18"`; avisa de que falta `supabase/seed.sql` (lo trae la parte 2).

## Plan Change Log

## Review Triage Log

Pasada 1 (lente `quick`). Veredictos: high 0 · medium 1 · low 3 · false 1 · maybe-false 1.

| Hallazgo | Veredicto | Ruta | Evidencia / acción |
|---|---|---|---|
| `tokenPorRol` inicia sesión en cada llamada y `config.toml` limita `sign_in_sign_ups = 30` cada 5 min | medium | patch | Confirmado en `supabase/config.toml:208`; 4 inicios por ejecución hoy, más con cada historia API → 429 y `tokenPorRol` lanza. Fix: subir el límite en la config local. |
| `globalSetup` solo comprueba `/auth/v1/health`, no Postgres ni PostgREST | low | rejected | Requiere que caiga solo `db`/`rest` con Auth arriba (Auth depende de Postgres); raro en el día a día y el fix añade otra comprobación. Si pasa, la prueba de salud falla con 503 visible. |
| Errores al borrar usuarios se ignoran; la red de seguridad lee solo 1000 usuarios | low | rejected | Solo afecta a la BD local de prueba; los restos llevan el dominio `@prueba.reto18.local` y la red de seguridad los barre en la siguiente ejecución. Más de 1000 restos es irreal. |
| `deferred-work.md`: `source_plan: none` en la entrada del esquema | false | rejected | El formato del paso 1 de bmad-build para una división previa al plan exige `source_plan: none`. |
| Arquitectura, "Entornos" (línea 274), no menciona Supabase local para pruebas | low | defer | Desfase real del documento; el arreglo edita la arquitectura, no este código. Anotado en `deferred-work.md`. |
| `config.toml` `major_version = 17` sin comprobar contra el proyecto en la nube | maybe-false | defer | Se resuelve mirando la versión de Postgres en el panel de Supabase (Settings > Infrastructure). Anotado en `deferred-work.md`. |

Parche aplicado (`sign_in_sign_ups = 10000` en la config local); verificación completa en verde: build, lint, test (web 6, API 4) y `test:int` 7/7.

## Verification

**Commands:**
- `pnpm build && pnpm lint && pnpm test` -- expected: todo en verde, sin BD
- `pnpm test:int` con la BD de prueba -- expected: pasan salud y tokens; sin BD, falla al inicio con el mensaje de cómo levantarla
