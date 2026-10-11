---
title: 'UI: pantalla Marketing y flyer 4:5'
type: 'feature'
ticket: '8'
created: '2026-10-11'
status: 'built'
baseline_revision: '2c1283cec94756f9d4d9968182d74e2eeff5229f'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-reto18-eventos/epic-marketing-ia/story-api-modulo-ia-y-primera-campana-plan.md'
  - '{project-root}/_bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/piezas-marketing.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La API 3.1 ya genera y guarda la pieza de un evento (textos, paleta y campaña), pero el organizador no tiene pantalla para pedirla ni existe el flyer como imagen: sin eso no hay CAP-8 en la demo.

**Approach:** La plantilla 4:5 (1080 × 1350) renderizada a PNG con `next/og` en `apps/web/app/piezas/[pieza]/[formato]/route.tsx` (AD-12), que lee la pieza de `GET /marketing/piezas/:id`. Y la pantalla Marketing del organizador: botón "Generar" (`POST /marketing/eventos/:eventoId/piezas`), el flyer, la campaña (a quién, cuánto por red y cuándo) y un aviso cuando la respuesta viene del respaldo.

## Boundaries & Constraints

**Always:** Fecha, sede, dirección, distrito, precio y foto del flyer salen de `pieza.datos` (de la BD), nunca de los textos de la IA (AD-11). Fecha y hora en hora de Lima. Precio con IGV: "Desde S/ 25"; `0` → "Entrada libre"; `null` → sin precio. Colores del flyer desde `pieza.paleta`; la interfaz sigue `DESIGN.md`. `origen: "respaldo"` muestra un `Aviso` informativo. Los errores de la API (`EVENTO_NO_APROBADO`, `EVENTO_FINALIZADO`, `EVENTO_NO_ENCONTRADO`, `SIN_CONEXION`) van en un `Aviso` con su mensaje. Solo el organizador entra (`GuardaRol`). Contratos de `@reto18/shared` (`PiezaSchema`, `CODIGOS_MARKETING`).

**Decisión (elección del evento):** `/organizador/marketing` lista los eventos del organizador con `GET /eventos/mis-eventos` (1.5, `ListaEventosRevisionSchema`): los aprobados enlazan a `/organizador/eventos/[id]/marketing`; los pendientes o rechazados muestran su estado sin enlace; sin eventos, un estado vacío con "Nuevo evento". El botón Marketing del final del alta (1.9) lleva directo a `/organizador/eventos/[id]/marketing` con el id creado.

**Never:** Formatos 9:16, 16:9 y A4, redes, textos por red, compartir ni resultados por pieza (3.9). Publicar en redes (3.4). Generar imágenes con IA. Cambiar la API. Dependencias nuevas. Commit, push o PR sin el visto bueno del equipo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Genera con IA | Organizador dueño de un evento aprobado y futuro; pulsa "Generar" | Se ven el flyer 4:5 y la campaña: público, reparto en soles por red con su total y calendario con fecha, hora y acción | — |
| Respaldo | La API responde con `origen: "respaldo"` | Igual, más un `Aviso` informativo: la IA no respondió y es una propuesta base con los datos reales | — |
| Evento no aprobado | 409 `EVENTO_NO_APROBADO` (p. ej. recién creado en la 1.9) | `Aviso` con el mensaje de la API; sin flyer | — |
| Evento pasado o ajeno | 409 `EVENTO_FINALIZADO` / 404 `EVENTO_NO_ENCONTRADO` | `Aviso` con el mensaje | — |
| Sin conexión o tiempo límite | `SIN_CONEXION` | `Aviso` con "Reintentar" | — |
| PNG de la pieza | `GET /piezas/<id>/4x5` | `image/png` de 1080 × 1350 con titular, fecha, sede, precio y foto (o fondo de la paleta si no hay foto) | Pieza inexistente → 404; formato distinto de `4x5` → 404 |
| Precios | `precio_minimo_centimos` 2500 / 0 / null | "Desde S/ 25" / "Entrada libre" / sin línea de precio | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/marketing.ts` -- `PiezaSchema` (`textos` titular/subtitulo/llamado/descripcion, `paleta` fondo/texto/acento, `campana` publico/reparto/resumen/presupuesto_total_soles/calendario con `fecha` `YYYY-MM-DD`, `hora` y `accion`, `datos` titulo/inicio/sede/direccion/distrito/precio_minimo_centimos/foto_url, `origen`), `CODIGOS_MARKETING`, `RedCampanaSchema`. Reutilizar; no cambiar.
- `apps/api/src/marketing/marketing.controller.ts` -- `POST /marketing/eventos/:eventoId/piezas` (organizador dueño; 201 con la pieza; puede tardar hasta `IA_TIEMPO_LIMITE_MS`, 30 s por defecto) y `GET /marketing/piezas/:id` (público). No se toca la API.
- `apps/api/src/eventos/eventos.controller.ts` -- `GET /eventos/mis-eventos` (rol organizador) devuelve `EventoRevision[]` (`EventoSchema` + `alerta_apdayc`; `estado` pendiente/aprobado/rechazado, `inicio`, `titulo`, `distrito`), ordenados por `inicio`. Leer con `pedirApi` en el servidor (token de la sesión, como la portada `apps/web/app/organizador/page.tsx`).
- `apps/web/lib/api.ts` -- `pedirApi` con `tiempoLimiteMs`, `cabeceras`. `apps/web/lib/supabase/navegador.ts` -- `tokenDelNavegador()` (1.9): el "Generar" va del navegador directo a la API, como el alta, para no chocar con el límite de duración de las funciones de Vercel.
- `apps/web/app/organizador/eventos/nuevo/formulario-alta.tsx` -- la pantalla de pendiente enlaza a `/organizador/marketing`; `EventoCreadoSchema` trae `evento.id`.
- `apps/web/lib/navegacion.ts` -- Marketing → `/organizador/marketing`.
- `apps/web/components/layout/guarda-rol.tsx`, `components/ui/` -- `GuardaRol`, `Aviso`, `Boton`, `Tarjeta`, `Esqueleto`.
- `apps/web/public/marca/isotipo-blanco.svg` -- marca de agua opcional del flyer.
- `supabase/seed.sql` -- eventos aprobados del "Organizador de demo" (`organizador.eventos@example.invalid`), algunos sin foto.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/lib/pieza.ts` + `pieza.spec.ts` -- puras: `textoPrecio(centimos)`, `fechaPieza(inicio)` ("Vie 16 oct · 8:00 p. m.", Lima), `fechaCalendario("2026-10-14", "19:00")`, `nombreRed(red)`, `urlPng(piezaId, "4x5")`. Pruebas de la tabla de precios y fechas.
- [x] `apps/web/app/piezas/[pieza]/[formato]/route.tsx` -- `GET`: valida `formato === "4x5"`, lee la pieza con `pedirApi` (`PiezaSchema`) y devuelve `ImageResponse` de 1080 × 1350 con la paleta. 404 si no hay pieza o el formato no es 4x5. Caché corta.
- [x] `apps/web/app/organizador/eventos/[id]/marketing/page.tsx` + `panel-marketing.tsx` -- `GuardaRol`; cliente con "Generar" (token del navegador, tiempo límite de 60 s, botón desactivado mientras genera y texto "Generando…"); muestra el flyer (`<img>` del PNG, 4:5, con texto alternativo del titular), los textos, la campaña y el aviso de respaldo; guarda el id de la pieza en `?pieza=` para que al recargar se lea con `GET` en el servidor.
- [x] `apps/web/app/organizador/marketing/page.tsx` -- `GuardaRol` (destino `marketing`); lista de `GET /eventos/mis-eventos` con título, fecha (Lima) y estado; los aprobados enlazan a su pantalla Marketing; vacío → "Nuevo evento"; error → `Aviso`.
- [x] `apps/web/app/organizador/eventos/nuevo/formulario-alta.tsx` -- el enlace Marketing de la pantalla de pendiente apunta a `/organizador/eventos/<id>/marketing`.

