---
title: 'API: guardar el mapa de la sede y publicar el evento'
type: 'feature'
ticket: '3'
created: '2026-10-10'
status: 'built'
baseline_revision: '94d916d721b49a070865c6ca4a933208463131f3'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La pizarra (2.9, Manuel) no tiene dónde guardar un mapa. Hoy una sede numerada solo existe si viene en la semilla, y la 1.4 solo crea sedes de zona general. Además, un evento aprobado no puede salir al público sin un mapa definido. Sin esto no hay CAP-15 ni elección de butaca.

**Approach:** Agregar al módulo `eventos` los endpoints para crear una sede con su mapa completo (secciones numeradas con filas, bloques y asientos, y zonas generales con capacidad), leerlo, reemplazarlo y duplicar una sede. El mapa se valida con zod y se guarda de forma atómica con una RPC, igual que el alta de la 1.4. Se agrega la **publicación**: el organizador publica su evento aprobado cuando su mapa está listo. Solo los eventos publicados salen al público, y al publicar el mapa del local queda cerrado; quien necesite otro mapa duplica el local (AD-4).

**Decisiones:**
- Cada sede tiene dueño (`creado_por`, el organizador que la creó). Solo su dueño reemplaza el mapa. Cualquier organizador puede leer una sede, usarla en un alta (1.4) o duplicarla, y la copia queda a nombre de quien la duplica; editarla nunca afecta a la original. Las sedes de la semilla no tienen dueño y nadie las edita. No hace falta verificar la cuenta del organizador: basta con aprobar cada evento (1.5) (Jean Pierre, 10/10/2026).
- Flujo: alta (`pendiente`) → aprobación (1.5) → mapa del local (croquis con IA del epic 5 y/o pizarra 2.9) → **publicar** → ventas. Un evento sale al público solo si está aprobado **y** publicado. Publicar exige que el evento esté aprobado, que el que publica sea su organizador y que la capacidad del local alcance el aforo; marca el evento como publicado y **cierra el mapa** del local. El mapa se cierra al publicar, no al aprobar (Jean Pierre, 10/10/2026).
- En el alta (1.4), una sede existente solo se puede usar si es propia o si su mapa está cerrado (publicada o sembrada). Una sede **abierta de otro organizador** se rechaza con 403 `SEDE_AJENA` ("crea tu propio local o duplícalo"), para que los cambios de su dueño nunca afecten eventos ajenos. `propia` en la lista significa "la puedes editar": tuya y con el mapa abierto (Jean Pierre, 10/10/2026, tras la revisión).

## Boundaries & Constraints

**Always:** El mapa de entrada usa la misma estructura que `MapaSedeSchema` (sede → secciones → filas → bloques → asientos), sin ids salvo en las secciones generales que se conservan. El número de asiento es único dentro de la fila; puede haber huecos, porque la pizarra permite quitar asientos. Guardar reemplaza el mapa entero en una sola transacción. Solo el rol `organizador` escribe, y solo el dueño de la sede la reemplaza; `organizador` y `admin` leen. Errores con códigos en `CODIGOS_EVENTOS`. Hay límites de tamaño para que un mapa no tumbe la API.

**Never:** Ni precios por rango (2.4), ni inventario o estados de venta (2.5 y 2.6), ni la lectura del croquis con IA (epic 5). Ninguna escritura desde la web (AD-1). No se cambian las tablas de la 1.3 salvo con una migración nueva.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Crear sede con mapa | Organizador; mapa de los croquis (3 secciones numeradas, 643 asientos) | 201 con el `MapaSede` y sus ids; leerlo da las mismas secciones, filas, bloques, desplazamientos y números | — |
| Sede mixta | Secciones numeradas y una zona general con capacidad | 201; la capacidad de la sede suma asientos y zona general | — |
| Reemplazar el mapa | Sede sin eventos aprobados; mapa con una fila añadida y un asiento quitado | 200 con el mapa nuevo; leerlo da exactamente lo enviado | — |
| Editar sede ajena | Pedro reemplaza el mapa de una sede de Lucía, o cualquiera el de una sede sembrada | Nada cambia | 403 `SEDE_AJENA` |
| Editar sede propia con evento aprobado sin publicar | Sede de Lucía con su evento aprobado | 200: el mapa se puede seguir corrigiendo | — |
| Editar sede con mapa cerrado | Sede de Lucía con un evento publicado, o la sede sembrada | Nada cambia | 403 `SEDE_AJENA` si no es suya; 409 `MAPA_CERRADO` si es suya |
| Publicar | Lucía publica su evento aprobado; la capacidad del local alcanza el aforo | 200 con el evento `publicado: true`; el mapa del local queda cerrado | — |
| Publicar sin aprobar | Evento `pendiente` o `rechazado` | Nada cambia | 409 `EVENTO_NO_APROBADO` |
| Publicar evento ajeno | Pedro publica el evento de Lucía | Nada cambia | 403 `EVENTO_AJENO` |
| Publicar sin capacidad | El local tiene menos capacidad que el aforo (mapa recortado después del alta) | Nada cambia | 409 `AFORO_SUPERA_SEDE` |
| Publicar dos veces | Evento ya publicado | 200, sin cambios (idempotente) | — |
| Duplicar sede | Pedro duplica la sede sembrada o una de Lucía, con nombre nuevo | 201 con otra sede a nombre de Pedro, ids nuevos y el mismo mapa; Pedro puede reemplazar su copia y la original no cambia | — |
| Mapa inválido | Asiento repetido en una fila, fila repetida, sección general con filas, numerada sin filas, nombre vacío o límites superados | Nada guardado | 400 `DATOS_INVALIDOS`, con un mensaje que nombra la ruta del campo |
| Zona general en uso | Reemplazo que quita una sección general que tiene categorías de precio de un evento | Nada cambia | 409 `SECCION_EN_USO` |
| Sede o evento inexistente | Leer, reemplazar o duplicar una sede, o publicar un evento, con un id aleatorio | — | 404 `SEDE_NO_EXISTE` / `EVENTO_NO_EXISTE` |
| Alta en sede abierta ajena | Pedro da de alta un evento (1.4) en la sede abierta de Lucía | Nada creado; archivos subidos, borrados | 403 `SEDE_AJENA` |
| Rol ajeno | Público escribe o lee; admin escribe | — | 403 del guard |

