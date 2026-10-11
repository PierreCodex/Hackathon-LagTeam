---
title: 'Enlaces rastreables y ventas por pieza'
type: 'feature'
ticket: '2'
created: '2026-10-11'
status: 'built'
baseline_revision: 'ac18bc7377dcc86f2e1f01cc9589a3ed359d2641'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-reto18-eventos/architecture-reto18-plataforma-eventos/architecture-reto18-plataforma-eventos.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Las piezas de la 3.1 no tienen enlace rastreable, así que no se sabe cuántos clics ni cuántas ventas trae cada una (CAP-10). Sin eso, la 3.3, la 3.9 y el epic 4 no tienen enlaces ni clics que leer.

**Approach:** Tabla `marketing_enlaces` (código base62 de 8, evento, pieza, red y zona) y `marketing_clics`. Endpoints para crear el enlace de una pieza, registrar un clic y leer los clics y ventas de una pieza. La ruta web `/r/:codigo` registra el clic y redirige al evento con `?ref=:codigo`. Las ventas se leen con `VentasService.ventasPorRef` (AD-8).

## Boundaries & Constraints

**Always:** El código es base62 de 8 caracteres, aleatorio (`crypto`), único en la BD, y se reintenta si choca. La forma del enlace es `<web>/r/:codigo` y redirige a la ficha con `?ref=:codigo` (AD-8). `marketing` lee las ventas solo con `VentasService.ventasPorRef`, que cuenta solo las órdenes pagadas, y lee eventos solo con `EventosService` (AD-2). Las tablas `marketing_*` tienen RLS activo y no dan permisos a `anon` ni a `authenticated` (AD-1). Los clics no guardan datos personales: ni IP ni user-agent. Los errores siguen el formato `{ error: { codigo, mensaje } }`. Los esquemas van en `packages/shared/src/marketing.ts`, y la red se valida con `RedCampanaSchema`, que ya existe. Una falla de la API nunca deja al visitante en una página de error: `/r/:codigo` siempre redirige.

**Decisiones (Luis Armando, 11/10/2026):** `/r/:codigo` redirige a `/eventos/:id?ref=:codigo`. La ficha la entrega la 1.11; hasta entonces la redirección llega a un 404, pero el clic se cuenta igual. El enlace se crea solo con `POST /marketing/piezas/:id/enlaces`: generar una pieza no crea ninguno y el contrato de `Pieza` no cambia. El plan se mantiene entero aunque pase de 1.600 tokens. Las peticiones `HEAD` y las de vista previa de redes y mensajería (user-agent de `facebookexternalhit`, `WhatsApp`, `Twitterbot`, `TelegramBot`, `Slackbot`, `Discordbot`, `LinkedInBot` y similares) reciben el 307 a `/` sin registrar el clic (revisión, 11/10/2026).

