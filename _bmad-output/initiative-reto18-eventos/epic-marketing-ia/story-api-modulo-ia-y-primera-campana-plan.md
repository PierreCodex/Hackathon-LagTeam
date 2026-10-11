---
title: 'API: módulo ia y primera campaña'
type: 'feature'
ticket: '1'
created: '2026-10-10'
status: 'built'
baseline_revision: '17757e7b743d6185e025491f10f5b31538c4cd72'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-reto18-eventos/architecture-reto18-plataforma-eventos/architecture-reto18-plataforma-eventos.md'
  - '{project-root}/_bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/piezas-marketing.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No existe el módulo `ia` ni el módulo `marketing`. Sin ellos, la pantalla Marketing (3.8), los textos por red (3.3), la alerta de APDAYC (3.6) y el croquis (epic 5) no tienen dónde apoyarse, y la demo no puede generar la campaña de un evento en vivo (CAP-8).

**Approach:** Módulo `ia` con un adaptador único de Ollama (tiempo límite, salida validada con zod, respaldo) y la función `textosYCampaña`. Módulo `marketing` con la tabla `marketing_piezas` y un endpoint del organizador que genera y guarda la pieza de su evento. La IA solo aporta textos, paleta y campaña; fecha, sede y precio salen del evento (AD-11).

## Boundaries & Constraints

**Always:** Solo `ia` llama a Ollama (`OLLAMA_URL`, `OLLAMA_MODELO`); cada función tiene entrada y salida zod, tiempo límite y respaldo determinista, y nunca lanza por un fallo del proveedor. La respuesta indica `origen: "ia" | "respaldo"`. Fecha, sede, dirección y precio de la pieza salen siempre de la BD, nunca del texto de la IA. Esquemas compartidos en `packages/shared/src/marketing.ts`. Tablas con prefijo `marketing_`, RLS activo y sin permisos para `anon` ni `authenticated` (AD-1). Importes en céntimos (AD-10). Errores `{ error: { codigo, mensaje } }`. `marketing` lee eventos solo a través de un servicio de `eventos` (AD-2). Cada función de IA en `ia/funciones/<nombre>.ts`.

**Decisiones (Luis Armando, 10/10/2026):** solo se generan piezas de eventos `aprobado` ("Done when" 1 del epic); `marketing` lee el evento con un método nuevo de `EventosService` (de la 1.4); el plan se mantiene entero aunque pase de 1.600 tokens.