</frozen-after-approval>

## Code Map

- `apps/api/src/eventos/eventos.controller.ts`, `eventos.service.ts` (1.4) -- agregar las rutas y métodos nuevos aquí. Reutilizar el patrón de la 1.4: `@Inject` explícito, `cliente()` que da 503 sin Supabase, `AbortSignal.timeout(TIEMPO_LIMITE_BD_MS)` y RPC con errores `P0001` cuyo `message` es el código. `GET /eventos/sedes` ya existe: no cambiarlo. Una sede numerada nueva aparece ahí porque su capacidad es mayor que 0.
- `packages/shared/src/eventos.ts` -- `MapaSedeSchema` y sus hijos ya validan unicidad de secciones, filas, bloques y números; es el esquema de **salida**. Para la entrada, crear esquemas sin ids (salvo `id` opcional en secciones generales) que reutilicen las mismas reglas, y sumar a `CODIGOS_EVENTOS` los códigos nuevos. No cambiar los esquemas existentes.
- `supabase/migrations/20261010020000_eventos.sql` -- las FK compuestas impiden filas en zonas generales y asientos en bloques de otra fila. `eventos_categorias_precio.seccion_id` referencia secciones **sin** `on delete cascade`: borrar una zona general con categorías falla, y eso se traduce a `SECCION_EN_USO`. `eventos_eventos.sede_id` tampoco tiene cascada.
- `supabase/migrations/20261011000000_eventos_alta.sql` (1.4) -- `eventos_capacidad_sede` sirve para la sede mixta. Copiar el estilo: `security definer`, `set search_path = ''` y `execute` solo para `service_role`.
- `apps/api/test/fixtures/croquis.ts` -- `mapaDeCroquis()` (con ids) y `SEDE_CROQUIS_ID`, la sede sembrada que tiene eventos aprobados (y, tras la semilla nueva, publicados y con el mapa cerrado). Derivar de ahí el mapa de entrada sin ids para la prueba de ida y vuelta.
- `apps/api/test/integracion/semilla-eventos.int.spec.ts` (1.3) -- comprueba los eventos de demo; actualizarla si compara columnas que ahora cambian.
- `apps/api/test/integracion/alta-evento.int.spec.ts` (1.4) -- su `EventoCreadoSchema.parse` exige `publicado` cuando se agregue al esquema; patrón de app de prueba, tokens por rol y limpieza en `afterAll` (borrar las sedes creadas antes de que `limpieza.ts` borre a los usuarios).

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261011010000_eventos_mapa.sql` -- columnas `eventos_eventos.publicado boolean not null default false` y `publicado_en timestamptz`, con un `check` que exige `estado = 'aprobado'` cuando `publicado`; `eventos_sedes.mapa_cerrado boolean not null default false`; RPC `eventos_publicar_evento(p_organizador uuid, p_evento_id uuid)` que bloquea el evento y su sede, valida dueño, estado y capacidad, marca `publicado`, `publicado_en` y `mapa_cerrado` y devuelve el id; columna `eventos_sedes.creado_por uuid null references auth.users(id) on delete set null` (las sedes sembradas quedan sin dueño); `create or replace` de `eventos_crear_evento` (1.4) para que una sede nueva del alta quede a nombre del organizador; `eventos_listar_sedes` recibe al organizador y devuelve `propia`. RPC `eventos_guardar_mapa(p_organizador uuid, p_sede_id uuid, p_mapa jsonb)`: con `p_sede_id` nulo crea la sede a nombre del organizador; si no, la bloquea (`for update`), rechaza `SEDE_NO_EXISTE`, `SEDE_AJENA` (dueño distinto o nulo) y `MAPA_CERRADO` (`mapa_cerrado` true), conserva las secciones generales que traen `id`, borra el resto de secciones, filas, bloques y asientos (`foreign_key_violation` → `SECCION_EN_USO`) e inserta el mapa nuevo. Devuelve el id de la sede. RPC `eventos_duplicar_sede(p_organizador uuid, p_sede_id uuid, p_nombre text)` que copia la sede y todo su mapa con ids nuevos, a nombre del organizador. RPC `eventos_leer_mapa(p_sede_id uuid)` que devuelve el mapa como `jsonb` ordenado. Las tres solo para `service_role` -- atomicidad (AD-4)
- [x] `supabase/seed.sql` -- los eventos aprobados de la demo quedan `publicado = true` y las dos sedes sembradas con `mapa_cerrado = true`; idempotente -- la demo y las pruebas de la 1.3 siguen viendo sus eventos públicos
- [x] `packages/shared/src/eventos.ts` y `index.ts` -- `EventoSchema` suma `publicado: boolean` (y `apps/api/src/eventos/eventos.service.ts` lo agrega a `COLUMNAS_EVENTO`); `MapaSedeEntradaSchema` (nombre, dirección, distrito y secciones; numerada con 1 a 100 filas y bloques con 1 a 200 asientos por fila; general con capacidad; como máximo 20 secciones y 5000 asientos), `DuplicarSedeSchema` (`nombre`) y los códigos `SEDE_AJENA`, `MAPA_CERRADO`, `SECCION_EN_USO`, `EVENTO_NO_EXISTE`, `EVENTO_AJENO` y `EVENTO_NO_APROBADO`; `SedeResumenSchema` suma `propia: boolean`, para que la UI ofrezca editar o duplicar -- un solo DTO
- [x] `apps/api/src/eventos/eventos.service.ts` -- `crearSede(organizadorId, mapa)`, `leerMapa(id)`, `guardarMapa(organizadorId, id, mapa)` y `duplicarSede(organizadorId, id, nombre)`; `listarSedes(organizadorId)` marca `propia`; `publicarEvento(organizadorId, eventoId)`, con la traducción de errores de las RPC -- lógica del módulo
- [x] `apps/api/src/eventos/eventos.controller.ts` -- `POST /eventos/sedes` (201), `GET /eventos/sedes/:id/mapa`, `PUT /eventos/sedes/:id/mapa` `POST /eventos/sedes/:id/duplicar` (201) y `POST /eventos/:id/publicar` (200, `organizador`), con `@Param` y `@Body` validados con zod -- contrato HTTP
- [x] `apps/api/src/eventos/*.spec.ts` -- unitarias del esquema de entrada (cada fila inválida de la matriz y los límites) y del servicio con la RPC simulada (traducción de cada código) -- matriz
- [x] `apps/api/test/integracion/mapa-sede.int.spec.ts` -- contra Supabase local: ida y vuelta del mapa de los croquis, sede mixta, reemplazo, sede ajena (otro organizador y sede sembrada), sede propia con un evento aprobado sin publicar (aprobarlo con el cliente admin de prueba) que se puede editar, publicación y cada caso de la matriz para publicar, edición rechazada tras publicar (`MAPA_CERRADO`) y duplicado que sí se edita, duplicado de una sede ajena y edición de la copia, sede nueva del alta de la 1.4 a nombre del organizador, `propia` en la lista, zona general en uso, sede inexistente y roles; borra en `afterAll` lo que creó -- criterio de la historia
- [x] `README.md` -- endpoints del mapa y la migración nueva en los pasos de la nube -- traspaso

**Acceptance Criteria:**
- Given Supabase local con las migraciones, when se ejecuta `pnpm test:int`, then pasan las pruebas del mapa junto con todas las anteriores.
- Given una sede creada por la API, when se pide `GET /eventos/sedes`, then aparece con su capacidad, y la 1.4 puede usarla en un alta.
- Given un clon limpio, when se ejecutan `pnpm build`, `pnpm lint` y `pnpm test`, then terminan en verde.

## Implementation Notes

- `eventos_listar_sedes` ahora es `eventos_listar_sedes(p_organizador uuid default null)`: el valor por defecto mantiene la llamada sin argumentos de la prueba AD-1 de la 1.4 (sigue dando `42501`).
- `eventos_insertar_secciones(sede, secciones)` es una función interna (sin `execute` para nadie) que comparten `eventos_guardar_mapa` y `eventos_duplicar_sede`. Duplicar copia vía `eventos_leer_mapa`.
- Las zonas generales conservadas pasan por nombres y órdenes provisionales antes de tomar los nuevos, para que intercambiarlos no choque con los `unique (sede_id, nombre|orden)`.
- `eventos_publicar_evento` bloquea primero la sede y luego el evento, en el mismo orden que `eventos_guardar_mapa`, para no interbloquearse.
- Si el reemplazo cambia el `distrito` de la sede, se actualiza el de sus eventos (el alta lo copia de la sede); si no, el catálogo filtraría por un distrito viejo.
- Límites de entrada (`LIMITES_MAPA` en `packages/shared`): 20 secciones, 100 filas por sección, 200 asientos por fila, 5000 asientos, número de asiento hasta 9999, desplazamiento hasta 200, nombres de sección ≤ 60 y de fila ≤ 20 caracteres; cada fila tiene al menos un bloque y cada bloque al menos un asiento. Se añade `IdSchema` (uuid) para validar `:id`.
- `configurarApp` sube el límite del cuerpo JSON a 512 kB: un mapa de 5000 asientos ronda los 80–100 kB, al borde de los 100 kB por defecto de express.
- La validación de `@Body` y `@Param` usa un pipe propio (`ValidarCon`) que reutiliza el formato de mensajes de la 1.4 (`validarConEsquema`), para dar `DATOS_INVALIDOS` con la ruta del campo.
- `EventoSchema` exige `publicado`; las pruebas de la 1.3 comprueban además que los aprobados de la semilla están publicados y que sus sedes no tienen dueño y tienen el mapa cerrado.
- Una sede con 5000 asientos se guarda en ~70 ms en local.

## Plan Change Log

## Review Triage Log

**Pasada 1 (quick), 2026-10-10:** high 0, medium 2, low 2, false 0, maybe-false 0.

| Hallazgo | Veredicto | Ruta | Evidencia / acción |
|---|---|---|---|
| `propia` sigue en true con el mapa cerrado: la UI ofrecería editar y el guardado daría 409 | medium | patch | En la prueba de integración, la sede de Lucía sigue `propia: true` tras publicar. Acción: `propia` = dueño **y** `mapa_cerrado` false; ajustar comentario del esquema y README. |
| `crearSede`/`duplicarSede`: si la lectura posterior falla, el 503 dice "Inténtalo de nuevo" y reintentar duplica la sede | low | patch | La RPC ya confirmó; `eventos_sedes` no tiene único por nombre. Acción: mensaje "El local se creó, pero no se pudo leer. Recarga tus locales.", como en `publicarEvento`. |
| `eventos_publicar_evento`: si el evento se borra entre las dos lecturas, responde `EVENTO_AJENO` en vez de `EVENTO_NO_EXISTE` | low | patch | El segundo `select … for update` no comprueba `found`. No hay endpoint que borre eventos, pero la corrección es una línea. Acción: `if not found then raise … 'EVENTO_NO_EXISTE'`. |
| Un dueño que edita su sede abierta cambia distrito y capacidad de eventos de otros organizadores en esa sede | medium | intent_gap → resuelto | Decisión humana: el alta rechaza sedes abiertas ajenas (`SEDE_AJENA`); queda en el bloque congelado y en la matriz. Se aplica como corrección acotada en `eventos_crear_evento`, sin revertir el resto (aprobado por Jean Pierre). |

## Design Notes

**Reemplazo completo en lugar de cambios parciales.** La pizarra trabaja con el mapa entero y lo envía al guardar. Reemplazar todo es más simple y sin estados intermedios, y los ids de los asientos pueden cambiar sin problema: el inventario (2.5) solo existe para eventos publicados, y publicar cierra el mapa.

**`mapa_cerrado` en la sede y `publicado` en el evento.** El cierre es del local, porque el mapa es del local (AD-4); la publicación es del evento. Las dos marcas se ponen juntas en la misma transacción.

**Impacto en otras historias (anotado en sus epics):** la 1.6 muestra solo eventos `publicado`; la 1.10 lleva al organizador a "Arma el mapa y publica" tras la aprobación; la 2.9 se abre desde el evento aprobado y termina en "Publicar"; la 2.5 crea inventario solo de eventos publicados; el epic 5 entra en el flujo, con la pizarra manual como respaldo.

**Aviso para la 2.4:** si los precios por rango de un evento pendiente se guardan por id de asiento, un reemplazo posterior los rompería. La 2.4 debería guardar los rangos por sección, fila y números, o validar contra el mapa vigente.

## Verification

**Commands:**
- `pnpm db:start && pnpm --filter @reto18/api test:int` -- expected: `mapa-sede.int.spec.ts` y todas las anteriores en verde.
- `pnpm build && pnpm lint && pnpm test` -- expected: todo en verde.