**Never:** Generar enlaces por red de forma automática ni textos por red (eso es de la 3.3). La pantalla de resultados por pieza ni el QR del A4 (3.9). Guardar `ref` en la sesión de compra ni enviarlo en el checkout (2.8). Paneles de ventas (epic 4). Escribir en las tablas de `ventas` o `eventos`. Validar `ref` en `ventas`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Crear enlace | El organizador dueño hace `POST /marketing/piezas/:id/enlaces` con `{ red?, zona? }` | 201 `{ codigo, evento_id, pieza_id, red, zona, creado_en }` | — |
| Pieza ajena o inexistente | Otro organizador, o un id desconocido o que no es UUID | 404 `PIEZA_NO_ENCONTRADA` | No revela que la pieza existe |
| Cuerpo inválido | Red fuera de la lista, o zona vacía o de más de 60 caracteres | 400 de validación | — |
| Registrar clic | `POST /marketing/enlaces/:codigo/clics` sin sesión, con un código que existe | 201 `{ codigo, evento_id }` y una fila nueva en `marketing_clics` | — |
| Código desconocido | Formato válido pero no existe, o formato inválido | 404 `ENLACE_NO_ENCONTRADO`, sin escribir nada | — |
| Visitar `/r/:codigo` | Código válido | 307 a `/eventos/:evento_id?ref=:codigo` | — |
| `/r/` pedido por `HEAD` o por un bot de vista previa | Método `HEAD`, o user-agent de vista previa | 307 a `/` sin llamar a la API | — |
| `/r/` con un código malo o la API caída | 404 de la API, `SIN_CONEXION` o formato inválido | 307 a `/` (el catálogo) | Sin pantalla de error |
| Resultados | El organizador dueño hace `GET /marketing/piezas/:id/resultados` | 200 con el total de la pieza y una fila por enlace (clics, órdenes, entradas e importe en céntimos) | 404 si la pieza es ajena |
| Pieza sin enlaces | Pieza recién generada | Totales en 0 y `enlaces: []` | — |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261011010000_marketing.sql` -- patrón de tabla, RLS, `revoke` y `grant` a `service_role`. No se modifica: la tabla nueva va en otra migración.
- `apps/api/src/marketing/marketing.service.ts` -- `cliente()`, `UUID`, `TIEMPO_LIMITE_BD_MS`, `piezaNoEncontrada()` y `bdNoDisponible()` se reutilizan. La propiedad de la pieza se comprueba con `organizador_id` de `marketing_piezas`. Ese campo no está en `COLUMNAS_PIEZA`; para las rutas nuevas se lee aparte.
- `apps/api/src/marketing/marketing.controller.ts` y `marketing.module.ts` -- se añaden las rutas. `VentasModule` se importa (exporta `VentasService` y no depende de `marketing`, así que no hay ciclo). `MarketingService` se exporta para el epic 4.
- `apps/api/src/ventas/ventas.service.ts:241` -- `ventasPorRef(refs)` devuelve una fila por cada `ref` con `ordenes`, `entradas` e `importe_centimos`, y lanza 503 si la BD falla. No se modifica.
- `apps/api/src/ventas/ventas.controller.ts` -- patrón de validación del cuerpo con zod; se copia para `{ red?, zona? }`.
- `packages/shared/src/marketing.ts` -- se reutilizan `RedCampanaSchema` (`:14`) y `CODIGOS_MARKETING` (`:129`), y se añade `ENLACE_NO_ENCONTRADO`. `packages/shared/src/ventas.ts:91` tiene `VentasPorRefSchema`.
- `apps/web/lib/api.ts` -- `pedirApi`, que nunca lanza. Para el clic se usa con `metodo: "POST"` y un tiempo límite corto.
- `apps/web/proxy.ts` y `lib/sesion.ts` -- solo protegen `/organizador` y `/admin`, así que `/r/...` ya es pública. No se tocan.
- `apps/api/test/integracion/compra-acceso.int.spec.ts` -- muestra cómo crear un evento a la venta, una orden con `ref` y pagarla (`QR_SECRET`, `PASARELA_PAGO`). `marketing.int.spec.ts` muestra cómo generar una pieza con Ollama apagado (respaldo).

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261014000000_marketing_enlaces.sql` -- crear `marketing_enlaces` (id, codigo `char(8)` único con un check `^[0-9A-Za-z]{8}$`, evento_id, pieza_id nullable, red nullable con check, zona nullable, organizador_id, creado_en) y `marketing_clics` (id, enlace_id, creado_en), con índices, RLS y `revoke`. `pieza_id` es nullable para las campañas del Weekend (3.7).
- [x] `packages/shared/src/marketing.ts` -- añadir `CrearEnlaceSchema`, `EnlaceSchema`, `ClicRegistradoSchema`, `ResultadosPiezaSchema` (totales y `enlaces[]`) y el código `ENLACE_NO_ENCONTRADO`.
- [x] `apps/api/src/marketing/codigo-enlace.ts` (y su spec) -- `generarCodigo()` en base62 de 8 caracteres con `crypto.randomInt`, y `esCodigoValido()`.
- [x] `apps/api/src/marketing/marketing.service.ts` (y su spec) -- añadir `crearEnlace`, que reintenta 3 veces si el código choca (`23505`); `registrarClic`; y `resultadosPieza`, que une los clics con `ventasPorRef`.
- [x] `apps/api/src/marketing/marketing.controller.ts` y `marketing.module.ts` -- añadir las tres rutas, importar `VentasModule` y exportar `MarketingService`.
- [x] `apps/web/app/r/[codigo]/route.ts` (y su spec) -- `GET`: valida el formato, llama a la API del clic y responde con un 307 a la ficha o a `/`. Usa `dynamic = "force-dynamic"`.
- [x] `apps/api/test/integracion/marketing-enlaces.int.spec.ts` -- recorre los casos de la matriz y el "verify" del ticket: crear el enlace, registrar 1 clic, crear y pagar una orden con ese `ref` y comprobar que la pieza muestra 1 clic y 1 orden.

**Acceptance Criteria:**
- Given una pieza con un enlace, when alguien abre `/r/:codigo` y luego compra y paga una orden con `ref = codigo`, then `GET /marketing/piezas/:id/resultados` muestra 1 clic y 1 orden en esa pieza y en su fila de enlace.
- Given una orden pendiente o vencida con ese `ref`, when se leen los resultados, then no cuenta como venta.
- Given dos enlaces de la misma pieza (por ejemplo, zona "Sullana" y "Castilla"), when cada uno recibe clics, then los resultados los separan por enlace y los suman en el total.

## Design Notes

Atribución al último clic (AD-8): el clic no se une a la orden. La venta se atribuye por el `ref` que llega con la orden, así que los clics y las ventas se cuentan por separado y se juntan por `codigo`. Se responde con 307 en lugar de 301 para que el navegador no guarde la redirección en caché y cada visita vuelva a contar.

## Verification

**Commands:**
- `pnpm build && pnpm lint && pnpm test` -- expected: todo en verde.
- `pnpm test:int` (con Docker y `pnpm db:start`) -- expected: `marketing-enlaces.int.spec.ts` en verde.

