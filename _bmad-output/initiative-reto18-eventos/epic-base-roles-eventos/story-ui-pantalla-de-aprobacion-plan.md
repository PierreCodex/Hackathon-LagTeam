---
title: 'UI: pantalla de aprobación'
type: 'feature'
ticket: '10'
created: '2026-10-11'
status: 'built'
baseline_revision: 'fbae46cedd1325f40b5d3dc1c5b22fdcdcf76761'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-reto18-eventos/epic-base-roles-eventos/story-api-aprobacion-y-destacado-plan.md'
  - '{project-root}/_bmad-output/initiative-reto18-eventos/ux-plataforma-eventos/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La API 1.5 ya revisa eventos (pendientes, constancia, aprobar, rechazar, destacar, mis eventos), pero el administrador no tiene pantalla para decidir y el organizador no ve el estado ni el motivo del rechazo: sin eso no hay CAP-3 en la demo.

**Approach:** En `/admin` (Aprobar), la lista de pendientes con su descripción, la constancia, el hueco de `alerta_apdayc`, "Aprobar", "Rechazar" con motivo y "Destacar". En `/organizador` (Mis eventos), la lista de sus eventos con estado y, si fue rechazado, el motivo.

## Boundaries & Constraints

**Always:** Contratos de `@reto18/shared` (`ListaEventosRevisionSchema`, `EventoRevisionSchema`, `RechazoEventoSchema`, `DestacadoEventoSchema`, `ConstanciaEventoSchema`, `CODIGOS_EVENTOS`). Listas leídas en el servidor con el token de la sesión; las acciones van del navegador a la API con `tokenDelNavegador()`, como el alta (1.9). Rechazar pide confirmación (EXPERIENCE.md: acción irreversible) y un motivo de 1–600 caracteres. La constancia se firma solo al pulsar "Ver constancia" y se abre en otra pestaña; la URL firmada no se guarda. `alerta_apdayc` no nula → `Aviso` de advertencia en la tarjeta; nula → nada. Estados con texto o símbolo, no solo color. Fechas en hora de Lima. Errores de la API en un `Aviso` con su mensaje; `ESTADO_EVENTO_INCOMPATIBLE` (409) dice que otro administrador ya lo decidió y quita el evento de la lista.

**Decisiones (2026-10-11):** Destacar solo justo después de aprobar: la tarjeta queda como "Aprobado" con el interruptor "Destacar" mientras sigue en la página; quitar el destacado más tarde queda para Weekend/Tablero. En Mis eventos, un aprobado muestra "Aprobado · Falta armar el mapa y publicar", sin enlace (la 2.9 pondrá el botón). Un aprobado ya publicado (como los de la semilla) dice "Aprobado · Publicado" (decisión del usuario, 2026-10-11).

