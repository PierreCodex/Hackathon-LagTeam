---
title: 'API: precios por rango de asientos'
type: 'feature'
ticket: '4'
created: '2026-10-11'
status: 'built'
baseline_revision: '7d19ffe8f9da55775e1e2cc8165ad53923f5941e'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** En una sede numerada, las categorías de precio del evento (1.4) no se vinculan a ningún asiento: `seccion_id` es nulo y no hay forma de decir "fila A, 1–6, VIP; 7–16, General". Sin eso, la pizarra (2.10) no puede pintar precios y `ventas` (2.5) no sabe qué categoría copiar a cada butaca del inventario (CAP-15, AD-4).

**Approach:** Agregar al módulo `eventos` los rangos de precio del evento: el organizador reemplaza la lista entera de rangos (`sección, fila, desde, hasta → categoría`) y la lee junto con la categoría resuelta de cada asiento del mapa vigente. Se guarda con una RPC atómica, igual que el mapa de la 2.3. Los rangos se guardan por **nombre** de sección y de fila y por número de asiento, no por id, para que un reemplazo del mapa antes de publicar no los rompa (aviso de la 2.3).

**Decisiones:**
- Los rangos se editan solo mientras el evento **no está publicado**; publicado, el mapa está cerrado y `ventas` copia los precios al inventario (409 `EVENTO_PUBLICADO`). Los eventos sembrados ya publicados reciben sus rangos en la semilla.
- Guardar reemplaza todos los rangos del evento en una transacción. Un asiento fuera de todo rango queda sin categoría (`categoria_id: null`).
- Publicar (2.3) exige que todos los asientos numerados de la sede tengan categoría; si no, 409 `ASIENTOS_SIN_PRECIO` y nada cambia. Las sedes solo de zona general no se ven afectadas (Jean Pierre, 11/10/2026).

## Boundaries & Constraints

**Always:** Solo el organizador dueño del evento escribe; el dueño y `admin` leen. Cada rango se valida contra el mapa vigente de la sede del evento: sección numerada que existe, fila que existe en ella, `desde ≤ hasta`, y la categoría es del evento y no es de zona general. Los rangos no se solapan dentro de una fila. Puede haber huecos de numeración dentro de un rango (asientos quitados). Errores con códigos en `CODIGOS_EVENTOS`; límites de tamaño como en `LIMITES_MAPA`. Seguridad de las RPC como en la 2.3 (`security definer`, `search_path = ''`, `execute` solo `service_role`, AD-1).

