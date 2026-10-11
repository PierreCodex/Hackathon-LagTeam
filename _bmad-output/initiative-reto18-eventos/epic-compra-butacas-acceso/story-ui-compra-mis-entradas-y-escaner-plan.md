---
title: 'UI: compra, Mis entradas y escáner'
type: 'feature'
ticket: '8'
created: '2026-10-11'
status: 'built'
baseline_revision: 'efea9bc5e7d0598c5c1d89eba99a6a92fbb75ddb'
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

**Problem:** La API de compra y acceso (historia 2.1) ya existe, pero no hay ninguna pantalla para comprar una entrada de zona general, verla con su QR, o validarla en la puerta; sin esto no hay recorrido de punta a punta (CAP-5, CAP-6, CAP-7).

**Approach:** Tres pantallas sobre la API ya construida: `/eventos/:id/comprar` (checkout con pago simulado, WhatsApp prellenado del perfil y el `?ref=` de la URL), `/mis-entradas` (lista de entradas propias con su QR) y `/puerta/:eventoId/escanear` (cámara del móvil, en línea, que valida contra la API). Se agregan dos librerías nuevas: una para generar el QR visualmente y otra para leerlo con la cámara.

## Boundaries & Constraints

**Always:** Comprar exige sesión (el teléfono sale del perfil autenticado, AD-1 de la 2.1); sin sesión, redirige a `/ingresar?siguiente=<ruta>` (reusar `rutaIngresar`/`destinoTrasIngreso`). "Mis entradas" acepta cualquier cuenta autenticada (público, organizador o admin); el escáner solo organizador o admin -- ninguna de las dos es un rol exacto de `RolApi`, así que se agrega una guarda nueva que acepta una lista de roles (o ninguno) junto a `guardaDeRol`/`GuardaRol`, sin modificarlos. El escáner usa sesión de organizador/admin, igual que decidió la 2.1 para validar en la puerta -- no se crea un rol `puerta` nuevo. Reusar `pedirApi`, `tokenDelNavegador`, los componentes de `components/ui` y los tokens de `globals.css`.