**Never:** Redes, texto por red ni enlaces rastreables (3.2, 3.3). Plantillas o PNG (3.8). `alertaApdayc`, `weekend` ni `leerCroquis`, ni el adaptador de Claude (epic 5). Escribir tablas de `eventos`. Generar imágenes con IA. Claves en el repo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Genera con IA | Organizador dueño, evento aprobado, Ollama responde JSON válido | 201 con la pieza guardada: `origen: "ia"`, textos, paleta, campaña (público, presupuesto en soles por red, calendario) y `datos` del evento (título, inicio, sede, dirección, distrito, precio mínimo en céntimos, foto) | No error expected |
| Ollama apagado o lento | Sin `OLLAMA_URL`, conexión rechazada o más del tiempo límite | 201 con `origen: "respaldo"`: textos y campaña de plantilla con los datos reales del evento | Log de aviso de una línea; nunca 5xx |
| Respuesta inválida de la IA | JSON roto o que no cumple el esquema | Igual que respaldo | Log de aviso |
| Leer la pieza | `GET /marketing/piezas/:id` sin sesión | 200 con la pieza (la usará la plantilla de la 3.8) | 404 `PIEZA_NO_ENCONTRADA` |
| Evento ajeno o inexistente | Organizador que no es dueño, o id desconocido | 404 `EVENTO_NO_ENCONTRADO` | No revela que el evento existe |
| Evento no aprobado | Estado `pendiente` o `rechazado` | 409 `EVENTO_NO_APROBADO` | — |
| Rol equivocado / sin sesión | `publico` o `admin`; sin token | 403 `SIN_PERMISO` / 401 | Guard existente |
| Evento gratuito | Todas las categorías a 0 | `precio_minimo_centimos: 0` y los textos dicen "Entrada libre" | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/app.module.ts` -- registrar `IaModule` y `MarketingModule` (`EventosModule` ya está, de la 1.4).
- `apps/api/src/eventos/eventos.service.ts` -- de la 1.4: `EventosService` (exportado por `EventosModule`), `COLUMNAS_EVENTO`, `COLUMNAS_CATEGORIA`, `TIEMPO_LIMITE_BD_MS`, `cliente()` privado. Añadir aquí el método de lectura; no tocar `crear` ni `listarSedes`.
- `apps/api/src/identidad/identidad.service.ts` -- patrón: `@Inject(SUPABASE_CLIENTE)` explícito, `abortSignal(AbortSignal.timeout(...))`, cliente `null` → 503 `CODIGO_BD_NO_DISPONIBLE`.
- `apps/api/src/identidad/roles.ts` -- reutilizar `@Roles("organizador")` y `@UsuarioActual()`; las rutas sin `@Roles` son públicas.
- `apps/api/src/filtro-errores.ts` -- ya respeta el `codigo` propio de la excepción; no tocar.
- `packages/shared/src/eventos.ts` -- `EventoSchema`, `CategoriaPrecioSchema` como referencia de campos; no modificar.
- `supabase/migrations/20261010020000_eventos.sql` -- columnas de `eventos_eventos`, `eventos_sedes`, `eventos_categorias_precio`; patrón de RLS/revoke a copiar.
- `supabase/seed.sql` -- evento sembrado `13600000-…-000000000001` (aprobado, 16/10 20:00, sede 1, precios 4000/5000/6000 → mínimo 4000) del organizador `13000000-…-000000000001`, que no tiene perfil: la prueba inserta su perfil o crea su propio evento.
- `apps/api/test/integracion/ayudas/{app,http,tokens,supabase}.ts` -- `crearAppDePrueba`, `api(app, token)`, `tokenPorRol`, `clienteAdminDePrueba`.
- zod está solo en `packages/shared`; `z.toJSONSchema` (zod 4.6.5) sirve para el `format` de Ollama.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261011010000_marketing.sql` -- crear `marketing_piezas` (id, evento_id → eventos_eventos, organizador_id, origen, textos jsonb, paleta jsonb, campana jsonb, creado_en) con RLS y revoke -- persistir cada generación (una fila por generación; la 3.2 cuelga enlaces de ella).
- [x] `packages/shared/src/marketing.ts` + `index.ts` -- `TextosYCampanaSchema` (titular, subtitulo, llamado, descripcion; paleta de 3 colores hex; campaña: publico, presupuesto_total_soles, reparto por red, calendario de fechas/horas) y `PiezaSchema` (con `datos` del evento y `origen`).
- [x] `apps/api/src/ia/adaptador-ollama.ts` -- `POST {OLLAMA_URL}/api/chat` con `stream:false`, `format` = JSON Schema de la salida, `AbortSignal.timeout(IA_TIEMPO_LIMITE_MS, por defecto 30000)`; devuelve el JSON o lanza.
- [x] `apps/api/src/ia/funciones/textos-y-campana.ts` -- prompt en español sencillo con los datos del evento; valida con zod; ante cualquier error, respaldo determinista con esos datos.
- [x] `apps/api/src/ia/ia.module.ts` + `ia.service.ts` -- exportar `IaService.textosYCampana()`.
- [x] `apps/api/src/eventos/eventos.service.ts` (+ spec) -- `datosParaPieza(eventoId)`: evento con su sede (nombre, dirección) y el precio mínimo de sus categorías; `null` si no existe -- `marketing` lee eventos solo por aquí (AD-2).
- [x] `apps/api/src/marketing/{marketing.module,marketing.controller,marketing.service}.ts` -- `POST /marketing/eventos/:eventoId/piezas` (organizador) y `GET /marketing/piezas/:id` (público).
- [x] `.env.example` -- `OLLAMA_URL`, `OLLAMA_MODELO`, `IA_TIEMPO_LIMITE_MS` con comentarios.
- [x] `apps/api/src/ia/*.spec.ts` -- unitarias con `fetch` simulado: éxito, tiempo límite, JSON inválido, sin URL → respaldo; el respaldo contiene fecha, sede y precio.
- [x] `apps/api/test/integracion/marketing.int.spec.ts` -- con un Ollama falso (servidor HTTP local) y con Ollama apagado, sobre un evento sembrado; casos de la matriz.

**Acceptance Criteria:**
- Given un evento sembrado y un Ollama falso que responde, when el organizador dueño llama al endpoint, then la pieza devuelta y guardada tiene `origen: "ia"`, y `datos` coincide con la fecha, la sede y el precio mínimo de la BD.
- Given Ollama apagado, when se llama al mismo endpoint, then responde 201 con `origen: "respaldo"` en menos del tiempo límite más 1 s.
- Given una pieza guardada, when la web pide `GET /marketing/piezas/:id` sin sesión, then recibe la misma pieza.

## Implementation Notes

