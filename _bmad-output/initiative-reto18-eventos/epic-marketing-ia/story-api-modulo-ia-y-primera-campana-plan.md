---
title: 'API: módulo ia y primera campaña'
type: 'feature'
ticket: '1'
created: '2026-10-10'
status: 'draft'
baseline_revision: '22da709d6aa823598cee9906772ba05647af925d'
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
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

**Never:** Redes, texto por red ni enlaces rastreables (3.2, 3.3). Plantillas o PNG (3.8). `alertaApdayc`, `weekend` ni `leerCroquis`, ni el adaptador de Claude (epic 5). Escribir tablas de `eventos`. Generar imágenes con IA. Claves en el repo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Genera con IA | Organizador dueño, evento aprobado, Ollama responde JSON válido | 201 con la pieza guardada: `origen: "ia"`, textos, paleta, campaña (público, presupuesto en soles por red, calendario) y `datos` del evento (título, inicio, sede, dirección, distrito, precio mínimo en céntimos, foto) | No error expected |
| Ollama apagado o lento | Sin `OLLAMA_URL`, conexión rechazada o más del tiempo límite | 201 con `origen: "respaldo"`: textos y campaña de plantilla con los datos reales del evento | Log de aviso de una línea; nunca 5xx |
| Respuesta inválida de la IA | JSON roto o que no cumple el esquema | Igual que respaldo | Log de aviso |
| Leer la pieza | `GET /marketing/piezas/:id` sin sesión | 200 con la pieza (la usará la plantilla de la 3.8) | 404 `PIEZA_NO_ENCONTRADA` |
| Evento ajeno o inexistente | Organizador que no es dueño, o id desconocido | 404 `EVENTO_NO_ENCONTRADO` | No revela que el evento existe |
| Evento no aprobado | Estado `pendiente` o `rechazado` | 409 `EVENTO_NO_APROBADO` *(pendiente de la pregunta 2)* | — |
| Rol equivocado / sin sesión | `publico` o `admin`; sin token | 403 `SIN_PERMISO` / 401 | Guard existente |
| Evento gratuito | Todas las categorías a 0 | `precio_minimo_centimos: 0` y los textos dicen "Entrada libre" | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/app.module.ts` -- registrar `IaModule`, `EventosModule` (si aplica) y `MarketingModule`.
- `apps/api/src/identidad/identidad.service.ts` -- patrón: `@Inject(SUPABASE_CLIENTE)` explícito, `abortSignal(AbortSignal.timeout(...))`, cliente `null` → 503 `CODIGO_BD_NO_DISPONIBLE`.
- `apps/api/src/identidad/roles.ts` -- reutilizar `@Roles("organizador")` y `@UsuarioActual()`; las rutas sin `@Roles` son públicas.
- `apps/api/src/filtro-errores.ts` -- ya respeta el `codigo` propio de la excepción; no tocar.
- `packages/shared/src/eventos.ts` -- `EventoSchema`, `CategoriaPrecioSchema` como referencia de campos; no modificar.
- `supabase/migrations/20261010020000_eventos.sql` -- columnas de `eventos_eventos`, `eventos_sedes`, `eventos_categorias_precio`; patrón de RLS/revoke a copiar.
- `supabase/seed.sql` -- evento sembrado `13600000-…-000000000001` (aprobado, 16/10 20:00, sede 1, precios 4000/5000/6000 → mínimo 4000) del organizador `13000000-…-000000000001`, que no tiene perfil: la prueba inserta su perfil o crea su propio evento.
- `apps/api/test/integracion/ayudas/{app,http,tokens,supabase}.ts` -- `crearAppDePrueba`, `api(app, token)`, `tokenPorRol`, `clienteAdminDePrueba`.
- No hay módulo `eventos` en la API todavía (lo crea la 1.4 de Jean Pierre). zod está solo en `packages/shared`; `z.toJSONSchema` (zod 4.6.5) sirve para el `format` de Ollama.
- En esta máquina no hay Docker: `pnpm test:int` debe correrse donde haya Supabase local.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261010030000_marketing.sql` -- crear `marketing_piezas` (id, evento_id → eventos_eventos, organizador_id, origen, textos jsonb, paleta jsonb, campana jsonb, creado_en) con RLS y revoke -- persistir cada generación (una fila por generación; la 3.2 cuelga enlaces de ella).
- [ ] `packages/shared/src/marketing.ts` + `index.ts` -- `TextosYCampanaSchema` (titular, subtitulo, llamado, descripcion; paleta de 3 colores hex; campaña: publico, presupuesto_total_soles, reparto por red, calendario de fechas/horas) y `PiezaSchema` (con `datos` del evento y `origen`).
- [ ] `apps/api/src/ia/adaptador-ollama.ts` -- `POST {OLLAMA_URL}/api/chat` con `stream:false`, `format` = JSON Schema de la salida, `AbortSignal.timeout(IA_TIEMPO_LIMITE_MS, por defecto 30000)`; devuelve el JSON o lanza.
- [ ] `apps/api/src/ia/funciones/textos-y-campana.ts` -- prompt en español sencillo con los datos del evento; valida con zod; ante cualquier error, respaldo determinista con esos datos.
- [ ] `apps/api/src/ia/ia.module.ts` + `ia.service.ts` -- exportar `IaService.textosYCampana()`.
- [ ] `apps/api/src/eventos/…` -- lectura de los datos de pieza de un evento *(según la pregunta 1)*.
- [ ] `apps/api/src/marketing/{marketing.module,marketing.controller,marketing.service}.ts` -- `POST /marketing/eventos/:eventoId/piezas` (organizador) y `GET /marketing/piezas/:id` (público).
- [ ] `.env.example` -- `OLLAMA_URL`, `OLLAMA_MODELO`, `IA_TIEMPO_LIMITE_MS` con comentarios.
- [ ] `apps/api/src/ia/*.spec.ts` -- unitarias con `fetch` simulado: éxito, tiempo límite, JSON inválido, sin URL → respaldo; el respaldo contiene fecha, sede y precio.
- [ ] `apps/api/test/integracion/marketing.int.spec.ts` -- con un Ollama falso (servidor HTTP local) y con Ollama apagado, sobre un evento sembrado; casos de la matriz.