**Never:** Cambiar la API o la semilla. Generar la alerta con IA (3.6). Publicar el evento ni la pizarra del mapa (2.3/2.9). Dependencias nuevas. Commit, push o PR sin el visto bueno del equipo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pendientes | Admin; semilla con pendientes | Tarjetas con título, categoría, fecha, distrito, aforo, descripción, música sí/no y acciones (el contrato no trae nombre de sede ni de organizador) | Lista vacía → "No hay eventos pendientes" |
| Alerta | Pendiente `…0007` con `alerta_apdayc` | `Aviso` de advertencia con el texto de la alerta | — |
| Constancia | "Ver constancia" | Abre la URL firmada; `url: null` → "Sin constancia" | 503 → `Aviso` con mensaje |
| Aprobar | Pendiente | Pasa a "Aprobado" y ofrece "Destacar" | 409 → aviso y sale de la lista |
| Rechazar | Motivo vacío / 601 caracteres / válido | Vacío o largo: error junto al campo sin llamar a la API; válido: confirma y pasa a "Rechazado" | 400 de la API → mensaje |
| Destacar | Evento recién aprobado | Alterna "Destacado" con `PATCH /destacado` | Error → aviso, sin cambiar el valor |
| Mis eventos | Organizador con eventos en los tres estados | Lista con estado; el rechazado muestra el motivo exacto | Error → `Aviso` con "Reintentar"; vacía → "Nuevo evento" |
| Permisos | Organizador abre `/admin` | "Esta sección es para administradores" (`GuardaRol`) | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/eventos/eventos.controller.ts` -- rutas de la 1.5 (`GET /eventos/pendientes`, `GET /eventos/mis-eventos`, `GET /eventos/:id/constancia`, `PATCH /eventos/:id/aprobar|rechazar|destacado`); contrato y errores en `README.md` (tabla de "Aprobación"). No se toca.
- `packages/shared/src/eventos.ts` -- `EventoRevisionSchema` (= `EventoSchema` + `alerta_apdayc`), `ListaEventosRevisionSchema`, `RechazoEventoSchema` (`motivo_rechazo` recortado 1–600), `DestacadoEventoSchema`, `ConstanciaEventoSchema`, `CODIGOS_EVENTOS` (`EVENTO_NO_EXISTE`, `ESTADO_EVENTO_INCOMPATIBLE`, `ARCHIVO_NO_VALIDO`, `STORAGE_NO_DISPONIBLE`, `BD_NO_DISPONIBLE`). `EventoSchema` trae `sede_id` y `organizador_id`, no sus nombres.
- `apps/web/app/admin/page.tsx` -- portada mínima de la 1.8 (`GuardaRol rol="admin"`, destino `aprobar`); se convierte en la pantalla.
- `apps/web/app/organizador/page.tsx` -- portada de la 1.8 con "Nuevo evento" y un texto "Muy pronto verás aquí la lista"; se cambia por la lista.
- `apps/web/app/organizador/eventos/nuevo/formulario-alta.tsx` -- patrón de acción desde el navegador: `pedirApi` con `apiUrl`, `metodo`, `cabeceras: Authorization`, `tokenDelNavegador()`, aviso "Tu sesión se cerró" con `rutaIngresar`.
- `apps/web/lib/api.ts` (`pedirApi`, `CODIGO_SIN_CONEXION`), `components/ui/` (`Aviso`, `Boton`, `BotonEnlace`, `Tarjeta`, `AreaTexto`, `Chip`, `Esqueleto`), `components/layout/guarda-rol.tsx`.
- `apps/web/lib/pieza.ts` (3.8) -- `fechaPieza(inicio)` da la fecha en hora de Lima ("Vie 16 oct · 8:00 p. m."); reutilizarla, no crear otro formateador.
- `apps/web/app/organizador/datos-organizador.ts` (3.8) -- `tokenDelServidor()`, `cargarMisEventos()`, `ERROR_SIN_SESION`; reutilizar en `/organizador` y para leer pendientes en `/admin` con el mismo token.
- `apps/web/app/organizador/marketing/page.tsx` (3.8) -- ya pinta una lista de `mis-eventos` con estado (símbolo + texto, mapa `ESTADO`). Extraer ese mapa a `lib/revision.ts` y usarlo en las dos pantallas en lugar de duplicarlo.
- `supabase/seed.sql` -- 8 eventos del organizador de demo: aprobados, uno rechazado con motivo "Completar la descripción del programa." y el pendiente `13600000-0000-4000-8000-000000000007` con alerta de DJ.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/lib/revision.ts` + `revision.spec.ts` -- puras: `validarMotivo(texto)` (recorte, 1–600, mensaje), `ESTADO_EVENTO` (símbolo, texto, color; movido desde `organizador/marketing/page.tsx`, que pasa a importarlo), `quitarDecidido(lista, id)`. Fechas con `fechaPieza` de `lib/pieza.ts`. Pruebas de la matriz de motivo y estados.
- [x] `apps/web/app/admin/page.tsx` + `panel-aprobacion.tsx` -- servidor: `GuardaRol`, lee pendientes con el token; cliente: tarjetas, "Ver constancia", "Aprobar", rechazo en línea (abre `AreaTexto` + "Confirmar rechazo" / "Cancelar") y el interruptor "Destacar" en la tarjeta recién aprobada. Botones desactivados mientras su acción está en curso.
- [x] `apps/web/app/organizador/page.tsx` -- conserva "Nuevo evento"; lista de `cargarMisEventos()` con título, fecha, distrito, estado y motivo del rechazado; el aprobado dice "Aprobado · Falta armar el mapa y publicar".
- [x] `apps/web/app/admin/panel-aprobacion.spec.tsx` -- casos de la matriz sobre el HTML del servidor (`renderToStaticMarkup`), separando en componentes exportados lo que dependa de estado (tarjeta, aviso de error, formulario de motivo).

**Acceptance Criteria:**
- Given el admin de demo, when abre Aprobar a 360 px y a 1440 px, then ve el pendiente de la semilla con su alerta, lo aprueba y lo destaca.
- Given un pendiente, when lo rechaza con motivo, then el organizador de demo ve ese motivo exacto en Mis eventos.
- Given un evento ya decidido por otra sesión, when el admin pulsa una acción, then ve el aviso y el evento sale de la lista.

## Implementation Notes

