---
title: 'UI: registro, inicio de sesión y menús por rol'
type: 'feature'
ticket: '8'
created: '2026-10-10'
status: 'done'
baseline_revision: 'f3826e684d7b6eae8fda30b86dff36d7813705ce'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-reto18-eventos/ux-plataforma-eventos/EXPERIENCE.md'
  - '{project-root}/_bmad-output/initiative-reto18-eventos/epic-base-roles-eventos/story-api-registro-inicio-de-sesion-y-roles-plan.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La API de la 1.2 ya registra cuentas y protege rutas por rol, pero la web no tiene cómo registrarse, iniciar sesión ni saber quién navega: la barra inferior de la 1.7 recibe el rol a mano.

**Approach:** Pantallas `/registro` e `/ingresar` con los componentes de la 1.7. El registro llama a `POST /api/v1/identidad/registro` y luego inicia sesión; el inicio de sesión usa Supabase Auth en la web (AD-1). La web lee el perfil con `GET /api/v1/identidad/perfil` y la barra inferior muestra solo los destinos del rol de la cuenta.

## Boundaries & Constraints

**Always:** La web solo usa Supabase para Auth (`signInWithPassword`, `signOut`, sesión); el registro y el perfil pasan por la API con `pedirApi` (AD-1). El rol sale siempre del perfil de la API, nunca del JWT ni del cliente. Validación del formulario con `RegistroSchema` de `@reto18/shared`. Registro: correo, contraseña, rol (público u organizador), WhatsApp obligatorio, ciudad opcional, casilla de avisos sin marcar por defecto. Rol de la API → barra de la 1.7: `publico` → público, `organizador` → organizador, `admin` → administrador. Sin sesión, la barra es la de público y la cabecera muestra "Ingresar"; con sesión, "Cuenta" permite cerrar sesión. Una ruta de otro rol muestra "Esta sección es para …" con vuelta al inicio. Errores de la API en un `Aviso` con su `mensaje`; lo escrito en el formulario se conserva. Solo la clave pública de Supabase llega a la web; nunca la de servicio.

**Decisions:** La sesión vive en cookies con `@supabase/ssr`: los componentes de servidor leen la sesión y el rol, y `proxy.ts` refresca el token y protege `/organizador` y `/admin` antes de pintar (Sandro David, 10/10/2026).

