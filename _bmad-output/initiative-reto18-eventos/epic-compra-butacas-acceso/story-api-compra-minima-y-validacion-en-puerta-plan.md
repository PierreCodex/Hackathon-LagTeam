---
title: 'API: compra mínima y validación en puerta'
type: 'feature'
ticket: '1'
created: '2026-10-11'
status: 'built'
baseline_revision: '1c6619abce0a5a36c5db0bcb9c27284669bf05a1'
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

**Problem:** No se puede comprar ni validar una entrada: faltan los módulos `ventas`, `acceso` y `notificaciones`, y el recorrido de la demo (pasos 5 a 7) y los epics 3 y 4 dependen de ellos.

**Approach:** Recorrer en la API la compra de una entrada de **zona general** de un evento aprobado y publicado: orden `pendiente` con cupo reservado → pago simulado tras `PasarelaPago` → orden `pagada` con comisión congelada, entradas con QR firmado y aviso en la bandeja de salida. Añadir "mis entradas" y la validación en puerta de un solo uso.

## Boundaries & Constraints

**Always:**
- AD-5: el cupo se descuenta con un `UPDATE` condicional (`vendidas + n <= capacidad`) dentro de una función SQL; la venta se rechaza si `now() >= inicio`. La orden pendiente reserva el cupo 10 min; una orden vencida devuelve su cupo (vencimiento perezoso, sin cron).
- AD-6: solo `ventas` pasa la orden a `pagada`, en el servidor, cuando `PasarelaPago` confirma. Un pago tras el vencimiento se rechaza y se anula en la pasarela.
- AD-7: QR = `entrada_id.firma`, HMAC-SHA256 con `QR_SECRET`. Validación: `UPDATE … SET usada_en=now() WHERE id=? AND usada_en IS NULL`.
- AD-8: `ventas` guarda `ref` sin validarlo y expone `ventasPorRef(refs)` (solo órdenes pagadas) para los epics 3 y 4.
- AD-9: `notificaciones.encolar()` solo inserta en la bandeja de salida (`pendiente`); si falla, se registra y la compra sigue.
- AD-10: céntimos; al pagar se congelan `comision_modelo`, `comision_valor` y `comision_importe` de `ventas_config_comision`.
- AD-1/AD-2: tablas con prefijo del módulo, RLS activado y sin permisos para `anon`/`authenticated`. `ventas` lee eventos solo por `EventosService`; el teléfono viene del perfil del usuario autenticado.
- Errores con `{ codigo, mensaje }` y esquemas zod en `packages/shared`.
- Decisión (usuario, 11/10/2026): la comisión sembrada es `porcentaje` 5 % (500 puntos básicos).
- Decisión (usuario, 11/10/2026): validan en la puerta el organizador dueño del evento y el administrador; cualquier otro rol recibe 403 y un organizador ajeno, 404 `EVENTO_NO_ENCONTRADO`.
- Decisión (usuario, 11/10/2026): el plan se mantiene entero (~3000 tokens), porque es un solo recorrido de punta a punta.