**Never:** Modo sin conexión ni manifiesto local (2.7/2.12). Butacas numeradas, precios por rango o elegir asiento (2.4/2.5/2.6/2.10/2.11). Edición de la comisión (4.2). Envío real por WhatsApp (2.2): el QR solo se muestra en pantalla. No tocar `packages/shared/src/{ventas,acceso}.ts`, `lib/api.ts`, ni los exports existentes de `lib/sesion.ts`/`guarda-rol.tsx`. No construir el catálogo público ni la ficha de evento completa (1.11) ni `/r/:codigo` (3.2): el checkout y el escáner se llegan por URL directa por ahora; el checkout solo lee `GET eventos/:id` (la ficha pública, ya construida en la 1.6) para sus datos y categorías, y `?ref=` de su propia URL si llega.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Comprar sin sesión | Visitante sin cuenta abre `/eventos/:id/comprar` y pulsa Comprar | Redirige a `/ingresar?siguiente=/eventos/:id/comprar`; tras ingresar, vuelve ahí | — |
| Comprar con pago simulado | Cuenta con perfil; categoría de zona general; cantidad 1–10; método tarjeta/yape/plin | `POST ventas/ordenes` y `POST .../pagar` en el mismo flujo; navega a "Mis entradas" con la orden pagada | — |
| Pago falla tras crear la orden | `pagar` devuelve `PAGO_RECHAZADO` u otro código | Aviso con "Reintentar" que reintenta `pagar` sobre la misma orden (no crea una nueva) | se agota a los 10 min (AD-5), sin acción nuestra |
| Sin cupo / venta cerrada / categoría no válida | `SIN_CUPO`, `VENTA_CERRADA` o `CATEGORIA_NO_VALIDA` al crear la orden | Aviso con el mensaje de la API; no se reintenta solo | — |
| Mis entradas, cuenta sin compras | `GET ventas/mis-entradas` devuelve `[]` | Estado vacío con enlace a comprar | — |
| Escanear código válido del evento | Organizador dueño o admin; QR de una entrada de ese evento, sin usar | `POST acceso/eventos/:eventoId/validar` → 200 `aceptada`; aviso de éxito y sigue escaneando | — |
| Escanear dos veces | Mismo QR ya usado | 409 `ENTRADA_YA_USADA` con la hora de uso | — |
| Escanear código de otro evento o roto | `ENTRADA_DE_OTRO_EVENTO` / `QR_INVALIDO` | Aviso con el motivo; sigue escaneando | — |
| Sin permiso de cámara | El navegador niega `getUserMedia` | Aviso explicando cómo habilitarla, sin reintentar solo | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/{ventas,acceso}.ts` -- NO tocar; ya exponen `CrearOrdenSchema` (`evento_id`, `categoria_id`, `cantidad`, `ref?`), `PagarOrdenSchema` (`metodo`), `OrdenPagadaSchema` (`{orden, entradas}`), `MiEntradaSchema`/`MisEntradasSchema`, `ValidarEntradaSchema` (`{qr}`), `ResultadoValidacionSchema`, `CODIGOS_VENTAS`, `CODIGOS_ACCESO`.
- `packages/shared/src/eventos.ts:127-134` -- `EventoPublicoSchema` (de `GET eventos/:id`, ya pública) trae `categorias: CategoriaPrecio[]` (`id`, `nombre`, `color`, `precio_centimos`); suficiente para el selector del checkout. No distingue zona general de sección numerada: si se elige una no vendible, la API responde `CATEGORIA_NO_VALIDA` (mostrarlo tal cual, sin filtrar localmente).
- `apps/web/lib/sesion.ts:108` (`guardaDeRol`) -- agregar al lado `guardaDeCuenta(sesion, roles?: RolApi[])`: sin sesión → `ingresar`; con sesión y (`roles` vacío/ausente o `perfil.rol` incluido) → `permitido`; si no, `sin-permiso`. Mismo tipo `Guarda` que ya existe.
- `apps/web/components/layout/guarda-rol.tsx` -- agregar `apps/web/components/layout/guarda-cuenta.tsx` con la misma forma que `GuardaRol` pero usando `guardaDeCuenta`; reusar `PantallaSesion`, `rutaIngresar`. No modificar `guarda-rol.tsx`.
- `apps/web/lib/navegacion.ts` -- ya reserva `/mis-entradas` (público) y `/puerta/escanear` (rol `puerta`, que no existe en `RolApi`); el escáner va en `/puerta/:eventoId/escanear` en vez del fijo previsto -- no se cambia `navegacion.ts` en esta historia (ver Design Notes).
- `apps/web/app/organizador/eventos/nuevo/page.tsx`, `apps/web/app/admin/panel-aprobacion.tsx`, `apps/web/components/pizarra/pizarra-mapa.tsx` -- patrón a replicar: server component que carga datos públicos/con sesión y pasa props a un `"use client"`; `pedirApi` + `tokenDelNavegador()` + `Authorization: Bearer` desde el cliente.
- `apps/web/app/eventos/[id]/comprar/page.tsx` (nuevo) -- server component: `GET eventos/:id` (sin auth, patrón `leerPublico`), lee `?ref=` de `searchParams`, pasa el `EventoPublico`, el `ref` y (si hay sesión) el `whatsapp` del perfil al cliente.
- `apps/web/components/compra/formulario-compra.tsx` (nuevo, `"use client"`) -- `Selector` de categoría y cantidad, `Selector`/radios de método de pago, `Campo` de WhatsApp (prellenado, editable); al enviar: sin token → `router.push(rutaIngresar(ruta))`; con token → `POST ventas/ordenes` (esquema `OrdenSchema`) y, si crea, `POST ventas/ordenes/:id/pagar` (esquema `OrdenPagadaSchema`) guardando el `id` de la orden para reintentar solo el pago si falla; éxito → navega a `/mis-entradas`.
- `apps/web/app/mis-entradas/page.tsx` (nuevo) -- usa `GuardaCuenta` (sin `roles`, cualquier cuenta); `GET ventas/mis-entradas` (esquema `MisEntradasSchema`) con el token; estado vacío con `BotonEnlace` si no hay entradas.
- `apps/web/components/entradas/qr-entrada.tsx` (nuevo) -- genera el QR de `entrada.qr` con la librería nueva (ver más abajo) y lo pinta como imagen; usado por `/mis-entradas` y puede usarlo el flyer de la 3.8 a futuro si lo necesita (no se toca esa historia).
- `apps/web/app/puerta/[eventoId]/escanear/page.tsx` (nuevo) -- usa `GuardaCuenta` con `roles: ["organizador", "admin"]`.
- `apps/web/components/puerta/escaner.tsx` (nuevo, `"use client"`) -- cámara con la librería nueva de lectura; por cada código decodificado, `POST acceso/eventos/:eventoId/validar` (esquema `ResultadoValidacionSchema`) con el token; pinta el resultado y sigue escaneando (sin detenerse en el primer error, salvo sin permiso de cámara).
- `apps/web/package.json` -- añadir `qrcode` (generar el QR en "Mis entradas", p. ej. `QRCode.toDataURL`) y `@zxing/browser` (cámara + lectura continua del escáner, `BrowserQRCodeReader`); son las dos únicas librerías nuevas, ninguna otra parte del repo las usa hoy.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/package.json` -- agregar `qrcode` y `@zxing/browser` -- generación y lectura de QR, inexistentes hoy
- [ ] `apps/web/lib/sesion.ts` -- `guardaDeCuenta(sesion, roles?)` -- guarda reusable para "cualquier cuenta" y "organizador|admin"
- [ ] `apps/web/components/layout/guarda-cuenta.tsx` -- versión de `GuardaRol` con lista de roles -- envoltorio de pantalla
- [ ] `apps/web/app/eventos/[id]/comprar/page.tsx` + `apps/web/components/compra/formulario-compra.tsx` -- checkout con pago simulado y WhatsApp prellenado -- flujo de compra
- [ ] `apps/web/app/mis-entradas/page.tsx` + `apps/web/components/entradas/qr-entrada.tsx` -- lista de entradas propias con su QR -- flujo de ver entradas
- [ ] `apps/web/app/puerta/[eventoId]/escanear/page.tsx` + `apps/web/components/puerta/escaner.tsx` -- escáner de la puerta con la cámara -- flujo de validación
- [ ] `apps/web/lib/sesion.spec.ts` -- pruebas de `guardaDeCuenta` (sin sesión, rol permitido, rol fuera de la lista, sin lista) -- matriz I/O
- [ ] `apps/web/components/puerta/escaner.spec.ts` (si la lógica de decisión se separa de la cámara) o pruebas del mapeo de errores de `acceso`/`ventas` a los avisos de cada pantalla -- matriz I/O

