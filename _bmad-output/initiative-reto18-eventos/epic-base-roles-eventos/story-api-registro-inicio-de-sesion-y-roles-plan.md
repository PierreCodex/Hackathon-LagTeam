---
title: 'API: registro, inicio de sesión y roles'
type: 'feature'
ticket: '2'
created: '2026-10-10'
status: 'built'
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

**Problem:** La API no sabe quién llama ni con qué rol. Sin eso, ninguna historia puede proteger sus endpoints (AD-3), y el epic 2 no tiene el WhatsApp al que enviar el QR.

**Approach:** Módulo `identidad` con la tabla `identidad_perfiles`, un registro público que crea en un solo paso la cuenta de Supabase Auth y el perfil, `GET /api/v1/identidad/perfil` y un guard global con `@Roles()` que valida el JWT de Supabase. El administrador se crea con un script idempotente. La web inicia sesión directamente con Supabase Auth (AD-1).

## Boundaries & Constraints

**Always:** Rol ∈ `admin | organizador | publico`, uno por cuenta (AD-3). El registro solo acepta `organizador` o `publico`. WhatsApp guardado en E.164 (AD-9). Esquemas zod en `packages/shared`, validados con `@Body({ schema })`. Errores con la forma `{ "error": { "codigo", "mensaje" } }`. RLS activo en `identidad_perfiles` y sin políticas para `anon` ni `authenticated` (AD-1). Las rutas sin decorador siguen siendo públicas (la salud no cambia). La validación del JWT tiene tiempo límite.