**Never:** Ni inventario, estados ni bloqueo de butacas (2.5), ni el mapa del evento para el público (2.6), ni la pizarra (2.10). `eventos` nunca llama a `ventas`. No cambiar migraciones ya aplicadas: todo va en una migración nueva. Las categorías de zona general siguen como están (1.4 y 2.1).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----|----|----|----|
| Guardar rangos | Lucía, evento aprobado sin publicar en su sede de los croquis; rangos por sección, y la fila A con tres categorías | 200 con `rangos` y `asientos`; cada asiento de la fila A tiene la categoría de su rango | — |
| Leer | Dueño o admin piden los precios | `rangos` ordenados y cada asiento numerado con `seccion`, `fila`, `numero`, `asiento_id`, `categoria_id` (o null) | — |
| Reemplazar | Segundo guardado con menos rangos | Solo quedan los nuevos | — |
| Lista vacía | `rangos: []` | 200; todos los asientos con `categoria_id: null` | — |
| Mapa reemplazado | Se guarda el mapa de nuevo (2.3) tras guardar rangos | Los rangos siguen resolviendo sobre los asientos nuevos | — |
| Solape o rango invertido | Dos rangos de la fila A que comparten un número, o `desde > hasta` | Nada guardado | 400 `DATOS_INVALIDOS` con la ruta |
| Sección o fila inexistente | Fila "Z" o sección que no está en el mapa, o sección general | Nada guardado | 400 `RANGO_FUERA_DEL_MAPA` |
| Categoría ajena | Categoría de otro evento, inexistente o de zona general | Nada guardado | 400 `CATEGORIA_NO_VALIDA` |
| Evento publicado | Guardar en un evento publicado | Nada cambia | 409 `EVENTO_PUBLICADO` |
| Publicar sin precios completos | Evento aprobado en sede numerada con algún asiento sin categoría | Nada cambia; con todos cubiertos, publica | 409 `ASIENTOS_SIN_PRECIO` |
| Evento ajeno | Pedro guarda o lee los precios del evento de Lucía | Nada cambia | 403 `EVENTO_AJENO` |
| Evento inexistente | Id aleatorio | — | 404 `EVENTO_NO_EXISTE` |
| Rol ajeno | Público lee o escribe; admin escribe | — | 403 del guard |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261011020000_eventos_mapa.sql` (2.3) -- patrón a copiar: RPC `eventos_guardar_mapa` (bloqueo `for update`, errores `P0001` cuyo `message` es el código, `detail` legible) y `eventos_publicar_evento` (orden de bloqueo: sede y luego evento). `eventos_leer_mapa` muestra cómo recorrer sección → fila → bloque → asiento.
- `supabase/migrations/20261010020000_eventos.sql` -- `eventos_categorias_precio` (con `evento_id`, `sede_id`, `seccion_id` nulo para numeradas). Nombres de sección únicos por sede y de fila únicos por sección: sirven como clave del rango.
- `supabase/seed.sql` líneas ~109–116 -- categorías "Platea baja", "Platea media", "Mezanine" de los eventos 1, 2, 5 y 7 en la sede de los croquis (`13100000-…-0001`), ids `13700000-…-(numero*10+orden)`. Los rangos sembrados van aquí, idempotentes.
- `apps/api/src/eventos/eventos.service.ts` -- reutilizar `cliente()`, `llamarRpc(nombre, args, accion)` (traduce `P0001`), `validarConEsquema`, `TIEMPO_LIMITE_BD_MS`; ver `publicarEvento` (~l. 408) y `leerMapa` (~l. 356).
- `apps/api/src/eventos/eventos.controller.ts` -- rutas con `@Roles`, `ID_VALIDO`, `ValidarCon(esquema, raiz)` y `@UsuarioActual()`; poner las rutas nuevas antes de `@Get(":id")`.
- `packages/shared/src/eventos.ts` -- `CODIGOS_EVENTOS`, `LIMITES_MAPA`, `textoHasta`; exportar desde `index.ts`. No cambiar los esquemas existentes.
- `apps/api/test/fixtures/croquis.ts` -- `entradaDeCroquis()`, `CROQUIS` (oráculo de filas y números) y `SEDE_CROQUIS_ID`.
- `apps/api/test/integracion/mapa-sede.int.spec.ts` (2.3) -- patrón de app de prueba, tokens por rol, aprobar con el cliente admin y limpieza en `afterAll`.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261014000000_eventos_precios.sql` -- tabla `eventos_precios_rango` (`evento_id`, `categoria_id` con FK `on delete cascade`, `seccion` text, `fila` text, `desde`, `hasta` con `check (desde > 0 and desde <= hasta)`), RLS sin acceso salvo `service_role`; RPC `eventos_guardar_precios(p_organizador, p_evento_id, p_rangos jsonb)` que bloquea el evento, valida dueño, no publicado, categoría y existencia de sección numerada y fila, borra e inserta; función `eventos_precios_asientos(p_evento_id)` que devuelve cada asiento numerado del mapa vigente con su categoría resuelta (o null) -- atomicidad y una sola resolución que también usará la 2.5; además `create or replace` de `eventos_publicar_evento` (misma firma y orden de bloqueo) que, antes de marcar publicado, rechaza `ASIENTOS_SIN_PRECIO` si `eventos_precios_asientos` devuelve algún asiento sin categoría -- decisión del bloque congelado
- [ ] `apps/api/test/integracion/mapa-sede.int.spec.ts` y demás pruebas que publican en sedes numeradas -- guardar rangos que cubran todo antes de publicar -- siguen en verde con la regla nueva
- [ ] `supabase/seed.sql` -- rangos de los eventos 1, 2, 5 y 7: cada sección entera con su categoría homónima; idempotente -- la 2.5 y la 2.6 parten de butacas con precio
- [ ] `packages/shared/src/eventos.ts` -- `RangoPrecioEntradaSchema` y `PreciosEntradaSchema` (`rangos`, máx. 2000, sin solapes por sección y fila), `PreciosEventoSchema` (`rangos`, `asientos`), códigos `EVENTO_PUBLICADO`, `RANGO_FUERA_DEL_MAPA`, `CATEGORIA_NO_VALIDA`, `ASIENTOS_SIN_PRECIO` -- un solo DTO
- [ ] `apps/api/src/eventos/eventos.service.ts` -- `leerPrecios(usuario, eventoId)` (dueño o admin) y `guardarPrecios(organizadorId, eventoId, entrada)` -- lógica del módulo
- [ ] `apps/api/src/eventos/eventos.controller.ts` -- `GET /eventos/:id/precios` (`organizador`, `admin`) y `PUT /eventos/:id/precios` (`organizador`) -- contrato HTTP
- [ ] `apps/api/src/eventos/precios.spec.ts` -- unitarias del esquema (solape, invertido, límites) y de la traducción de cada código con la RPC simulada -- matriz
- [ ] `apps/api/test/integracion/precios-rango.int.spec.ts` -- contra Supabase local: rangos del croquis con una fila de varias categorías y comprobación asiento por asiento contra `CROQUIS`, cada fila de la matriz, mapa reemplazado, rangos de la semilla; limpieza en `afterAll` -- criterio de la historia
- [ ] `README.md` -- endpoints de precios y la migración nueva -- traspaso