**Never:** Pantallas de negocio de cada rol (solo una portada mínima por rol para comprobar el menú). Recuperar contraseña, inicio con redes o enlace mágico. Barra de puerta (llega con la 2.12). Escribir en tablas desde la web. Commit, push o PR sin el visto bueno del equipo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Registro válido | Datos válidos, rol organizador | Cuenta creada, sesión iniciada y llega a la portada de organizador con su barra | No error expected |
| Datos inválidos | WhatsApp `12345` o contraseña corta | No se envía; error junto al campo con el texto del esquema | Campos conservados |
| Correo ya registrado | API 409 `CORREO_YA_REGISTRADO` | Aviso con el mensaje y enlace a "Ingresar" | Campos conservados |
| Inicio de sesión válido | Correo y contraseña correctos | Llega a la portada de su rol con su barra | No error expected |
| Credenciales malas | Supabase rechaza | "Correo o contraseña incorrectos." | Correo conservado |
| Ruta de otro rol | Público abre `/organizador` | Pantalla "Esta sección es para organizadores" | Sin datos del otro rol |
| Sin sesión en ruta privada | Abre `/admin` sin sesión | Redirige a `/ingresar` y vuelve tras entrar | — |
| API caída al leer el perfil | `SIN_CONEXION` | Aviso con "Reintentar"; no muestra menú de otro rol | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/identidad.ts` -- `RegistroSchema`, `PerfilSchema`, `RolSchema`, `CODIGOS_IDENTIDAD`; reutilizar, no duplicar. El formulario envía `ciudad: ""` y `acepta_avisos` explícito (lo prevé el esquema).
- `apps/api/src/identidad/identidad.controller.ts` -- `POST /identidad/registro` (público) y `GET /identidad/perfil` (`Authorization: Bearer <jwt>`). No se toca la API.
- `apps/web/lib/api.ts` -- `pedirApi(ruta, esquema, { cabeceras, cuerpo, apiUrl })`; nunca lanza. En el servidor usa `API_URL`; en el navegador hay que pasar `apiUrl`.
- `apps/web/lib/navegacion.ts` -- `Rol` de la web (`publico | organizador | administrador | puerta`) y `DESTINOS_POR_ROL`; la API usa `admin`: mapear, no renombrar.
- `apps/web/components/layout/pantalla.tsx`, `cabecera.tsx` -- `Pantalla` recibe `rol`, `destinoActivo` y `accionCabecera`.
- `apps/web/components/ui/` -- `Campo` (error asociado), `Boton`, `Aviso`, `Tarjeta`.
- `apps/web/next.config.ts` -- hoy copia solo `API_URL` del `.env` raíz; copiar también las variables públicas de Supabase, nunca `SUPABASE_SERVICE_ROLE_KEY`.
- `.env.example` -- añadir las variables públicas de Supabase de la web.
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` y `03-api-reference/03-file-conventions/proxy.md` -- Next 16 renombró `middleware` a `proxy`; leer antes de escribir la protección de rutas.
- `apps/web/vitest.config.ts` -- solo `lib/**/*.spec.ts`, entorno node: la lógica comprobable (rol API → barra, destino por rol, guardas) va en `lib/`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/package.json`, `.env.example`, `next.config.ts` -- `@supabase/ssr` y `@supabase/supabase-js` con versión exacta (clientes de servidor y de navegador) y sus variables públicas -- inicio de sesión (AD-1)
- [x] `apps/web/lib/sesion.ts` -- leer la sesión, pedir el perfil a la API con el token y traducir el rol de la API al de la barra; portada por rol (`publico` → `/`, `organizador` → `/organizador`, `admin` → `/admin`) -- una sola fuente de "quién navega"
- [x] `apps/web/lib/sesion.spec.ts` -- rol → barra, portada por rol, sin sesión, perfil con error -- cubrir la matriz en lo comprobable sin navegador
- [x] `apps/web/app/registro/` -- formulario con validación por campo, envío a la API, inicio de sesión y redirección a la portada del rol -- registro
- [x] `apps/web/app/ingresar/` -- correo y contraseña con Supabase Auth; vuelve a la ruta pedida o a la portada del rol -- inicio de sesión
- [x] `apps/web/app/cuenta/` -- datos del perfil y "Cerrar sesión" -- salida
- [x] `apps/web/app/organizador/page.tsx`, `apps/web/app/admin/page.tsx` -- portada mínima con la barra del rol y guarda de rol (sin sesión → `/ingresar`; otro rol → "Esta sección es para …") -- comprobar los menús
- [x] `apps/web/proxy.ts` -- mantener la sesión viva y proteger `/organizador` y `/admin` -- rutas privadas
- [x] `apps/web/lib/navegacion.ts` -- rutas de organizador y admin a sus portadas nuevas donde corresponda -- la barra no lleva a 404 en el destino principal
- [x] `apps/web/app/page.tsx`, `apps/web/components/layout/` -- la cabecera y la barra salen de la sesión real (Ingresar / Cuenta) -- menú por rol en toda la web

**Acceptance Criteria:**
- Given Supabase local (`pnpm db:start`) con la API y la web en marcha y tres cuentas (público, organizador y la del administrador sembrado), when cada una inicia sesión en un móvil de 360 px, then ve solo la barra de su rol.
- Given una cuenta de público con sesión, when abre `/admin`, then ve "Esta sección es para administradores" y ningún dato de administración.
- Given la página de registro con teclado, when se navega con Tab, then el orden sigue la lectura y cada error se anuncia junto a su campo.
- Given un clon limpio, when se ejecutan `pnpm build`, `pnpm lint` y `pnpm test`, then pasan, incluidas las pruebas anteriores.

## Implementation Notes

- Registro, inicio y cierre de sesión van por **Server Actions** con el cliente de servidor de `@supabase/ssr` (cookies): `pedirApi` se llama en el servidor con `API_URL`, sin exponer la API al navegador ni depender de CORS. No hizo falta cliente de navegador; `@supabase/supabase-js` va fijado (2.117.3, el de la API) como dependencia par de `@supabase/ssr` 0.12.7.
- Lógica comprobable en `lib/sesion.ts` (rol API → barra, portada por rol, guardas, vuelta segura, decisión del proxy) y `lib/formularios.ts` (errores por campo con `RegistroSchema`, mensaje de credenciales). `lib/sesion-servidor.ts` (`obtenerSesion`, con `cache` de React) y `lib/supabase/` cablean cookies y Supabase.
- `components/layout/pantalla-sesion.tsx` (cabecera Ingresar/Cuenta y barra de la sesión; perfil sin leer → aviso con Reintentar y sin barra) y `guarda-rol.tsx` (sin sesión → `/ingresar?siguiente=`, otro rol → "Esta sección es para …" con vuelta a su portada). No se exportan desde `components/layout/index.ts` porque importan `next/headers`.
- Token que la API rechaza (`NO_AUTENTICADO`) → anónima; cualquier otro error al leer el perfil → sin menú. Si el perfil falla justo tras `signInWithPassword`, se cierra la sesión local y se muestra el aviso.
- `proxy.ts` refresca con `getClaims` y redirige `/organizador` y `/admin` sin sesión; si Auth no responde deja pasar y decide la guarda de la página. El rol lo comprueba la página (perfil de la API).
- `crearClienteServidor` lee `cookies()` antes de mirar la configuración para que las páginas con sesión nunca se prerendericen (sin eso, `/admin` salía estática en una build sin variables).
- `/registro` también acepta `?siguiente=` (para el flujo de compra); por defecto va a la portada del rol.
- Variables: `NEXT_PUBLIC_SUPABASE_URL` (si falta, en local se toma `SUPABASE_URL` del `.env` raíz) y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Se incrustan al compilar: en Vercel deben estar antes del build.
- Verificado: `pnpm build`, `pnpm lint`, `pnpm test` en verde (web 42 pruebas, API 93). Humo con `next start`, una API falsa y una cookie de sesión fabricada: cada rol ve su barra, público en `/admin` ve "Esta sección es para administradores" sin datos, API caída → aviso sin barra, sin sesión `/admin` → 307 a `/ingresar?siguiente=%2Fadmin`. Pendiente: prueba con Supabase real (sin Docker en esta máquina) y la navegación con Tab / lector de pantalla a 360 px.

## Plan Change Log

## Review Triage Log

Pasada 1 (lente `quick`). Veredictos: high 1 · medium 1 · low 4 · false 1 · maybe-false 0.

| Hallazgo | Veredicto | Ruta | Evidencia / acción |
|---|---|---|---|
| Redirect abierto con `siguiente=/	/evil.example` | high | patch | Confirmado: `new URL('/	/evil.example/x', origen)` da `https://evil.example/x`; llega a `redirect()` sin formulario en /ingresar y /registro. Fix: rechazar caracteres de control y exigir mismo origen + pruebas. |
| /ingresar y /registro sin barra de público | medium | patch | Rompe "Sin sesión, la barra es la de público". Fix: `PantallaSesion` con la sesión ya leída. |
| Token recién emitido rechazado por la API se anuncia como "sin conexión" | low | patch | Pasa con Supabase mal configurado entre web y API (despliegue). Fix directo: código y mensaje propios. |
| Radios del rol sin `aria-invalid` | low | patch | El error solo se asocia al `fieldset`. Fix directo en los radios. |
| `mensajeErrorIngreso` trata un error sin `status` como red | false | rejected | En supabase-js los errores sin `status` son fallos de fetch (`AuthRetryableFetchError`/desconocidos); tratarlos como sin conexión es lo correcto. |
| Aviso de red del formulario sin "Reintentar" | low | rejected | El botón de envío del propio formulario reintenta y los datos se conservan; un segundo botón duplicaría la acción. |
| AC de tres cuentas reales a 360 px y AC de Tab/lector de pantalla sin verificar | low | rejected | No es un defecto del código: no hay Docker en este equipo. Queda como verificación manual pendiente para Sandro David antes de la aceptación. |

## Design Notes

La barra de la 1.7 ya tiene los destinos por rol; esta historia solo decide **qué rol** pasarle, a partir del perfil de la API. Ocultar el menú es comodidad: quien da el permiso es la API (AD-3), por eso las portadas por rol no muestran datos sin pasar por ella.

## Verification

**Commands:**
- `corepack pnpm build && corepack pnpm lint && corepack pnpm test` -- expected: todo en verde con las pruebas nuevas de `sesion.spec.ts`

**Manual checks (if no CLI):**
- `pnpm db:start`, sembrar el admin, API y web en local; registrar un público y un organizador y entrar con los tres a 360 px: cada uno ve solo su barra; `/admin` como público muestra la pantalla de sin permiso.