- `lib/revision.ts`: `validarMotivo` usa `RechazoEventoSchema` (mismo recorte y límites que la API) y solo pone el mensaje; `ESTADO_EVENTO` sale de `organizador/marketing/page.tsx`, que ahora lo importa; `quitarDecidido` filtra por `id`.
- `/admin`: `page.tsx` lee `GET /eventos/pendientes` con `tokenDelServidor()` (reutilizado de `organizador/datos-organizador.ts`); error → `Aviso` con "Reintentar". `panel-aprobacion.tsx` (cliente) exporta `PanelAprobacion` y los componentes sin estado `TarjetaRevision`, `FormularioMotivo`, `AvisoErrorRevision`, `InterruptorDestacar` y `ListaVacia`.
- "Ver constancia" abre la pestaña al pulsar (`about:blank`, para que el navegador no la bloquee tras el `await`) y luego le pone la URL firmada; no se guarda en estado. Si la API da `url: null`, la pestaña se cierra y la tarjeta dice "Sin constancia". Si el evento ya no trae `constancia_apdayc_url`, se muestra "Sin constancia" sin botón.
- 409 `ESTADO_EVENTO_INCOMPATIBLE` en Aprobar/Rechazar: aviso de advertencia arriba ("Otro administrador ya decidió …" + mensaje de la API) y la tarjeta sale de la lista. En Destacar, cualquier error queda en la tarjeta sin cambiar el valor.
- Destacar: interruptor `role="switch"` con `aria-checked` y texto ("★ Destacado" / "No destacado"), solo en tarjetas aprobadas en esta visita.
- `/organizador`: la fila se separó en `fila-mis-eventos.tsx` (un `page.tsx` de Next no puede exportar componentes). Vacía → "Aún no tienes eventos" con el "Nuevo evento" de arriba.
- Desviación menor: el aprobado **ya publicado** (los de la semilla) dice "Aprobado · Publicado" en lugar de "Falta armar el mapa y publicar", que sería falso; el aprobado sin publicar dice lo acordado. Ver `textoEstadoOrganizador`.

## Plan Change Log

- 2026-10-11 (auditoría de la matriz): se extrajeron `aplicarErrorAccion` (409 al aprobar/rechazar → sale de la lista con aviso; otro error o 409 al destacar → error en la tarjeta) y `abrirConstancia` (URL firmada → pestaña abierta o nueva sin `opener`; `url: null` → cierra y "Sin constancia"; fallo → cierra) a `lib/revision.ts`, y `ContenidoMisEventos` ({ eventos, error }: error con "Reintentar", vacío, lista; incluye "Nuevo evento") a `organizador/fila-mis-eventos.tsx`. `PanelAprobacion` guarda tarjetas y aviso en un solo estado. Pruebas en `revision.spec.ts` y `panel-aprobacion.spec.tsx` (48 en verde).

## Review Triage Log

**Pasada 1 (quick), 2026-10-11:** high 0, medium 1, low 1, false 3, maybe-false 0.

| Finding | Verdict | Route | Evidence |
|---------|---------|-------|----------|
| Con el rechazo abierto, "Ver constancia" y el formulario se pueden usar a la vez; al acabar una acción se reactivan los botones con otra en curso | medium | patch | `FormularioMotivo` solo se desactiva con `accion === "rechazar"` y `llamar` pone `accion: null` al terminar cualquier llamada; se desactiva el formulario con `accion !== null`. |
| Ventana emergente bloqueada: la constancia no se abre y no hay aviso | low | reject | `window.open("about:blank")` se llama de forma síncrona en el clic, así que el bloqueo es raro; mostrarlo exige un estado y un enlace nuevos. |
| "Aprobado · Publicado" se aparta de la decisión congelada | false | reject | El usuario lo aprobó el 2026-10-11 y quedó escrito en el bloque congelado. |
| Criterios de aceptación sin comprobar de punta a punta | false | reject | No es un defecto del código: la comprobación manual con `pnpm db:start` sigue pendiente y está avisada al usuario. |
| 404 `EVENTO_NO_EXISTE` no saca la tarjeta | false | reject | La API no tiene forma de borrar eventos (ni ruta `@Delete` ni borrado en `eventos.service.ts`), así que un pendiente no desaparece entre lecturas. |

## Verification

**Commands:**
- `pnpm build && pnpm lint && pnpm test` -- expected: en verde, con `revision.spec.ts` y `panel-aprobacion.spec.tsx`.

**Resultados 2026-10-11:** `pnpm build && pnpm lint && pnpm test` en verde (web 146 pruebas en 12 archivos, con `revision.spec.ts` y `panel-aprobacion.spec.tsx`; API 271). Comprobación manual pendiente: Docker no estaba en marcha, así que no se probó contra la API real ni a 360/1440 px.

**Manual checks (if no CLI):**
- Con `pnpm db:start` y la API: entrar como admin de demo, abrir la constancia, aprobar y destacar uno, rechazar otro; luego entrar como organizador de demo y ver los estados y el motivo.
