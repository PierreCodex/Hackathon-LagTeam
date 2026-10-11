---
title: 'UI: pintar precios en la pizarra'
type: 'feature'
ticket: '10'
created: '2026-10-11'
status: 'built'
baseline_revision: 'bbdffbf3cf4daec5fc1f506ca22378843eed4549'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/mapa-asientos.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La pizarra (2.9) dibuja la estructura de la sede y la API de precios (2.4) guarda rangos de asientos por categoría, pero no hay pantalla donde el organizador seleccione un rango y le asigne una categoría pintada de su color (CAP-15); además `GET /eventos/:id/precios` no devuelve las categorías del evento (nombre/color/precio), así que no hay de dónde elegir.

**Approach:** Nueva pantalla `organizador/eventos/:id/precios` que reutiliza el patrón visual de la pizarra (secciones→filas→bloques→asientos, numeración continua) en modo solo-lectura de estructura: el organizador selecciona un rango dentro de una fila (clic en el primer asiento, clic en el último) y le asigna una categoría del panel lateral, pintada con su color real (hex); guarda con `PUT /eventos/:id/precios` ya existente. `leerPrecios` se extiende para incluir las categorías del evento (select adicional en TS, sin tocar la RPC ni migraciones).

## Boundaries & Constraints

**Always:** Identificar asientos por `(sección, fila, número)`, igual que la API, nunca por id local. Pintar con `style={{background: categoria.color}}` (hex de BD) — nunca clases `bg-price-*`/`bg-seat-*` (paleta distinta, no tocar `globals.css`). Solo editable sin publicar; 409 `EVENTO_PUBLICADO` deshabilita todo. Reusar `cargarMisEventos`/`tokenDelServidor` (`datos-organizador.ts`) y `pedirApi`.

**Never:** Tocar `pizarra-mapa.ts`/`.tsx` ni `organizador/sedes/**` (2.9, cerrada). Crear/editar categorías (son de 1.4). Migración o RPC nueva: categorías se agregan en `eventos.service.ts` con un `select` extra. Estados de venta (`bg-seat-sold`/`held`) — aquí solo categoría de precio.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pintar rango | Clic fila A asiento 1, luego 6; elegir "VIP" | Rango coloreado; `PUT` guarda `{seccion,fila,desde,hasta,categoria_id}` | — |
| Evento publicado | Se abre pantalla de evento publicado | Solo lectura, sin controles ni Guardar | — |
| Guardar rechazado | `PUT` responde 409 `EVENTO_PUBLICADO` (se publicó entretanto) | Aviso del motivo; pasa a solo lectura | mismo aviso |
| Sin red | `pedirApi` devuelve `SIN_CONEXION` | Aviso con botón "Reintentar" | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/eventos.ts` (`PreciosEventoSchema` ~l.341) -- agregar `categorias: z.array(CategoriaPrecioSchema)` (ya existe, ~l.119).
- `apps/api/src/eventos/eventos.service.ts` (`preciosDe`, ~l.472) -- tras el `rpc("eventos_leer_precios")`, agregar `select(COLUMNAS_CATEGORIA)` sobre `eventos_categorias_precio` por `evento_id` (patrón de la l.600) y fusionar `categorias` antes de `safeParse`.
- `apps/api/src/eventos/eventos.controller.ts` -- doc de `@Get(":id/precios")` (~l.247): mencionar `categorias`.
- `apps/api/test/integracion/precios-rango.int.spec.ts` -- aserciones sobre `categorias`.
- `apps/web/lib/pizarra-mapa.ts` -- solo lectura: reusar `numerosDeFila` y tipos `MapaSede`; no modificar.
- `apps/web/lib/pizarra-precios.ts` (nuevo) -- lógica pura: `resolverCategoriaDeAsiento(asientos, seccion, fila, numero)`, selección en progreso a dos clics → rango, `aRangoEntrada(estado, categoriaId)`, `estadoDeErrorGuardado(error)` (variante de la de `pizarra-mapa.ts`, para `EVENTO_PUBLICADO`/`RANGO_FUERA_DEL_MAPA`/`CATEGORIA_NO_VALIDA`/`SIN_CONEXION`).
- `apps/web/lib/pizarra-precios.spec.ts` (nuevo) -- matriz I/O + rango cruzando de fila (reinicia selección).
- `apps/web/components/pizarra/pizarra-precios.tsx` (nuevo, `"use client"`) -- lienzo de `FilaPizarra` (`pizarra-mapa.tsx` ~l.557-672) adaptado: asiento pinta `style={{background: colorDe(asiento)}}`, clic selecciona; panel de categorías (swatch, nombre, precio); Guardar vía `pedirApi`.
- `apps/web/app/organizador/eventos/[id]/precios/page.tsx` (nuevo) -- server component: `cargarMisEventos()` para `sede_id` (patrón de `eventos/[id]/marketing/page.tsx`), luego `GET sedes/:id/mapa` y `GET :id/precios` con `tokenDelServidor()`; pasa todo a `<PizarraPrecios>`.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/shared/src/eventos.ts` -- `PreciosEventoSchema` gana `categorias` -- contrato
- [ ] `apps/api/src/eventos/eventos.service.ts` -- `preciosDe` fusiona categorías -- dato que la UI necesita
- [ ] `apps/api/test/integracion/precios-rango.int.spec.ts` -- cubre `categorias` en la respuesta -- regresión
- [ ] `apps/web/lib/pizarra-precios.ts` -- selección de rango + resolución de color + mapeo de errores -- núcleo testeable
- [ ] `apps/web/lib/pizarra-precios.spec.ts` -- matriz I/O, selección cruzando de fila, sin categorías -- edge cases
- [ ] `apps/web/components/pizarra/pizarra-precios.tsx` -- grilla + panel de categorías + guardar -- UI
- [ ] `apps/web/app/organizador/eventos/[id]/precios/page.tsx` -- carga server-side y ensamblaje -- pantalla
- [ ] `README.md` -- nota de la pantalla nueva y el campo `categorias` -- traspaso