**Never:** Pantallas (historia 1.8). Tablas de otros módulos. Contraseñas o claves reales en el repo. Cambiar el rol por API. Confiar en el rol que diga el cliente o el JWT: el rol sale siempre de `identidad_perfiles`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Registro válido | `POST /identidad/registro` con correo, contraseña ≥ 8, rol `organizador`, WhatsApp `987 654 321`, consentimiento | 201 con el perfil; WhatsApp guardado como `+51987654321`; la cuenta queda confirmada y puede iniciar sesión | No error expected |
| Registro como admin o datos malos | rol `admin`, WhatsApp no válido o falta un campo | 400 `PETICION_INVALIDA` y no se crea la cuenta | Mensaje con el campo que falla |
| Correo ya registrado | Correo que ya existe en Auth | 409 `CORREO_YA_REGISTRADO` | No se crea un segundo perfil |
| Falla el perfil tras crear la cuenta | El insert del perfil da error | 500 y se borra la cuenta recién creada | Sin cuentas huérfanas |
| Perfil propio | `GET /identidad/perfil` con token válido | 200 con id, correo, rol, WhatsApp, ciudad y consentimiento | No error expected |
| Sin token o token inválido | Sin `Authorization` o JWT caducado o falso, en ruta protegida | 401 `NO_AUTENTICADO` | — |
| Rol equivocado | Token válido con rol `publico` en ruta `@Roles('admin')` | 403 `SIN_PERMISO` | — |
| Cuenta sin perfil | Token válido sin fila en `identidad_perfiles` | 403 `SIN_PERFIL` | — |
| Auth no responde | La validación no termina en 3 s | 503 `AUTH_NO_DISPONIBLE` | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/app.module.ts` -- registrar `IdentidadModule` y el guard global (`APP_GUARD`).
- `apps/api/src/main.ts` -- añadir `StandardSchemaValidationPipe` global (`@nestjs/common` 12) para que `@Body({ schema })` valide.
- `apps/api/src/filtro-errores.ts` -- hoy toma el código solo de `CODIGOS[estado]`; debe usar el `codigo` de la respuesta de la excepción si viene (`SIN_PERFIL`, `CORREO_YA_REGISTRADO`…). Añadir 409 `CONFLICTO` y 503 al mapa.
- `apps/api/src/supabase/supabase.module.ts` -- reutilizar `SUPABASE_CLIENTE` (clave de servicio; puede ser `null`). `auth.getClaims(jwt)` y `auth.admin.createUser` existen en supabase-js 2.117.3.
- `apps/api/src/salud/*` -- patrón a copiar: `@Inject(...)` explícito (Vitest no emite metadatos), tiempo límite con `Promise.race` y pruebas con el cliente simulado.
- `packages/shared/src/index.ts` -- reexportar el nuevo `identidad.ts`.
- `supabase/migrations/20261010000000_salud.sql` -- patrón de revocar permisos a `anon` y `authenticated`.
- No hay `@nestjs/testing` ni supertest: las pruebas de integración levantan la app con `NestFactory.create` en el puerto 0 y usan `fetch`.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261010010000_identidad.sql` -- tabla `identidad_perfiles` (`id` uuid PK → `auth.users` on delete cascade, `rol` con check, `whatsapp` con check E.164, `ciudad` opcional, `acepta_avisos` boolean, `creado_en`), RLS activo y permisos revocados a `anon` y `authenticated` -- datos del rol
- [x] `packages/shared/src/identidad.ts` -- `RolSchema`, `RegistroSchema` (normaliza el WhatsApp: quita espacios y guiones y añade `+51` a 9 dígitos que empiezan por 9), `PerfilSchema` y sus tipos; códigos de error -- un solo DTO
- [x] `apps/api/src/identidad/verificador-token.ts` -- valida el Bearer con `getClaims` y tiempo límite de 3 s; devuelve `{ id, correo }` o distingue token inválido de Auth caído -- aislar Supabase para las pruebas
- [x] `apps/api/src/identidad/identidad.service.ts` -- `registrar` (crea la cuenta confirmada y el perfil; borra la cuenta si el perfil falla), `perfilDe(id)`; servicio exportado para otros módulos (AD-2) -- lógica del módulo
- [x] `apps/api/src/identidad/roles.ts` -- decoradores `@Roles(...)` y `@UsuarioActual()`, y `RolesGuard` (sin metadatos → pasa; con `@Roles()` → token, perfil y rol) -- AD-3
- [x] `apps/api/src/identidad/identidad.controller.ts` + `identidad.module.ts` -- `POST /identidad/registro` (público) y `GET /identidad/perfil` (`@Roles('admin','organizador','publico')`) -- contrato HTTP
- [x] `apps/api/src/identidad/sembrar-admin.ts` + script `sembrar:admin` en `apps/api/package.json` -- crea o actualiza el admin con `ADMIN_CORREO`, `ADMIN_CONTRASENA` y `ADMIN_WHATSAPP`; se puede repetir sin duplicar -- admin sembrado sin claves en el repo
- [x] `apps/api/src/identidad/*.spec.ts` -- unitarias del servicio (registro, correo repetido, rollback) y del verificador (inválido, tiempo límite); integración HTTP con tres tokens simulados y un controlador de prueba con un endpoint por rol, que cubra cada fila de la matriz del guard -- matriz y criterio de la historia
- [x] `.env.example`, `README.md` -- variables del admin; pasos: aplicar la migración y ejecutar `sembrar:admin` (no hace falta tocar la confirmación por correo: las cuentas se crean confirmadas) -- traspaso

**Acceptance Criteria:**
- Given tres tokens (admin, organizador, público), when cada uno llama al endpoint de su rol, then recibe 200, y al llamar al de otro rol recibe 403.
- Given una cuenta registrada por la API, when la web inicia sesión con `signInWithPassword` y llama a `GET /identidad/perfil` con ese token, then recibe su rol y su WhatsApp en E.164.
- Given la migración aplicada y las variables del admin, when se ejecuta `pnpm --filter @reto18/api sembrar:admin` dos veces, then hay un solo admin y puede iniciar sesión.
- Given un clon limpio, when se ejecutan `pnpm build`, `pnpm lint` y `pnpm test`, then terminan en verde.

## Implementation Notes

- `apps/api/src/configurar-app.ts` reúne prefijo, filtro y `StandardSchemaValidationPipe` para que `main.ts` y la prueba HTTP usen la misma configuración.
- El filtro toma `codigo`/`mensaje` del cuerpo de la excepción; los errores de validación (lista de mensajes) se unen con `; ` para que el mensaje nombre el campo. Mapa: 409 `CONFLICTO`, 500 `ERROR_INTERNO`, 503 `SERVICIO_NO_DISPONIBLE`.
- `acepta_avisos` es obligatorio en el registro (booleano explícito, puede ser `false`); en la tabla tiene `default false`.
- `perfilDe(id, correo?)`: el guard pasa el correo del JWT validado; otros módulos pueden omitirlo y se pide a Auth (`getUserById`). La lectura del perfil lleva `AbortSignal.timeout(3000)` y un fallo da 503 `BD_NO_DISPONIBLE`.
- Errores de `createUser`: `email_exists`/`user_already_exists` → 409; `weak_password`/`validation_failed`/`email_address_invalid` → 400; red o 5xx → 503 `AUTH_NO_DISPONIBLE`; otros → 500. El registro no lleva tiempo límite propio, para no dejar cuentas creadas sin perfil si Auth responde tarde.
- `sembrar:admin` compila y ejecuta `dist/identidad/sembrar-admin.js`; si `ADMIN_CORREO` ya es una cuenta, actualiza su contraseña y pone su perfil en `admin` (upsert).
- Verificado: `pnpm build`, `pnpm lint`, `pnpm test` en verde (45 pruebas en la API) y prueba manual del `dist` sin Supabase (salud 503 pública, perfil sin token 401, con token 503, registro inválido 400). Pendiente: comprobación con Supabase real (migración, registro, `signInWithPassword` y `sembrar:admin` dos veces).

## Plan Change Log

## Review Triage Log

Pasada 1 (lente `quick`). Veredictos: high 0 · medium 1 · low 4 · false 0 · maybe-false 1.

| Hallazgo | Veredicto | Ruta | Evidencia / acción |
|---|---|---|---|
| CA 2 y 3 (inicio de sesión real y `sembrar:admin` dos veces) solo se prueban con simulaciones | maybe-false | defer | Se resuelve ejecutándolos contra el Supabase real: migración, registro, `signInWithPassword` + `GET /identidad/perfil` y `sembrar:admin` dos veces. Si fallan, sería medium. |
| `perfilDe` sin correo ignora el error de `getUserById` y devuelve `correo: ""`; además no tiene tiempo límite | medium | patch | Confirmado en `identidad.service.ts`: no se mira `usuario.error`. Arreglo: 503 `AUTH_NO_DISPONIBLE`. Lo del tiempo límite se rechaza: hoy ningún llamador usa esa ruta (el guard pasa el correo). |
| Cuentas huérfanas si falla `deleteUser`, si se cuelga el insert o si se cae el proceso entre los dos pasos | low | rejected | Real pero raro en el uso diario; arreglarlo pide un camino de reparación (más ramas). El caso normal (el insert devuelve error) sí borra la cuenta. |
| Los 400 de Auth (`weak_password`, `email_address_invalid`) pasan el mensaje en inglés sin nombrar el campo | low | patch | Confirmado en `errorDeCreacion`. Arreglo directo: mensaje en español con el prefijo del campo. |
| Una cuenta borrada o con la sesión cerrada sigue pasando el JWT hasta que caduca (403 `SIN_PERFIL` en vez de 401) | low | rejected | Así funciona `getClaims` con claves asimétricas, y el plan lo aceptó; cambiarlo exige una llamada a Auth en cada petición. Raro en la demo. |
| La prueba HTTP no cubre el tiempo límite de Auth ni el 503 `BD_NO_DISPONIBLE` al leer el perfil | low | patch (parcial) | El tiempo límite ya lo cubre `verificador-token.spec.ts` y el 503 de Auth en el guard lo cubre la prueba HTTP: se rechaza repetirlo con temporizadores falsos sobre un servidor real. Se añade la prueba HTTP del 503 `BD_NO_DISPONIBLE`. |

## Design Notes

El registro lo hace la API (`auth.admin.createUser` con `email_confirm: true`) en vez de `signUp` desde la web: la cuenta y el perfil se crean juntos (sin cuentas sin rol), no hay correo de confirmación que retrase la demo de 2 minutos, y se cumple AD-1 (solo la API escribe). La web solo usa Supabase para iniciar sesión y obtener el JWT.

`getClaims` valida el JWT en local con las claves JWKS del proyecto y, si el proyecto usa secreto simétrico, consulta a Auth. Por eso lleva tiempo límite.

```ts
@Get("perfil")
@Roles("admin", "organizador", "publico")
perfil(@UsuarioActual() u: UsuarioAutenticado) { return u.perfil; }
```

## Verification

**Commands:**
- `pnpm build && pnpm lint && pnpm test` -- expected: todo en verde, con las pruebas nuevas de `identidad`

**Manual checks (if no CLI):**
- Con Supabase real: `curl -X POST localhost:3001/api/v1/identidad/registro` crea la cuenta; con el token de inicio de sesión, `GET /identidad/perfil` devuelve el rol.