**Never:**
- Butacas numeradas, bloqueo de asientos ni `ventas_evento_asientos` (2.5 y 2.6). Envío real por Evolution API ni imagen del QR (2.2). Manifiesto ni modo sin conexión (2.7). Edición de la comisión (4.2). UI (2.8).
- Datos reales de tarjeta, Redis ni bloqueos en memoria.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Crear orden | Cuenta con perfil; evento aprobado y publicado; categoría de zona general; `cantidad` 1–10; `ref` opcional | 201: orden `pendiente`, `expira_en` = +10 min, total = precio × cantidad, cupo reservado | — |
| Sin cupo | `vendidas + cantidad > capacidad` o se supera el aforo del evento | 409 `SIN_CUPO`; nada cambia | — |
| Venta cerrada | `now() >= inicio` | 409 `VENTA_CERRADA` | — |
| Evento no vendible | No existe, pendiente, rechazado o sin publicar; categoría de otro evento o sin zona general | 404 `EVENTO_NO_ENCONTRADO` / 400 `CATEGORIA_NO_VALIDA` | — |
| Pagar | Orden propia `pendiente` no vencida; `metodo` ∈ tarjeta, yape, plin | 200: orden `pagada` con comisión congelada, `cantidad` entradas con `qr`, 1 fila `pendiente` en la bandeja | Fallo de la bandeja: se registra y se responde 200 |
| Pago tardío | Orden vencida | 409 `ORDEN_EXPIRADA`; orden `expirada`, cupo devuelto, pasarela anulada | — |
| Pago repetido / ajeno | Orden ya pagada / de otra cuenta | 409 `ORDEN_NO_PENDIENTE` / 404 `ORDEN_NO_ENCONTRADA` | — |
| Mis entradas | Cuenta con perfil | Entradas propias con evento (título, inicio, sede), `qr` y `usada_en` | — |
| Validar QR | Organizador dueño del evento o admin; QR válido de ese evento | 200 `aceptada`; `usada_en` fijado | — |
| Segundo escaneo | Mismo QR | 409 `ENTRADA_YA_USADA` con `usada_en` | — |
| QR falso | Firma mal o formato roto | 400 `QR_INVALIDO` | Comparación de firma en tiempo constante |
| Otro evento | QR válido de otro evento | 409 `ENTRADA_DE_OTRO_EVENTO` | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/marketing/{marketing.module,marketing.controller,marketing.service}.ts` -- patrón a copiar: módulo que importa `EventosModule`, `@Roles`/`@UsuarioActual`, `TIEMPO_LIMITE_BD_MS`, `bdNoDisponible`, excepciones con `{codigo, mensaje}`.
- `apps/api/src/eventos/eventos.service.ts` -- `llamarRpc` traduce errores `P0001` (patrón a reutilizar en `ventas`); añadir `datosParaVenta(eventoId)`. No tocar el resto.
- `apps/api/src/identidad/roles.ts` -- `Roles()` sin argumentos admite cualquier cuenta con perfil; `UsuarioAutenticado.perfil.whatsapp` en E.164.
- `apps/api/src/app.module.ts` -- registrar `VentasModule`, `AccesoModule` y `NotificacionesModule`.
- `supabase/migrations/20261011000000_eventos_alta.sql` -- funciones `security definer` con `set search_path = ''`, errores `P0001` y permisos solo para `service_role`.
- `supabase/seed.sql` -- eventos 3, 4 y 6 de la sede 2 (zona general `13200000-…-0004`, capacidad 120). No se toca.
- `apps/api/test/integracion/mapa-sede.int.spec.ts` + `ayudas/` -- patrón: `crearAppDePrueba`, `tokenPorRol`, `api()`, limpieza en `afterAll` antes de borrar usuarios.
- `packages/shared/src/{marketing,index}.ts` -- patrón de esquemas y `CODIGOS_*`.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261013000000_ventas.sql` -- tablas `ventas_config_comision` (modelo ∈ `porcentaje|fijo_por_entrada|tarifa_evento`, valor, una fila vigente sembrada), `ventas_evento_cupos`, `ventas_ordenes`, `ventas_entradas` y `notificaciones_bandeja`; RPC `ventas_asegurar_cupos`, `ventas_crear_orden`, `ventas_confirmar_pago` y `ventas_expirar_orden` -- atomicidad AD-5, AD-6 y AD-10 en Postgres.
- [x] `packages/shared/src/{ventas,acceso}.ts` + `index.ts` -- esquemas zod (crear orden, pagar, orden, entrada, mis entradas, validar, resultado) y `CODIGOS_VENTAS`/`CODIGOS_ACCESO`.
- [x] `apps/api/src/eventos/eventos.service.ts` -- `datosParaVenta(eventoId)`: estado, publicado, inicio, aforo, organizador, título, sede y categorías con `seccion_id` y la capacidad de su zona general.
- [x] `apps/api/src/notificaciones/{notificaciones.module,notificaciones.service}.ts` -- `encolar({telefono, plantilla, datos, adjunto_url?})`, que inserta `pendiente` y nunca lanza.
- [x] `apps/api/src/ventas/{pasarela-pago,qr,ventas.module,ventas.controller,ventas.service}.ts` -- interfaz `PasarelaPago` con implementación simulada (`cobrar`, `anular`); firma/verificación HMAC; `POST ventas/ordenes`, `POST ventas/ordenes/:id/pagar`, `GET ventas/mis-entradas`; servicio exportado con `ventasPorRef` y `consumirEntrada`.
- [x] `apps/api/src/acceso/{acceso.module,acceso.controller,acceso.service}.ts` -- `POST acceso/eventos/:eventoId/validar`, que comprueba la firma y llama a `ventas.consumirEntrada`.
- [x] `apps/api/src/app.module.ts`, `.env.example` -- registrar los módulos y documentar `QR_SECRET`.
- [x] `apps/api/src/ventas/*.spec.ts`, `apps/api/src/acceso/*.spec.ts` -- unitarias de QR (firma, manipulación, formato), del cálculo de comisión y de la pasarela simulada.
- [x] `apps/api/test/integracion/compra-acceso.int.spec.ts` -- recorre la matriz sobre un evento propio de zona general (alta → aprobar → publicar, aforo pequeño); fija `QR_SECRET` antes de crear la app.

**Acceptance Criteria:**
- Given una orden pagada, when se consulta la BD, then `ventas_ordenes` guarda `ref`, `metodo_pago` y la comisión congelada, y cambiar después `ventas_config_comision` no altera esa orden.
- Given dos órdenes concurrentes que piden el último cupo, when se crean a la vez, then solo una queda pendiente y la otra recibe `SIN_CUPO`.
- Given órdenes pagadas con `ref` "abc12345", when se llama a `ventasPorRef(["abc12345"])`, then devuelve el número de órdenes, entradas e importe de las pagadas, sin las pendientes ni las expiradas.
- Given la suite de integración, when se ejecuta `pnpm test:int`, then se paga una orden simulada, "mis entradas" devuelve el QR firmado, la validación lo acepta y al segundo intento lo rechaza, y la bandeja tiene una fila pendiente.