**Acceptance Criteria:**
- Given un evento aprobado sin publicar en la sede de los croquis, when el organizador selecciona la fila A asientos 1–6 y asigna "VIP", then al releer `GET /eventos/:id/precios` esos asientos tienen `categoria_id` de VIP y la pizarra los pinta de su color.
- Given un evento publicado, when se abre la pantalla, then se ve de solo lectura sin controles de selección.
- Given un clon limpio, when se ejecutan `pnpm build`, `pnpm lint` y `pnpm test` (y `pnpm test:int` con Supabase local), then terminan en verde.

## Implementation Notes

- Implementado por un subagente sin contexto previo, a partir del plan. No pudo correr `pnpm test:int` en su sandbox (Node 20.19.5; el repo exige `>=22.9 <23` para el `WebSocket` nativo que usa `@supabase/realtime-js`); `pnpm build`, `pnpm lint` y `pnpm test` (api 363/363, web 275/275) sí los corrió en verde.
- Verificado por mi cuenta tras recibir el reporte: instalé Node 22.9.0 (`nvm install 22.9.0`) y pnpm 9.15.9 (`corepack enable` falló por una firma desactualizada; `npm install -g pnpm@9.15.9` sí funcionó), levanté Supabase local (`pnpm db:start`) y corrí `pnpm --filter @reto18/api test:int`: 13/13 archivos, 174/174 pruebas en verde, incluidas las aserciones nuevas de `categorias` en `precios-rango.int.spec.ts` contra la BD real. Repetí además `pnpm build` (incluida la ruta nueva `/organizador/eventos/[id]/precios`), `pnpm lint` y `pnpm test` (api 363/363, web 275/275) en Node 22: todo en verde.
- Auditoría de la matriz I/O: las filas "Pintar rango", "Guardar rechazado" y "Sin red" están cubiertas por pruebas puras (`pizarra-precios.spec.ts`) y, la primera, también por la integración real. La fila "Evento publicado" (pantalla se abre de solo lectura) es solo paso de una prop booleana a JSX condicional (`disabled={soloLectura}`, `{!soloLectura && …}`) sin lógica que extraer; el repo no tiene infraestructura de pruebas de interacción/render (`vitest` sin jsdom, mismo límite que en la 2.9), así que queda sin prueba automatizada — verificación manual pendiente (navegador + Supabase local), igual que documentó la 2.9 para sus propias pantallas.
- `agregarRango` (recorte de solapes al repintar un rango ya pintado en la misma sesión) es una función que el implementador agregó más allá de lo nombrado literalmente en el Code Map del plan; está justificada (sin ella, repintar un rango dentro de la misma edición produciría un `PUT` con rangos solapados que la API rechazaría con `DATOS_INVALIDOS`), es lógica pura y tiene sus propias pruebas.