**Acceptance Criteria:**
- Given una cuenta con perfil, when compra una entrada de zona general con pago simulado, then "Mis entradas" muestra esa entrada con su QR.
- Given el pago falla tras crear la orden, when se pulsa "Reintentar", then se reintenta el pago sobre la misma orden, no se crea una segunda.
- Given un QR válido de un evento propio, when se escanea por primera vez, then se acepta; when se escanea una segunda vez, then se rechaza con la hora de uso.
- Given un clon limpio, when se ejecutan `pnpm build`, `pnpm lint` y `pnpm test`, then terminan en verde.

## Implementation Notes

- Implementado por un subagente sin contexto previo, a partir del plan. `pnpm --filter @reto18/shared build` hizo falta una vez (el `dist/` del paquete compartido estaba viejo/faltante, lo que rompía incluso pruebas preexistentes antes de reconstruirlo) -- sin relación con esta historia.
- El campo WhatsApp del checkout queda prellenado y editable, pero no se envía a ningún lado: `CrearOrdenSchema`/`PagarOrdenSchema` (congelados) no tienen ese campo -- `pagar` usa el del perfil autenticado en el servidor. Se deja con una ayuda que lo explica, en vez de inventar un envío que no pide el esquema.
- La ruta del test del escáner se movió de `components/puerta/escaner.spec.ts` (como decía el Code Map) a `lib/escaner.ts`/`escaner.spec.ts`: `vitest.config.ts` solo incluye `components/**/*.spec.tsx`, no `.spec.ts` -- un archivo ahí nunca se habría ejecutado. Coherente con el patrón ya usado por `lib/pizarra-mapa.ts`/`lib/revision.ts` (lógica pura separada de la cámara/React).
- El checkout es visible sin sesión (la ficha y el formulario se pintan igual); solo enviar sin token redirige a `/ingresar` y vuelve. Es la única pantalla de esta historia sin guarda de página -- a diferencia de "Mis entradas" y el escáner, que sí la tienen.
- Verificado por mi cuenta (no solo el reporte del subagente): leí el diff completo y corrí `pnpm build`, `pnpm lint` y `pnpm test` (web 214/214, api 322/322) en verde.
- Pendiente (fuera de esta sesión): verificación manual con cámara real y Supabase local (comprar en un móvil, ver el QR, escanearlo en otro) -- no disponible en este entorno.

## Plan Change Log

## Review Triage Log

Pasada 1 (`quick`). Veredictos: high 0 · medium 0 · low 1 (rechazado) · false 7 · maybe-false 0. Sin `intent_gap`, `bad_plan`, `patch` ni `defer`; sin loopback.