**Acceptance Criteria:**
- Given un evento sembrado y un Ollama falso que responde, when el organizador dueño llama al endpoint, then la pieza devuelta y guardada tiene `origen: "ia"`, y `datos` coincide con la fecha, la sede y el precio mínimo de la BD.
- Given Ollama apagado, when se llama al mismo endpoint, then responde 201 con `origen: "respaldo"` en menos del tiempo límite más 1 s.
- Given una pieza guardada, when la web pide `GET /marketing/piezas/:id` sin sesión, then recibe la misma pieza.

## Open Questions

1. **Cómo lee `marketing` los datos del evento** (no hay módulo `eventos` en la API; la 1.4 de Jean Pierre lo creará).
   - **a) Crear ahora un `EventosModule` mínimo** con `EventosService.datosParaPieza(eventoId)` de solo lectura (recomendado): cumple AD-2, y la 1.4 lo amplía. Hay que avisar a Jean Pierre para no chocar en `eventos/eventos.module.ts`.
   - **b) Leer las tablas `eventos_*` desde `marketing`** temporalmente: más rápido, pero rompe AD-2 y queda deuda.
   - **c) Esperar a la 1.4**: bloquea la 3.1.
2. **¿Solo eventos aprobados?**
   - **a) Solo `aprobado`** (recomendado): lo dice el "Done when" 1 del epic; un pendiente devuelve 409.
   - **b) Cualquier estado del organizador**: permite preparar la campaña antes de que el admin apruebe.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

El respaldo no es un error: es un resultado válido que la 3.8 muestra con un aviso. Por eso la función de `ia` devuelve `{ origen, valor }` y nunca lanza por el proveedor. Ejemplo de respaldo de campaña: *"Invierte 50 soles: 30 en Instagram y 20 en Facebook para público de Piura de 18 a 45 años. Publica 5 días antes, 2 días antes y el mismo día a las 19:00."* Las fechas del calendario se calculan desde `inicio` en `America/Lima`.

## Verification

**Commands:**
- `pnpm build && pnpm lint && pnpm test` -- expected: todo en verde.
- `pnpm test:int` (con Docker y `pnpm db:start`) -- expected: `marketing.int.spec.ts` en verde.
