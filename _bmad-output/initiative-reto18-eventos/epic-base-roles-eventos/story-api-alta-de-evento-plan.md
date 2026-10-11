---
title: 'API: alta de evento'
type: 'feature'
ticket: '4'
created: '2026-10-10'
status: 'done'
baseline_revision: '22da709d6aa823598cee9906772ba05647af925d'
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

**Problem:** Un organizador todavía no puede crear eventos: no existe ningún endpoint de `eventos`. Sin el alta no hay CAP-2, ni demo, ni nada para la UI 1.9.

**Approach:** Crear el módulo `eventos` de la API con un alta multipart del organizador. El alta recibe los datos del evento, una sede existente o una sede nueva de zona general, categorías de precio y dos archivos: la foto y la constancia de APDAYC. Los archivos se suben a Storage, y el evento se crea de forma atómica en estado `pendiente`. Si hay música y no hay constancia, se rechaza con un código de error. También se agrega la lista de sedes que necesita el formulario para elegir.

**Decisiones:**
- El aforo lo escribe el organizador y la API lo valida: debe ser un entero positivo y no puede superar la capacidad de la sede (asientos numerados más capacidades de las zonas generales; en una sede nueva, su capacidad). Si la supera, 400 `AFORO_SUPERA_SEDE` (Jean Pierre, 10/10/2026).
- Las sedes son compartidas: `GET /eventos/sedes` lista todas para sugerir el local a cualquier organizador, y una sede nueva queda disponible para los demás. Quien necesite el mismo local armado de otra forma lo duplica (AD-4, fuera de esta historia). En esta historia una sede nueva es solo de zona general; el croquis con Claude es del epic 5 y la pizarra, del epic 2 (Jean Pierre, 10/10/2026).

## Boundaries & Constraints

**Always:** Solo el rol `organizador` crea eventos (`@Roles("organizador")`, AD-3). El `organizador_id` sale del token, nunca del cuerpo. Los precios son enteros en céntimos, con el IGV incluido (AD-10). El contrato vive en `packages/shared` y es la única fuente del DTO. Los errores siguen el formato `{ error: { codigo, mensaje } }` con códigos en `CODIGOS_EVENTOS`. Si algo falla después de subir los archivos, se borran: no quedan archivos huérfanos. Las llamadas a Storage tienen tiempo límite.

**Never:** No se crean secciones numeradas, filas ni asientos, ni precios por rango: eso es de la pizarra (2.3 y 2.4). Tampoco aprobación ni destacado (1.5), ni catálogo (1.6). La web nunca escribe en Storage ni en la BD (AD-1). No se cambian las tablas de la 1.3 salvo con una migración nueva.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Alta con sede nueva | Organizador; sede nueva general (nombre, dirección, distrito, capacidad 120); 2 categorías; foto; sin música | 201 con el evento `pendiente`, el `aforo` que envió (≤ 120), distrito de la sede, `foto_url` y sus 2 categorías vinculadas a la sección general | — |
| Alta con sede existente | `sede_id` de la sede sembrada de 643 butacas; `aforo` 500; con música y constancia | 201, `pendiente`, `hay_musica` true, `constancia_apdayc_url` guardada, `aforo` 500 | — |
| Aforo mayor que la sede | Sede sembrada con `aforo` 700, o sede nueva con capacidad 120 y `aforo` 150 | Nada creado; archivos subidos, borrados | 400 `AFORO_SUPERA_SEDE` |
| Música sin constancia | `hay_musica: true`, sin archivo de constancia | No se crea nada ni se sube nada | 400 `MUSICA_SIN_CONSTANCIA` |
| Sede inexistente | `sede_id` aleatorio | Nada creado; archivos subidos, borrados | 404 `SEDE_NO_EXISTE` |
| Datos inválidos | Sin categorías, precio negativo, nombres de categoría repetidos, `inicio` pasado o JSON mal formado | Nada creado | 400 `DATOS_INVALIDOS`, con un mensaje que nombra el campo |
| Archivo no válido | Foto que no es imagen, constancia que no es PDF ni imagen, o archivo de más de 5 MB | Nada creado | 400 `ARCHIVO_NO_VALIDO` |
| Rol ajeno | Token de público o de admin; sin token | — | 403 / 401 del guard |
| Storage caído | El tiempo límite vence al subir | Nada creado | 503 `STORAGE_NO_DISPONIBLE` |

</frozen-after-approval>

## Code Map