**Acceptance Criteria:**
- Given Supabase local con las migraciones y la semilla, when se ejecuta `pnpm test:int`, then pasan las pruebas de precios junto con todas las anteriores.
- Given la semilla, when el organizador demo pide `GET /eventos/<evento 1>/precios`, then los 643 asientos tienen categoría.
- Given un clon limpio, when se ejecutan `pnpm build`, `pnpm lint` y `pnpm test`, then terminan en verde.

## Implementation Notes

- Durante la implementación `main` avanzó a `7d19ffe` (#31 y #32) y el trabajo quedó sin commit sobre `main`. La rama `feat/2-4-precios-rango` (sin commits propios) se adelantó a `main` y el trabajo pasó a ella; `baseline_revision` se movió de `ac18bc7` a `7d19ffe` para que el diff de revisión solo tenga esta historia.
- Verificado en la rama: `precios.spec.ts` (23) y `pnpm test:int` (13 archivos, 174 pruebas) en verde; el implementador corrió además `pnpm build`, `pnpm lint` y `pnpm test`.

## Plan Change Log

- 2026-10-11: la migración pasa a `20261015000000_eventos_precios.sql`: `main` (#32, historia 3.2) ya trae `20261014000000_marketing_enlaces.sql` con la misma versión.
- 2026-10-11: se añade la RPC `eventos_leer_precios(p_evento_id) returns jsonb` (rangos en el orden del mapa y asientos resueltos con `eventos_precios_asientos`). La API la usa en lugar de llamar a la función de conjunto por PostgREST, que corta en `max_rows = 1000` y un mapa admite 5000 asientos.
- 2026-10-11: `precios-rango.int.spec.ts` llama a la app con `fetch` (app escuchando en `127.0.0.1`) en vez de supertest: con respuestas de ~80 kB, superagent a veces no termina de leer la respuesta en Windows (ECONNRESET a los ~19 s, aunque la API respondió en ms).

## Review Triage Log

**Pasada 1 (quick), 2026-10-11:** high 0, medium 0, low 3, false 2, maybe-false 0.

| Hallazgo | Veredicto | Ruta | Evidencia / acción |
|---|---|---|---|
| La prueba de la semilla lee como admin, no como el organizador demo del criterio | low | rechazado | La lectura del dueño se prueba con Lucía en el resto del archivo; el organizador demo no tiene contraseña en la semilla, así que el arreglo sería reescribir el criterio (editar el plan). |
| El solape detectado por la RPC no nombra `rangos.N` | low | rechazado | Solo se alcanza saltándose `PreciosEntradaSchema`, que ya da la ruta; dar el índice exige más lógica en la RPC. |
| README dice "ordenado por sección, fila y número" y el código ordena por `orden` del mapa | low | patch | README corregido: orden del mapa por sección y fila, y por número dentro de la fila. La diferencia por bloques no ascendentes no ocurre con la pizarra. |
| `MAXIMO_RANGOS_PRECIO` fuera de `LIMITES_MAPA` y no comprobado en la RPC | false | rechazado | Mismo patrón que `LIMITES_MAPA` (solo el esquema); no hay daño concreto. |
| Archivos sueltos sin seguimiento en la raíz podrían colarse en el commit | false | rechazado | No están en el diff; se excluyen al hacer el commit. |

## Design Notes

**Clave por nombre.** La 2.3 reemplaza el mapa entero y los ids de sección, fila y asiento cambian; los nombres y números son lo que el organizador ve y lo que la pizarra conserva. Un rango que ya no casa con el mapa simplemente no resuelve ningún asiento.

**Forma del cuerpo:**
```json
{ "rangos": [
  { "categoria_id": "…", "seccion": "Platea baja", "fila": "A", "desde": 1, "hasta": 6 },
  { "categoria_id": "…", "seccion": "Platea baja", "fila": "A", "desde": 7, "hasta": 16 }
] }
```

## Verification

**Commands:**
- `pnpm db:start && pnpm --filter @reto18/api test:int` -- expected: `precios-rango.int.spec.ts` y todas las anteriores en verde.
- `pnpm build && pnpm lint && pnpm test` -- expected: todo en verde.

