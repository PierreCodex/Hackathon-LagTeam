---
title: 'Esquema de sedes, mapa y eventos (parte 2 de la historia 1.3)'
type: 'feature'
ticket: '3'
created: '2026-10-10'
status: 'built'
baseline_revision: '3b3870b4e6dab174fc64b88d726acd06e1e5b8c0'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/initiative-reto18-eventos/architecture-reto18-plataforma-eventos/architecture-reto18-plataforma-eventos.md'
  - '{project-root}/_bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/mapa-asientos.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No existen las tablas de sedes, mapa y eventos ni sus esquemas compartidos: la 1.4 (alta), la 1.6 (catálogo), la pizarra del epic 2 y la IA del epic 3 no tienen sobre qué construir, y no hay datos de demo.

**Approach:** Una migración del módulo `eventos` con la jerarquía sede → sección → fila → bloque → asiento, los eventos y sus categorías de precio; los esquemas zod equivalentes en `packages/shared`; y `supabase/seed.sql` con la sede de ejemplo de los dos croquis (643 butacas) y los eventos de la demo. Pruebas de integración comprueban la semilla contra los croquis y las restricciones.

**Decisiones (10/10/2026):**
- Categorías de evento: `musica`, `teatro`, `danza`, `artes_visuales` ("Muestra de arte" de CAP-3), `cine`, `literatura`, `otro`; enum en zod y `check` en la tabla.
- Se mantiene el plan entero (≈1935 tokens): la tabla de los croquis es imprescindible para la semilla.

## Boundaries & Constraints

**Always:** Tablas con prefijo `eventos_`, `snake_case`, UUID, `timestamptz`, importes en céntimos con IGV (AD-2, AD-10, convenciones). RLS activado y sin permisos para `anon` ni `authenticated` (AD-1). Organizador enlazado a `auth.users`, no a `identidad_perfiles`. El número de asiento es único dentro de su fila; una sección es `numerada` (con asientos) o `general` (con `capacidad`). La semilla es repetible y la cargan tanto `supabase db reset` en local como el SQL Editor en la nube.

**Never:** Endpoints (son de la 1.4, 1.6 y 2.3). Inventario, estados de butaca o asientos vendidos (epic 2, `ventas`). Asignación de categorías de precio a rangos de asientos (historia 2.4). Tablas de otros módulos.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Semilla = croquis | `pnpm db:start` / `supabase db reset` | La sede de ejemplo tiene Platea baja (190), Platea media (204) y Mezanine (249), con las filas, bloques, numeración y desplazamientos de la tabla de Design Notes | No error expected |
| Eventos de demo | Semilla cargada | Hay eventos aprobados, al menos uno pendiente y uno destacado, con distintas fechas, categorías, distritos y precios, y al menos uno con zona general con capacidad | No error expected |
| Asiento repetido en una fila | Insertar dos asientos con el mismo número en la misma fila | Se rechaza | Violación de restricción única |
| Sección incoherente | Sección `general` sin capacidad, o `numerada` con capacidad | Se rechaza | Violación de `check` |
| Acceso desde el navegador | Clave anon o JWT de usuario leyendo o escribiendo una tabla `eventos_` | Sin filas al leer; escritura rechazada | Error de permisos |

</frozen-after-approval>

## Code Map