- El modelo no devuelve fechas: `RespuestaIaTextosYCampanaSchema` pide `dias_antes` + `hora` por publicación, y la API calcula `fecha` desde `inicio` en America/Lima (quita las pasadas y deja al menos el mismo día). El `presupuesto_total_soles` es la suma del reparto, también calculada. `TextosYCampanaSchema` es la salida ya completada.
- La campaña lleva además `resumen` (la campaña "explicada a un amigo", spec de piezas). La paleta es `{ fondo, texto, acento }`.
- `datos` no se guarda en `marketing_piezas`: se lee del evento con `EventosService.datosParaPieza` al generar y al servir (`GET`), así siempre sale de la BD. Si el evento ya no existe, `GET` da 404 `PIEZA_NO_ENCONTRADA`.
- zod no está en `apps/api`: el JSON Schema del `format` se exporta desde `@reto18/shared` (`JSON_SCHEMA_RESPUESTA_IA_TEXTOS_Y_CAMPANA`).
- Evento gratuito con IA: si ningún texto dice "Entrada libre", el `llamado` pasa a "Entrada libre".
- Ids que no son UUID → 404 (no 400), igual que un id desconocido.
- `AdaptadorOllama` lee `OLLAMA_URL`, `OLLAMA_MODELO` e `IA_TIEMPO_LIMITE_MS` en cada llamada; sin URL o sin modelo lanza y la función usa el respaldo.
- Revisión completa, 2.ª pasada (aprobada por Luis Armando): (1) `completar` cae al respaldo si los textos traen precio u hora, o si un evento de pago dice "entrada libre"/"gratis"/"gratuit…"; en gratuitos fuerza `llamado = "Entrada libre"` si el llamado no lo dice; (2) respaldo si el reparto no suma entre 30 y 150 soles o alguna red tiene 0; (3) respaldo sin categorías: `llamado` "No te lo pierdas"; (4) `GET /marketing/piezas/:id` da 404 `PIEZA_NO_ENCONTRADA` si el evento ya no está aprobado; (5) `POST` da 409 `EVENTO_FINALIZADO` si `inicio <= ahora`, antes de la IA; (6) `OLLAMA_URL` sin `/api` final e `IA_TIEMPO_LIMITE_MS` solo entero entre 1 y 2147483647; (7) `marketing.service.spec.ts` con las tres rutas 503 `BD_NO_DISPONIBLE`.

## Plan Change Log

## Review Triage Log

### Pasada 1 (quick) — high 0 · medium 1 · low 2 · false 1 · maybe-false 1

| # | Hallazgo | Veredicto | Ruta | Evidencia |
|---|---|---|---|---|
| 1 | Evento con una categoría a 0 y otras de pago se anuncia como «Entrada libre» | medium | patch | `datosParaPieza` usa `Math.min` de todos los precios; la matriz define gratuito como «todas las categorías a 0». Arreglo: mínimo de las de pago, 0 solo si todas valen 0. |
| 2 | `horaMismoDia` deja la publicación del mismo día después del inicio en eventos antes de las 10:00 | low | rechazado | Real, pero los eventos culturales antes de las 10:00 son raros y el arreglo añade ramas. |
| 3 | `calendarioDesde` conserva horas ya pasadas de hoy y la entrada de reserva puede caer en un día pasado | low | rechazado | Real solo al generar el mismo día del evento o tras su inicio; poco frecuente y el arreglo añade comparaciones de hora. |
| 4 | Presupuesto de la IA sin límites en el esquema; el `resumen` del modelo puede no coincidir con el total calculado | maybe-false | defer | Depende de que el modelo real devuelva cifras incoherentes o fuera de rango; se resuelve probando con el modelo de Ollama elegido. Sería medium. |
| 5 | La prueba de éxito de `IaService` depende del reloj | false | rechazado | Solo comprueba la petición a `/api/chat` y `origen: "ia"`, que siguen siendo ciertos después del 16/10 aunque el calendario use la entrada de reserva. |

## Design Notes

El respaldo no es un error: es un resultado válido que la 3.8 muestra con un aviso. Por eso la función de `ia` devuelve `{ origen, valor }` y nunca lanza por el proveedor. Ejemplo de respaldo de campaña: *"Invierte 50 soles: 30 en Instagram y 20 en Facebook para público de Piura de 18 a 45 años. Publica 5 días antes, 2 días antes y el mismo día a las 19:00."* Las fechas del calendario se calculan desde `inicio` en `America/Lima`.

## Verification

**Commands:**
- `pnpm build && pnpm lint && pnpm test` -- expected: todo en verde.
- `pnpm test:int` (con Docker y `pnpm db:start`) -- expected: `marketing.int.spec.ts` en verde.