- `apps/api/src/app.module.ts` -- registrar `EventosModule` junto a `IdentidadModule`.
- `apps/api/src/identidad/roles.ts` -- reutilizar `@Roles`, `@UsuarioActual()` y `UsuarioAutenticado`. No cambiar.
- `apps/api/src/identidad/identidad.controller.ts`, `identidad.service.ts` -- patrón a copiar: `@Inject(...)` explícito (Vitest no emite metadatos), `SUPABASE_CLIENTE` puede ser `null` → 503, `AbortSignal.timeout(3000)` en las lecturas.
- `apps/api/src/filtro-errores.ts` -- ya toma `codigo` y `mensaje` del cuerpo de la excepción; no hace falta tocarlo.
- `@nestjs/platform-express` 12.1.2 trae multer 2.4: `FileFieldsInterceptor` y `UploadedFiles`, con `limits.fileSize`.
- `packages/shared/src/eventos.ts` -- tiene `EventoSchema`, `CategoriaPrecioSchema` y `CategoriaEventoSchema`. Agregar el contrato del alta y de la lista de sedes; no cambiar los esquemas existentes, porque la semilla y las pruebas de la 1.3 dependen de ellos.
- `supabase/migrations/20261010020000_eventos.sql` -- tablas y claves compuestas de la 1.3. Las categorías llevan `sede_id` obligatorio y, si son de una zona general, `seccion_id`; las FK rechazan secciones ajenas o numeradas. `eventos_sedes` no tiene dueño: una sede nueva queda disponible para todos (decisión del bloque congelado).
- `apps/api/test/integracion/ayudas/` -- `crearAppDePrueba`, `api(app, token)` (supertest admite `.attach()` y `.field()`) y `tokenPorRol`. `eventos_eventos.organizador_id` referencia `auth.users` **sin cascada**: la prueba debe borrar sus eventos en su propio `afterAll`, que corre antes que el de `limpieza.ts` (los hooks se ejecutan como pila), o el borrado de usuarios falla.
- `supabase/seed.sql` -- la sede de 643 butacas (UUID fijo) sirve para el caso de sede existente.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261011000000_eventos_alta.sql` -- buckets `eventos-fotos` (público, imágenes, 5 MB) y `eventos-constancias` (privado, PDF e imágenes, 5 MB); función `eventos_crear_evento(datos jsonb)`, con `security definer` y `execute` solo para `service_role`, que en una transacción crea la sede nueva y su sección general si hace falta, comprueba que el aforo no supere la capacidad de la sede, toma el distrito de la sede e inserta el evento `pendiente` y sus categorías; devuelve el id. Sede inexistente o aforo excesivo → excepción con un código reconocible -- atomicidad sin transacciones en supabase-js
- [x] `packages/shared/src/eventos.ts` y `index.ts` -- `AltaEventoSchema` (título, categoría, descripción de 20 a 600 caracteres, `inicio` futuro, `aforo` entero positivo, `hay_musica`, `sede` como unión `existente{sede_id}` o `nueva{nombre, direccion, distrito, capacidad}`, de 1 a 6 categorías `{nombre, precio_centimos, color?}` con nombres únicos), `SedeResumenSchema`, `EventoCreadoSchema` (evento y categorías) y `CODIGOS_EVENTOS` -- un solo DTO
- [x] `apps/api/src/eventos/archivos-eventos.ts` -- sube y borra en los dos buckets con tiempo límite de 10 s; valida el tipo MIME y el tamaño; devuelve la URL pública de la foto y la URL del objeto de la constancia -- aislar Storage para las pruebas
- [x] `apps/api/src/eventos/eventos.service.ts` -- `crear(organizadorId, datos, archivos)`: música sin constancia → error antes de subir; sube; llama a la RPC; si falla, borra lo subido; traduce los errores a los códigos. `listarSedes()` devuelve las sedes con su distrito y su capacidad, para que el formulario muestre el máximo -- lógica del módulo
- [x] `apps/api/src/eventos/eventos.controller.ts` y `eventos.module.ts` -- `POST /eventos` (multipart: campo `datos` en JSON, archivos `foto` y `constancia`; 201) y `GET /eventos/sedes`, los dos con `@Roles("organizador")` -- contrato HTTP
- [x] `apps/api/src/eventos/*.spec.ts` -- unitarias del esquema del alta (cada fila de datos inválidos de la matriz) y del servicio con Storage y RPC simulados (música sin constancia no sube nada; un fallo de la RPC borra lo subido; el tiempo límite da 503) -- matriz
- [x] `apps/api/test/integracion/alta-evento.int.spec.ts` -- contra Supabase local: sede nueva, sede sembrada con música y constancia, aforo mayor que la sede, música sin constancia, sede inexistente, público con 403, y la lista de sedes. Borra en `afterAll` sus eventos, las sedes nuevas y los archivos -- criterio de la historia
- [x] `README.md` y `.env.example` -- cómo aplicar la migración en la nube y que los buckets se crean con ella; sin variables nuevas, salvo que alguna haga falta -- traspaso

**Acceptance Criteria:**
- Given Supabase local con la migración, when se ejecuta `pnpm test:int`, then pasan las pruebas del alta junto con las de la 1.2 y la 1.3.
- Given un alta válida, when se consulta `eventos_eventos`, then el evento está `pendiente`, su `organizador_id` es el del token y sus categorías tienen el `sede_id` del evento.
- Given un clon limpio, when se ejecutan `pnpm build`, `pnpm lint` y `pnpm test`, then terminan en verde.

## Implementation Notes

- La migración agrega, además de `eventos_crear_evento`, dos funciones de apoyo: `eventos_capacidad_sede(uuid)` (asientos numerados más zonas generales; la usan el alta y la lista) y `eventos_listar_sedes()` (alimenta `GET /eventos/sedes`; omite sedes con capacidad 0, donde no cabe ningún evento). Las tres solo las ejecuta `service_role`; la prueba de integración comprueba el 42501 desde el navegador.
- Errores de la RPC: excepción `P0001` con el mensaje `SEDE_NO_EXISTE` o `AFORO_SUPERA_SEDE` (el `detail` da las cifras y se pasa al mensaje).
- Categorías: se vinculan a la zona general solo cuando es la única sección de la sede (siempre en una sede nueva). En sedes numeradas o con varias zonas, `seccion_id` queda `null`: los precios por sección o rango son de la pizarra (2.3 y 2.4).
- `color` de la categoría es opcional; si falta, la API asigna el primer color de una paleta fija que no use ya otra categoría del alta.
- La foto es obligatoria (400 `ARCHIVO_NO_VALIDO` si falta). Si `hay_musica` es `false`, una constancia enviada se ignora y no se sube.
- El tipo del archivo se detecta por sus primeros bytes (JPG, PNG, WebP, PDF), no por el `Content-Type` del navegador; ese tipo es el que se guarda en Storage.
- Multer (memoria, 5 MB, máx. 2 archivos) va envuelto en `MultipartAltaInterceptor`, que traduce sus errores: archivo grande o campo de archivo inesperado → 400 `ARCHIVO_NO_VALIDO`; formulario mal formado → 400 `DATOS_INVALIDOS`. El guard corre antes, así que un rol ajeno no llega a subir nada.
- Tiempo límite de 10 s en Storage (`Promise.race`, porque `upload` no acepta `signal`); si la subida termina tarde, se borra. La RPC y las lecturas también tienen 10 s con `abortSignal`.
- Si la RPC falla sin respuesta HTTP (`status` 0 en postgrest-js: tiempo límite o red), el resultado es incierto: responde 503 `BD_NO_DISPONIBLE` y **no** borra los archivos, para no dejar un evento confirmado sin foto; lo deja en el log con las rutas. Cualquier otro fallo tras subir borra lo subido.
- Si el evento se crea pero falla la lectura posterior, responde 503 sin borrar nada.

## Plan Change Log

## Review Triage Log

**Pasada 1 (quick), 2026-10-10:** high 0, medium 1, low 3, false 0, maybe-false 0.

| Hallazgo | Veredicto | Ruta | Evidencia / acción |
|---|---|---|---|
| `eventos.service.ts` `errorDeAlta`: un error sin `code` se trata como resultado incierto y deja los archivos subidos | medium | patch | Verificado en `postgrest-js` 2.117.3: `processResponse` devuelve `{ message: body }` sin `code` en respuestas no OK que no son JSON (401 o 502 del gateway), con `status` real; solo la red o el tiempo límite dan `status: 0`. Acción: considerar incierto solo `status === 0`; el resto borra lo subido. |
| `CODIGOS_EVENTOS` no incluye `BD_NO_DISPONIBLE`, que el módulo devuelve | low | patch | La regla "Always" exige los códigos en `CODIGOS_EVENTOS`; la 1.9 recorrerá ese objeto y no vería el 503. Acción: agregar `BD_NO_DISPONIBLE` con el mismo valor que `CODIGO_BD_NO_DISPONIBLE`. |
| `README.md` dice que los archivos siempre se borran si el alta falla | low | patch | El camino de resultado incierto los conserva a propósito. Acción: mencionar la excepción. |
| `eventos.service.ts`: el color de la paleta se asigna por posición y puede repetir un color elegido | low | patch | Con `[{General}, {VIP, color:"#D97706"}]`, ambas quedan en `#D97706`. Acción: asignar a las categorías sin color el primer color de la paleta que no esté usado en la petición. |

## Design Notes

**Un solo `POST` multipart en lugar de subir primero y crear después.** Así la validación, la subida y el alta van en una sola petición, y el servicio puede limpiar si algo falla. Con dos pasos quedarían archivos huérfanos cada vez que el formulario se abandona. El campo `datos` se valida con `AltaEventoSchema.safeParse(JSON.parse(...))` en el servicio, porque el pipe global solo valida cuerpos JSON.

**RPC en lugar de varios `insert`.** supabase-js no tiene transacciones. Una sede nueva, su sección, el evento y las categorías tienen que existir juntos o no existir. La función es `security definer` y solo la ejecuta `service_role`, así que se respeta AD-1.

**URL de la constancia.** `EventoSchema.constancia_apdayc_url` exige una URL, pero el bucket es privado. Se guarda la URL del objeto (`<SUPABASE_URL>/storage/v1/object/eventos-constancias/<ruta>`), que no se puede abrir sin firma; la 1.10 la firma para el admin.

## Verification

**Commands:**
- `pnpm db:start && pnpm --filter @reto18/api test:int` -- expected: las pruebas de `alta-evento.int.spec.ts` y todas las anteriores en verde.
- `pnpm build && pnpm lint && pnpm test` -- expected: todo en verde.

**Manual checks (if no CLI):**
- En Supabase Studio local, después de las pruebas, los buckets existen y no quedan archivos ni eventos de prueba.
