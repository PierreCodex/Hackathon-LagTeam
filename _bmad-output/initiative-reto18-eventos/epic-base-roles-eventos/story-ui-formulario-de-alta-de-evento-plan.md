---
title: 'UI: formulario de alta de evento'
type: 'feature'
ticket: '9'
created: '2026-10-10'
status: 'built'
baseline_revision: '52aeb635b7f2b5fe530377afafca50ed8841bd22'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-reto18-eventos/ux-plataforma-eventos/EXPERIENCE.md'
  - '{project-root}/_bmad-output/initiative-reto18-eventos/epic-base-roles-eventos/story-api-alta-de-evento-plan.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La API de la 1.4 ya crea eventos, pero el organizador no tiene pantalla para hacerlo: sin ella no hay CAP-2 en la demo.

**Approach:** Un formulario en pasos (`EXPERIENCE.md` Flow 1) en `/organizador/eventos/nuevo`: datos y foto, sede (elegir de `GET /eventos/sedes` o crear una de zona general), categorías de precio, descripción de 2 o 3 frases y "¿Habrá música?" con la constancia. Envía `POST /api/v1/eventos` (multipart) y termina en "Tu evento está pendiente de aprobación" con un botón a Marketing.

## Boundaries & Constraints

**Always:** Validar con `AltaEventoSchema` de `@reto18/shared` (el mismo DTO que la API) antes de enviar. Precios escritos en soles y enviados en céntimos enteros, con el IGV incluido (AD-10). Foto obligatoria (JPG, PNG o WebP) y constancia (PDF o imagen) de 5 MB como máximo, según las constantes de `@reto18/shared`. Con música y sin constancia, "Enviar a aprobación" queda desactivado y el motivo aparece junto al campo. Los errores de la API van en un `Aviso` con su `mensaje`, y lo escrito se conserva. Un paso por tema, con barra de avance; columna de 480 px (`ancho="formulario"`); objetivos de 48 px; etiquetas visibles. Solo el organizador entra (`GuardaRol`). La web no escribe en Storage ni en la BD (AD-1).

**Decisions:** El envío va del navegador directo a la API: la página de servidor pasa al formulario la URL de la API (`API_URL`), y el navegador manda `Authorization: Bearer` con el token de la sesión de Supabase (cliente de navegador de `@supabase/ssr`). Así no hay límite de 4,5 MB de Vercel y la API sigue siendo la única que escribe (AD-1). Ruta `/organizador/eventos/nuevo`; fecha y hora en hora de Lima (-05:00); borrador de texto en `localStorage`; Marketing enlaza a `/organizador/marketing` (3.8). El plan se mantiene entero aunque pase de 1600 tokens (Sandro David, 10/10/2026).

**Never:** La pizarra del mapa ni sedes numeradas (epic 2). La lista de Mis eventos (no hay endpoint todavía). Editar o borrar un evento. Generar textos con IA. Dependencias nuevas. Commit, push o PR sin el visto bueno del equipo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Alta completa con sede nueva | Datos válidos, sede nueva de 120, 2 categorías, foto, sin música | Pantalla "Tu evento está pendiente de aprobación" con el botón Marketing | — |
| Alta con sede existente y música | Sede de la lista, música sí y constancia PDF | Igual que arriba | — |
| Música sin constancia | Música sí, sin archivo | "Enviar a aprobación" desactivado; "Falta la constancia de APDAYC para publicar con música." junto al campo | No se envía |
| Paso con errores | Título vacío o fecha pasada al pulsar "Siguiente" | Se queda en el paso, error junto al campo y foco en el primero | — |
| Archivo no válido | Foto de 6 MB o un PDF como foto | Error junto al campo; no avanza | — |
| Aforo mayor que la sede | API 400 `AFORO_SUPERA_SEDE` | `Aviso` con el mensaje de la API y vuelta al paso de sede | Datos conservados |
| Sin conexión | `SIN_CONEXION` al enviar o al cargar sedes | `Aviso` con "Reintentar" | Datos conservados |
| Precio en soles | "25" y "12.50" | 2500 y 1250 céntimos; "12,555" o "-5" dan error | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/eventos.ts` -- `AltaEventoSchema` (`titulo` ≤ 150, `descripcion` 20–600, `inicio` ISO futuro con zona, `aforo`, `hay_musica`, `sede` existente/nueva, `categorias` 1–6 sin nombres repetidos), `SedeResumenSchema`, `EventoCreadoSchema`, `CategoriaEventoSchema`, `TAMANO_MAXIMO_ARCHIVO_EVENTO`, `TIPOS_FOTO_EVENTO`, `TIPOS_CONSTANCIA_EVENTO`, `CODIGOS_EVENTOS`. Reutilizar; no cambiar.
- `apps/api/src/eventos/eventos.controller.ts` -- `POST /eventos`: multipart con el campo `datos` (JSON), `foto` y `constancia`. `GET /eventos/sedes`. Solo organizador. No se toca la API. La API ignora la constancia si no hay música, y el distrito del evento sale de la sede.
- `apps/web/lib/api.ts` -- `pedirApi` solo envía JSON. Se añade `formulario?: FormData` (sin `Content-Type`, que lo pone `fetch`), con su prueba en `api.spec.ts`.
- `apps/web/lib/formularios.ts` -- patrón de validación por campo (`validarRegistro`, `primerCampoConError`). Copiar el patrón en un archivo nuevo; no mezclar.
- `apps/web/lib/sesion-servidor.ts` -- `obtenerSesion()` y el token con `crearClienteServidor()` + `auth.getSession()`.
- `apps/web/components/layout/guarda-rol.tsx` -- `GuardaRol rol="organizador"`; `apps/web/app/organizador/page.tsx` es la portada, donde va el botón "Nuevo evento".
- `apps/web/components/ui/` -- `Campo`, `Boton`, `BotonEnlace`, `Aviso`, `Tarjeta`, `Chip`. Para el área de texto, el selector y el archivo no hay componente: se añaden con el mismo aspecto que `Campo`.
- `apps/api/src/configurar-app.ts` -- CORS abierto al origen de la web (`WEB_URL`).

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/lib/alta-evento.ts` + `alta-evento.spec.ts` -- funciones puras: estado del formulario y sus pasos (`datos`, `sede`, `entradas`, `descripcion`, `musica`), `validarPaso(paso, estado)` con un error por campo, `solesACentimos("12.50")`, `inicioLima("2026-10-24T20:00")` → `…-05:00`, `validarArchivo(archivo, tipos)`, `construirAlta(estado)` → `AltaEventoEntrada`, y el paso al que vuelve cada código de error de la API. Las pruebas cubren la tabla.
- [x] `apps/web/lib/api.ts`, `api.spec.ts` -- opción `formulario: FormData`.
- [x] `apps/web/components/ui/` -- `AreaTexto`, `Selector` y `CampoArchivo` (etiqueta, error asociado, 48 px), exportados en el índice.
- [x] `apps/web/app/organizador/eventos/nuevo/page.tsx` -- servidor: `GuardaRol`, carga las sedes con el token y pasa las sedes (o el error) al formulario. `ancho="formulario"`.
- [x] `apps/web/app/organizador/eventos/nuevo/formulario-alta.tsx` -- cliente: pasos con barra de avance ("Paso 2 de 5"), "Atrás" y "Siguiente", el foco en el título del paso al cambiar, el borrador de los campos de texto en `localStorage` (los archivos no; se borra al enviar bien). Último paso: "Enviar a aprobación". Al terminar, pantalla de pendiente con `BotonEnlace` a `/organizador/marketing`.
- [x] `apps/web/lib/supabase/navegador.ts` -- `crearClienteNavegador()` con `createBrowserClient` y `configSupabase()`; el formulario lee el token con `auth.getSession()` al enviar. Sin token: `Aviso` con enlace a `/ingresar`.
- [x] `apps/web/app/organizador/page.tsx` -- botón primario "Nuevo evento".