## Plan Change Log

## Review Triage Log

**Pasada 1 (quick), 2026-10-11:** high 0, medium 0, low 2, false 1, maybe-false 0.

| Hallazgo | Veredicto | Ruta | Evidencia / acción |
|---|---|---|---|
| `eventos.service.ts` (`preciosDe`, ~l.479): el `select(COLUMNAS_CATEGORIA)` sobre `eventos_categorias_precio` no lleva `.order(...)`, así que el orden de `categorias` no está garantizado y puede variar entre recargas/guardados | low | patch | Verificado: no hay `.order` en esa línea. El panel de categorías de `pizarra-precios.tsx` las lista en el orden recibido, así que los swatches podrían reordenarse. Arreglo directo de una línea: agregar `.order("nombre")`. |
| `page.tsx` (`cargarPantalla`) llama `cargarMisEventos()` (que ya resuelve el token internamente) y luego llama `tokenDelServidor()` otra vez para las dos llamadas a `pedirApi` | low | rechazado | Verificado: doble lectura del mismo token de sesión. Sin efecto funcional (lectura local de cookie, no red); el arreglo completo exigiría cambiar la firma de `cargarMisEventos` para devolver el token, más que una corrección directa — y es improbable que alguien note el costo extra en uso normal. |
| AC "evento publicado → pantalla de solo lectura" no tiene prueba automatizada de render/interacción | false | rechazado | Por inspección, `soloLectura` desactiva cada botón de asiento (`disabled={soloLectura}`) y oculta el panel de categorías y "Guardar" (`{!soloLectura && …}`): el comportamiento está bien implementado. Solo falta cobertura automatizada, limitación preexistente del repo (vitest sin jsdom, mismo límite documentado en la 2.9), no un defecto de este diff. |

## Design Notes

**Categorías vía segundo select, no RPC nueva.** `eventos_leer_precios` ya resuelve rangos+asientos en SQL; sumarles categorías ahí exigiría migración nueva para un dato de solo lectura que un `select` extra en el servicio ya resuelve (patrón de `leerCreado`).

**Dos clics, no arrastre.** Sin infraestructura de pruebas de interacción (`vitest` sin jsdom, ver `pizarra-mapa.spec.ts`); clic en el primer y último asiento del rango es simple y testeable como lógica pura.

**Color.** `colorDe(seccion, fila, numero)` busca el `categoria_id` del asiento en `asientos: PrecioAsiento[]` y lo mapea a `categorias.find(c => c.id === categoria_id)?.color`; sin categoría, gris neutro (valor hex directo, sin reusar `--color-seat-held` con otro significado).

## Verification

**Commands:**
- `pnpm db:start && pnpm --filter @reto18/api test:int` -- expected: `precios-rango.int.spec.ts` y todas las anteriores en verde.
- `pnpm --filter @reto18/web test` -- expected: `pizarra-precios.spec.ts` y el resto en verde.
- `pnpm build && pnpm lint && pnpm test` -- expected: todo en verde.

**Manual checks (si no hay CLI):**
- Con `pnpm dev` y Supabase local, entrar como organizador, abrir `/organizador/eventos/<id>/precios` de un evento aprobado sin publicar en la sede de los croquis, pintar un rango y comprobar que persiste al recargar.