**Acceptance Criteria:**
- Given el organizador de demo y un evento aprobado de la semilla, when pulsa "Generar" a 360 px y a 1440 px, then ve el flyer 4:5 y la campaña con la fecha, la sede y el precio exactos del evento.
- Given Ollama apagado, when pulsa "Generar", then ve la propuesta de respaldo con el aviso.
- Given la pieza generada, when recarga la página, then la vuelve a ver sin generar otra.
- Given el organizador de demo, when abre Marketing en el menú, then ve sus eventos y solo los aprobados le dejan entrar a generar.
- Given una cuenta de público, when abre la pantalla, then ve "Esta sección es para organizadores".

## Verification

**Commands:**
- `pnpm build && pnpm lint && pnpm test` -- expected: en verde, con `pieza.spec.ts`.

**Manual checks (if no CLI):**
- Con `pnpm db:start` y la API, entrar como el organizador de demo, generar la pieza de un evento sembrado con y sin `OLLAMA_URL`, y abrir `/piezas/<id>/4x5`.

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---------|---------|-------|----------|
| `route.tsx` `TIPOS_FOTO` excluye WebP: un evento con foto WebP sale sin foto | medium | patch | `TIPOS_FOTO_EVENTO` admite `image/webp` y el `next/og` de Next 16.4 la soporta (`image/webp` en su lista de tipos), así que basta con sumarla. |
| `Flyer4x5`: titular de 90 y subtítulo de 160 caracteres empujan fecha, sede y precio fuera del lienzo | medium | patch | Con foto quedan ~610 px; titular a 72 px (~300 px) + subtítulo (~125 px) + bloque de datos (~270 px) no caben, y nada limita ni recorta el bloque superior. |
| 503 para todo fallo distinto de `PIEZA_NO_ENCONTRADA` | false | reject | El propio revisor confirma que un UUID inválido llega como `PIEZA_NO_ENCONTRADA` (404); los demás casos son fallos de la API y 503 es correcto. |
| `?pieza=` de otro evento: `rutaActual` conserva el id descartado | low | patch | `ContenidoMarketing` arma `rutaActual` con el `piezaId` crudo aunque `cargarPieza` lo descarte; arreglo directo con `pieza?.id`. |
| "Reintentar" tras el tiempo límite de 60 s puede crear una segunda pieza | low | reject | La API corta la IA a 30 s y responde con respaldo, así que el aborto a 60 s es raro; una pieza de más no rompe nada y evitarlo pide lógica nueva. |
| Eventos aprobados ya pasados siguen enlazando a "Preparar campaña" | low | reject | La decisión congelada enlaza por estado `aprobado`; al generar la API responde `EVENTO_FINALIZADO` con su aviso. |
| Sin prueba del nuevo enlace de `formulario-alta.tsx` | false | reject | El revisor confirma que el enlace y las comprobaciones de `creado` son correctos; no hay defecto. |
| `route.spec.tsx` pinta `ImageResponse` en Node: estabilidad sin confirmar | false | reject | `pnpm test` corrió en verde con ese archivo (web 110 pruebas, 10 archivos). |