**Acceptance Criteria:**
- Given un organizador a 360 px y a 1440 px, when completa los cinco pasos con datos válidos, then ve "Tu evento está pendiente de aprobación" en menos de 2 minutos, y el evento existe en la BD como `pendiente`.
- Given una cuenta de público, when abre `/organizador/eventos/nuevo`, then ve "Esta sección es para organizadores".
- Given el formulario a medias, when recarga la página, then recupera lo escrito salvo los archivos.
- Given la navegación con teclado, when recorre los pasos, then cada campo tiene su etiqueta, el error se anuncia y el foco va al título del paso.

## Verification

**Commands:**
- `pnpm build && pnpm lint && pnpm test` -- expected: en verde, con `alta-evento.spec.ts`.

**Manual checks (if no CLI):**
- Con `pnpm db:start` y la API levantada, crear un evento con sede nueva y otro con la sede sembrada y música, a 360 y 1440 px.


## Review Triage Log

Pasada 1 (quick): 8 hallazgos — high 0 · medium 2 · low 6 · false 0 · rechazados 1 · aplazados 1.

| Hallazgo | Veredicto | Ruta | Evidencia / acción |
|---|---|---|---|
| Foco perdido con la lista de sedes vacía o sin cargar (selector desactivado) | medium | patch | Se quitó `disabled` del selector de sede: el foco y el error vuelven a funcionar. |
| Sede de un borrador enviada sin verse | low | patch | `validarPaso("sede")` exige que la sede esté en la lista cargada; prueba nueva. |
| ✓ junto a un archivo rechazado | low | patch | `CampoArchivo` muestra el ✓ solo sin error. |
| `ARCHIVO_NO_VALIDO` sin prefijo vuelve a "datos" | low | rechazado | La web ya bloquea los archivos de más de 5 MB y los campos son fijos; el caso casi no se da y arreglarlo añade lógica. |
| "Reintentar" tras un tiempo límite puede duplicar el evento | medium | defer | La API no tiene idempotencia en `POST /eventos`; aplazado en `deferred-work.md`. |
| Borrador compartido entre cuentas del mismo navegador | low | patch | La clave del borrador lleva el id de la cuenta. |
| Sin sesión al cargar sedes se muestra como sin conexión | low | patch | Código `SIN_SESION` con "Tu sesión se cerró…". |
| El aviso del error de la API queda tras corregir | low | patch | Se borra al avanzar con el paso válido. |

Ajuste a pedido de Sandro David (10/10/2026): el hallazgo de `ARCHIVO_NO_VALIDO` sin prefijo se corrige (si el mensaje nombra la constancia → música, la foto → datos; si no nombra ninguno, no cambia de paso). Del duplicado al reintentar se corrige la parte de la web: si el envío se cortó cerca del tiempo límite, no se ofrece "Reintentar" y se avisa que el evento quizá sí llegó (`envioIncierto`). La idempotencia de la API sigue aplazada en `deferred-work.md`.