## Implementation Notes

- `ventas_crear_orden` llama dentro a `ventas_asegurar_cupos` (una sola transacción y un viaje a la BD). `ventas_confirmar_pago` llama a `ventas_expirar_orden`. Las tres RPC bloquean primero los cupos del evento y después la orden, en el mismo orden, para evitar interbloqueos.
- Pago tardío: si la orden sigue `pendiente`, la API cobra y `ventas_confirmar_pago` devuelve `{ resultado: "expirada" }` (sin lanzar error, para que la expiración quede guardada); la API anula el cobro y responde 409. Una orden ya `expirada` o `pagada` se rechaza antes de cobrar. Si la BD no responde tras cobrar, el cobro no se anula y se registra para revisarlo a mano.
- La comisión se calcula en Postgres (`ventas_calcular_comision`); `calcularComision` en TS aplica la misma regla y la integración comprueba que ambas coinciden.
- El QR no se guarda: se firma al servirlo (`FirmaQr`, desde `QR_SECRET`). Sin secreto: 503 `QR_NO_CONFIGURADO`, que se comprueba antes de cobrar.
- `acceso` solo depende de `ventas` (AD-2): pregunta el dueño del evento con `VentasService.organizadorDelEvento`, que usa `datosParaVenta`.
- `ENTRADA_YA_USADA` lleva `usada_en` en `error.detalles`: se añadió `detalles` (opcional) a `ErrorApiSchema` y a `FiltroErrores`.
- `usada_en` se fija con la hora de la API (supabase-js no puede escribir `now()`); la condición `usada_en IS NULL` del mismo UPDATE garantiza el uso único.
- La integración usa un `ref` aleatorio de 8 caracteres en lugar de "abc12345", para no depender de datos que dejen otras ejecuciones.

- Arreglos de la revisión (11/10/2026): `expira_en = least(now() + 10 min, inicio)`, para que el pago se cierre a la hora de inicio (AD-5); un `ref` vacío o de más de 64 caracteres se guarda como nulo y nunca rechaza la orden (AD-8); `COMISION_NO_CONFIGURADA` responde 503 con su código y anula el cobro; prueba de concurrencia con 10 RPC en paralelo. Verificado: build, lint, 405 unitarias y 153 de integración en verde.
- Sin commit: la regla del equipo (AGENTS.md) prevalece sobre el commit local del paso 5 hasta que Jean Pierre confirme la validación.

## Plan Change Log

## Review Triage Log

### Pasada 1 (quick), 11/10/2026: high 0 · medium 3 · low 1 · false 0 · maybe-false 0

| Hallazgo | Veredicto | Ruta | Evidencia |
|---|---|---|---|
| Se puede pagar tras `inicio` (AD-5) | medium | patch | `ventas_confirmar_pago` solo mira `estado` y `expira_en`; una orden creada a `inicio - 5 min` se paga a `inicio + 3 min`. Arreglo: `expira_en = least(now() + 10 min, inicio)`. |
| `ref` inválido bloquea la compra (AD-8) | medium | patch | `CrearOrdenSchema.ref` rechaza vacío o > 64 → 400 en `POST ventas/ordenes`. Arreglo: tratarlo como ausente. |
| `COMISION_NO_CONFIGURADA` sin código propio | low | patch | No está en `ERRORES_RPC` y sale como 500 `ERROR_INTERNO`; arreglo directo (mapear el código). |
| La prueba de concurrencia no solapa transacciones (AC 2) | medium | patch | Dos peticiones HTTP con lecturas previas rara vez coinciden en Postgres. Arreglo: ~10 RPC en paralelo con el cliente admin. |

## Design Notes

- **Dueños de las tablas:** `ventas_entradas` es de `ventas`; para cumplir AD-7 ("solo `acceso` escribe `usada_en`") sin romper AD-2, `ventas` expone `consumirEntrada(entradaId, eventoId)` y solo `AccesoService` lo llama.
- **Inventario general:** `ventas_asegurar_cupos(evento_id, cupos)` es idempotente (`on conflict do nothing`). Recibe las zonas desde `datosParaVenta`, con `capacidad = least(capacidad de la zona, aforo)`. `ventas_crear_orden` primero expira las pendientes vencidas del evento (devuelve su cupo), bloquea los cupos del evento con `for update`, descuenta con un `UPDATE` condicional y comprueba que la suma de vendidas no supera el aforo.
- **Comisión:** `porcentaje` en puntos básicos → `round(total * valor / 10000)`; `fijo_por_entrada` → `valor * cantidad`; `tarifa_evento` → 0 (lo liquida la 4.2).
- **Notificación:** plantilla `entrada_pagada` con `datos = { orden_id, evento, inicio, entradas: [{id, qr}] }` y `adjunto_url` nulo; la 2.2 genera la imagen y envía.

## Verification

**Commands:**
- `pnpm build && pnpm lint && pnpm test` -- expected: todo en verde.
- `pnpm db:start` y luego `pnpm test:int` -- expected: la nueva suite y las existentes pasan.