- `supabase/migrations/` -- `20261010000000_salud.sql` (1.1). La 1.2 (rama `t/1.2-auth-roles`, sin fusionar) añade `20261010010000_identidad.sql`: usar un timestamp posterior y no tocar `identidad_`.
- `supabase/config.toml` -- `[db.seed] enabled = true`, `sql_paths = ["./seed.sql"]`; hoy avisa de que falta `seed.sql`.
- `packages/shared/src/index.ts` -- exporta `error.js`, `salud.js`; añadir `eventos.js`. La 1.2 añade `identidad.js` en la misma línea (conflicto trivial).
- `apps/api/test/integracion/` -- ayudas de la parte 1: `crearAppDePrueba`, `tokenPorRol`, `clienteAdminDePrueba`/`clientePublicoDePrueba` en `ayudas/supabase.ts`; `globalSetup` exige BD local.
- `packages/shared` no tiene ejecutor de pruebas (`test` es un `echo`); las de zod van en `apps/api` o se añade Vitest al paquete.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261010020000_eventos.sql`, `packages/shared/src/eventos.ts` (solo si cambia el contrato), `apps/api/test/integracion/esquema-eventos.int.spec.ts` -- garantizar que toda categoría con `seccion_id` pertenezca a una sección general de la misma sede de su evento; comprobar INSERT/UPDATE de categoría y cambios posteriores de sede del evento o sección. Preferir restricciones declarativas con claves compuestas y una referencia de sede consistente a lógica que pueda dejar asociaciones inválidas. Las categorías numeradas conservan `seccion_id = null`.
- [x] `supabase/migrations/20261010020000_eventos.sql` -- tablas `eventos_sedes`, `eventos_secciones`, `eventos_filas`, `eventos_bloques` (orden y `desplazamiento`), `eventos_asientos`, `eventos_eventos` (organizador → `auth.users`, sede, título, descripción, categoría, distrito, `inicio`, `estado` pendiente|aprobado|rechazado, `motivo_rechazo`, `destacado`, `hay_musica`, `constancia_apdayc_url`, `foto_url`, `aforo`) y `eventos_categorias_precio` (evento, nombre, color, `precio_centimos`, `seccion_id` opcional para zonas generales); `check`, `unique`, índices para los filtros del catálogo; RLS y `revoke` -- esquema (AD-4)
- [x] `packages/shared/src/eventos.ts`, `index.ts` -- esquemas zod: `MapaSede` (secciones → filas → bloques → asientos, para la 2.3), `Evento`, `CategoriaPrecio`, enums de estado, tipo de sección y categoría de evento -- contrato compartido
- [x] `supabase/seed.sql` -- organizador de demo en `auth.users` con UUID fijo, sede de ejemplo según la tabla de Design Notes (asientos generados por rango), una sede pequeña con zona general, y 6–8 eventos de demo en Piura (octubre–noviembre de 2026, incluido un fin de semana completo para el Weekend) con sus categorías de precio; idempotente -- datos de demo
- [x] `apps/api/test/integracion/semilla-eventos.int.spec.ts` -- recorre la sede de ejemplo y la compara con la tabla de Design Notes (secciones, filas, bloques, números y desplazamientos) y comprueba los eventos de demo -- condición de la historia
- [x] `apps/api/test/integracion/esquema-eventos.int.spec.ts` -- restricciones (asiento repetido, sección incoherente) y que anon y un JWT de usuario no leen ni escriben `eventos_` -- matriz
- [x] pruebas de los esquemas zod (un mapa válido de la sede de ejemplo pasa; asiento repetido o sección incoherente no) -- contrato
- [x] `README.md` -- cómo cargar la semilla en la nube (SQL Editor, tras la migración) -- traspaso

**Acceptance Criteria:**
- Given Supabase local recién levantado, when se ejecuta `pnpm test:int`, then pasan las pruebas de semilla y de esquema junto con las de la parte 1.
- Given el proyecto en la nube con las migraciones aplicadas, when se ejecuta `seed.sql` dos veces en el SQL Editor, then no hay errores ni filas duplicadas.

## Implementation Notes

- Implementado en `feat/1-3-esquema-sedes-eventos`, sin commit, push ni PR. Identidad 1.2 ya está integrada en el baseline.
- Siete tablas con RLS y permisos revocados; claves foráneas compuestas impiden filas en zonas generales y asientos con bloque/fila incompatibles.
- Semilla: 2 sedes, 4 secciones, 23 filas, 54 bloques, 643 asientos, 8 eventos y 16 categorías. Organizador de referencia sin credenciales utilizables ni perfil, documentado en README.
- Pruebas Zod alojadas en `apps/api/src/eventos/eventos.spec.ts`; oráculo de croquis independiente del SQL en `apps/api/test/fixtures/croquis.ts`.
- Corrección de pertenencia: `eventos_categorias_precio.sede_id` es obligatorio y compartido por las FK `(evento_id, sede_id)` y `(seccion_id, sede_id, seccion_tipo)`. Las claves únicas de eventos y secciones sostienen ambas referencias; se rechazan también cambios posteriores de sede/tipo que invaliden una categoría. El contrato Zod, la semilla y README incluyen `sede_id`; las categorías numeradas conservan `seccion_id = null`.
- Diez pruebas de integración adicionales cubren INSERT/UPDATE incompatibles, sede nula, referencias inexistentes, categorías numeradas, traslado coherente y cambios de sede/tipo en padres; verifican además que los datos rechazados se conservan.

## Plan Change Log

- 2026-10-10, revisión quick, iteración 1: la FK comprobaba el tipo general pero admitía categorías de una sede ajena al evento. Se explicita la pertenencia en Tasks & Acceptance sin modificar el bloque congelado. KEEP: conservar las siete tablas, RLS/revoke, la unicidad por fila, la separación mapa/precios, los contratos, los 643 asientos exactos, los 8 eventos, las pruebas de croquis y permisos, y README. Copia de la implementación previa en `C:/Users/Owner/AppData/Local/Temp/bmad-eventos-keep-14e98e31-9906-4d5b-9353-d0858cb932cc`, con rutas relativas al repo: recuperar esos archivos como base y modificar únicamente lo necesario para la pertenencia, sus pruebas y documentación aplicable. Verificar otra vez con `pnpm db:start`, reset local, build/lint/test y `pnpm test:int`. No commit, push ni PR.

## Review Triage Log

| Iteración | Hallazgo | Veredicto | Evidencia y resolución |
|---|---|---|---|
| 1 | Categoría general de otra sede (`20261010020000_eventos.sql`) | medium → bad_plan | La FK `(seccion_id, seccion_tipo)` solo valida existencia/tipo. El revisor reprodujo en una transacción revertida un precio del Teatro asociado al Patio. Rompería la creación de cupos de ventas descrita en AD-4. Se añade la pertenencia explícita a las tareas y se preserva la implementación válida para corregir esa relación. |

- Cierre de la iteración 1: corrección aplicada con claves foráneas compuestas y diez pruebas de regresión en verde. La segunda revisión quick independiente no encontró defectos concretos ni reglas vulneradas; sin hallazgos diferidos. Implementación local `built`, pendiente de validación del equipo y de comprobar el SQL Editor del proyecto en la nube. No se hizo commit, push ni PR, conforme a la instrucción del usuario.

## Design Notes

Transcripción de los croquis (`insumos/`). Formato por fila: bloques `inicio–fin`, separados por `|`; `+n` = desplazamiento del bloque, en butacas, respecto al bloque más a la izquierda de esa columna en la sección. Una categoría de precio por sección para la demo; los colores por rango son de la 2.4.

| Sección (orden) | Filas | Bloques por fila |
|---|---|---|
| Platea baja (1) | A, B, C | `+2 1–11 \| 12–22` |
| | D, E, F | `+1 1–12 \| 13–24` |
| | G, H | `1–13 \| 14–26` |
| Platea media (2) | I, J, K | `+1 1–14 \| 15–28` |
| | L, M, N, O | `1–15 \| 16–30` |
| Mezanine (3) | P | `+1 1–8 \| 9–26 \| 27–34` |
| | Q | `+1 1–8 \| 9–26 \| 27–36` |
| | R | `1–9 \| 10–27 \| 28–37` |
| | S, T | `1–9 \| 10–26 \| 27–36` |
| | U | `+2 1–7 \| +5 8–14 \| 15–22` |
| | V | `+1 1–8 \| +5 9–15 \| 16–23` |
| | W | `+1 1–8 \| +4 9–17 \| 18–25` |

Totales: 190 + 204 + 249 = 643. Las butacas grises de los croquis son ventas, no mapa: no se siembran aquí.

## Verification

**Resultados locales (2026-10-10):**
- `pnpm db:start`: correcto, Supabase en Docker.
- `pnpm exec supabase db reset`: tres migraciones y semilla aplicadas sin errores.
- `pnpm build`, `pnpm lint`: correctos.
- `pnpm test`: 106 pruebas API y 6 web correctas (13 unitarias nuevas).
- `pnpm test:int`: 57 pruebas en 5 archivos correctas (33 nuevas), incluida la regresión de pertenencia; también después de ejecutar la semilla dos veces. Verificación repetida tras restaurar la implementación y aplicar la corrección.
- `supabase/seed.sql` ejecutado dos veces mediante `docker exec -i supabase_db_reto18 psql -U postgres -d postgres -v ON_ERROR_STOP=1`: ambas transacciones completas; conteos conservados. El SQL Editor de la nube no se ejecutó en esta sesión.
- Auditoría de matriz: croquis y eventos cubiertos en `semilla-eventos.int.spec.ts`; unicidad, secciones incoherentes y lectura/INSERT/UPDATE/DELETE con anon y JWT sobre las siete tablas cubiertos en `esquema-eventos.int.spec.ts`. Todas estas pruebas se ejecutaron y pasaron.
- RLS activo en las siete tablas confirmado mediante consulta SQL; `git diff --check` correcto.

**Commands:**
- `pnpm build && pnpm lint && pnpm test` -- expected: en verde
- `pnpm exec supabase db reset` y `pnpm test:int` -- expected: semilla cargada sin errores y todas las pruebas de integración en verde