- `apps/web/lib/escaner.ts:24-34` — false — La lente sugiere que `ENTRADA_YA_USADA` podría mostrar el mensaje de la API en vez de la hora. Refutado: la línea 30 usa `fechaPieza(usada_en)` siempre que `detalles.usada_en` sea string (AD-7 lo garantiza), así el CA "rechaza con la hora de uso" se cumple; el fallback a `error.mensaje` solo aplica si el campo faltara.
- `apps/web/components/compra/formulario-compra.tsx:89-94,131-139` — false — El WhatsApp no se envía a la API por diseño: `CrearOrdenSchema`/`PagarOrdenSchema` no tienen ese campo y el servidor usa el del perfil autenticado. Ya documentado en Implementation Notes y con ayuda visible. Sin mal resultado.
- `apps/web/components/puerta/escaner.tsx:45-96,121-133` — false — El escáner no reintenta solo tras negar la cámara; la matriz I/O pide exactamente "sin reintentar solo" y el `Aviso` ofrece "Reintentar" manual (línea 126). Coincide con la intención.
- `apps/web/lib/sesion.ts:123-130` — false — `rolRequerido: roles[0]!` solo se evalúa cuando `roles.length > 0` (línea 126), nunca con lista vacía; `GuardaCuenta` arma el texto desde la lista completa (`guarda-cuenta.tsx:24-26,51`). Sin defecto funcional.
- `apps/web/app/mis-entradas/page.tsx:23-28,38-52` — false — La ausencia de token produce un `Aviso` con "Reintentar", no un fallo silencioso. Manejo correcto.
- `apps/web/lib/escaner.ts:36-43` — false — La ventana de 3000 ms suprime reenviar el mismo cuadro a propósito; `debeProcesarCodigo` vuelve a procesar el mismo texto pasado el lapso (cubierto en `escaner.spec.ts`). Diseño intencional.
- `apps/web/components/entradas/qr-entrada.tsx:28-36` — low (rechazado) — Si `QRCode.toDataURL` rechaza, el componente devuelve `null` sin mensaje. Solo alcanzable si la generación falla para un `entrada.qr` no vacío y válido por esquema; improbable en uso normal y el arreglo añade UI de error (más que una corrección directa). Rechazado por la regla de `low`.
- `apps/web/components/compra/formulario-compra.tsx:47-61` — false — `pagar` fija `setFase("idle")` en la línea 55 antes de comprobar `ok`, así que el formulario no queda en "pagando" al tener éxito; la navegación simplemente desmonta el componente. Sin mal resultado.

## Design Notes

**Entrada por URL directa, otra vez.** No hay catálogo ni ficha completa (1.11) de donde colgar "Comprar", ni enlace de "Mis eventos" al escáner todavía: se llega por URL directa (`/eventos/:id/comprar`, `/puerta/:eventoId/escanear`), igual que la pizarra de la 2.9. `/mis-entradas` sí puede entrar al menú del público en `lib/navegacion.ts` sin tocarlo, porque ya está reservada ahí.

**Por qué una guarda nueva y no `GuardaRol`.** `guardaDeRol` exige igualdad exacta de rol; "Mis entradas" es para cualquier cuenta y el escáner para dos roles. En vez de forzar `GuardaRol` con una lista, se agrega `guardaDeCuenta`/`GuardaCuenta` al lado, con la misma forma (`Guarda`, `PantallaSesion`), para no arriesgar el uso ya probado de `GuardaRol` en organizador/admin.

**Por qué el escáner no crea un rol `puerta`.** La 2.1 ya decidió que validan el organizador dueño del evento (403 si es de otro) o el administrador; `RolApi` no tiene (ni necesita) un rol `puerta` nuevo para esto. `lib/navegacion.ts` prevé `/puerta/escanear` para un rol que no existe: se deja como está (no se borra esa previsión, tampoco se usa en esta historia) y el escáner vive en una ruta propia por evento.

**Checkout en dos llamadas, un solo flujo.** `crear orden` y `pagar` son dos endpoints distintos (AD-5/AD-6 de la 2.1); el checkout los encadena en un solo clic para que la demo sea de un paso, pero guarda el `id` de la orden creada para que "Reintentar" repita solo el pago -- nunca una segunda orden (que gastaría cupo de más).

**QR: generar vs. leer son librerías distintas.** `qrcode` solo dibuja; `@zxing/browser` solo lee con la cámara. Ninguna sirve para lo del otro, y ninguna existe hoy en `apps/web/package.json`.

## Verification

**Commands:**
- `pnpm build && pnpm lint && pnpm test` -- expected: todo en verde (nuevas rutas incluidas).

**Manual checks (si no hay CLI):**
- Con `pnpm dev`, Supabase local y un evento sembrado de zona general: comprar desde un móvil, ver el QR en "Mis entradas", y que el escáner de otro móvil lo acepte la primera vez y lo rechace la segunda.
