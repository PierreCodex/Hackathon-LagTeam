---
title: 'API: aprobación y destacado'
type: 'feature'
ticket: '5'
created: '2026-10-10'
status: 'done'
baseline_revision: '94d916d721b49a070865c6ca4a933208463131f3'
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

**Problem:** El administrador todavía no puede revisar eventos ni decidir su aprobación. El organizador necesita conocer el motivo del rechazo.

**Approach:** Extender la API de eventos con revisión administrativa, acceso temporal a la constancia privada y listado propio del organizador. Exponer `alerta_apdayc`, normalmente `null`, y sembrar un pendiente con alerta para la UI 1.10.

**Decisión del usuario (2026-10-10):** Aprobar y rechazar solo eventos `pendiente`; las decisiones anteriores no se cambian. Destacar y quitar destacado solo en `aprobado`. Aprobar limpia el motivo; rechazar guarda el motivo y deja destacado en false. Un estado incompatible devuelve 409.

## Boundaries & Constraints

**Always:** Administración exclusiva de `admin`; listado propio exclusivo de `organizador`, filtrado por el usuario del token. Contratos zod compartidos y errores `{error:{codigo,mensaje}}`. Actualizaciones condicionadas por estado para evitar decisiones concurrentes contradictorias. Constancias privadas, firma temporal autorizada y sin persistir la firma. Migración nueva, respetando AD-1 a AD-3.

**Never:** Pantallas, IA real, publicación, catálogo y modificaciones del mapa quedan fuera. No cambiar documentos de otras historias ni hacer commit, push o PR antes de la validación del equipo.

## I/O & Edge-Case Matrix

| Escenario | Entrada | Resultado | Error |
|---|---|---|---|
| Pendientes | Admin autenticado | Lista solo pendientes con datos de revisión, constancia almacenada y alerta nullable | — |
| Constancia | Admin, evento con archivo | URL firmada durante 5 minutos; sin archivo devuelve `url: null` | 503 si Storage falla |
| Rechazo | Motivo recortado de 1–600 caracteres | Estado y motivo guardados juntos | 400 si vacío o inválido |
| Mis eventos | Organizador autenticado | Solo sus eventos, con estado y motivo | — |
| Concurrencia | Dos decisiones incompatibles sobre un pendiente | Una gana; la otra no sobrescribe | 409 |
| Identificador | UUID inválido o inexistente | Sin modificación | 400 / 404 |
| Permisos | Sin sesión o rol ajeno | Sin lectura privada ni modificación | 401 / 403 |
| Dependencia caída | BD o Storage indisponible | Error con código estable y tiempo límite | 503 |

</frozen-after-approval>

## Code Map

- `apps/api/src/eventos/eventos.controller.ts`, `eventos.service.ts`: alta y sedes existentes; reutilizar `COLUMNAS_EVENTO`, inyección explícita y límite de BD de 10 segundos.
- `apps/api/src/eventos/archivos-eventos.ts`: reutilizar cliente de servicio y `conTiempoLimite`; URL privada incluye bucket y propietario.
- `apps/api/src/identidad/roles.ts`: `@Roles`, `@UsuarioActual`; `configurar-app.ts` instala validación zod global.
- `packages/shared/src/eventos.ts`: extender contratos de revisión sin romper `EventoSchema` ni el alta.
- `supabase/migrations/20261010020000_eventos.sql`: ya existen estado, motivo y destacado; falta alerta.
- `apps/api/test/integracion/ayudas/`: app real, HTTP, tokens y cliente local. Borrar eventos antes de usuarios por la FK.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261012000000_eventos_aprobacion.sql`: añadir `alerta_apdayc text` nullable, conservando permisos.
- [ ] `packages/shared/src/eventos.ts`: contratos de UUID, rechazo, destacado booleano, evento de revisión, listas y URL firmada; códigos de inexistencia y conflicto.
- [ ] `apps/api/src/eventos/eventos.controller.ts`, `eventos.service.ts`: `GET /eventos/pendientes`, `GET /eventos/mis-eventos`, `GET /eventos/:id/constancia`; `PATCH /eventos/:id/aprobar`, `/rechazar` y `/destacado`. Acciones devuelven evento actualizado. Orden estable en listas; filtros de autorización en servidor; aplicar las transiciones acordadas.
- [ ] `apps/api/src/eventos/archivos-eventos.ts`: firmar exclusivamente rutas del bucket de constancias y del propietario del evento; rechazar URL ajena o ruta inválida.
- [ ] `supabase/seed.sql`: alerta en el pendiente `13600000-0000-4000-8000-000000000007`, con descripción que mencione DJ; mantener ocho eventos y sus categorías.
- [ ] `apps/api/src/eventos/aprobacion.spec.ts`, `archivos-eventos.spec.ts`: matriz, validación, fallos de dependencias y firma de rutas.
- [ ] `apps/api/test/integracion/aprobacion-evento.int.spec.ts`, `semilla-eventos.int.spec.ts`: persistencia, roles en cada ruta, aislamiento entre organizadores, concurrencia, constancia privada/firmada y alerta sembrada.
- [ ] `README.md`: documentar rutas, cuerpos, errores, firma y migración para la UI 1.10.

**Acceptance Criteria:**
- Given un evento pendiente, when el admin lo aprueba, then la API y la BD muestran `aprobado` sin motivo de rechazo.
- Given un rechazo válido, when su organizador consulta sus eventos, then lee el motivo exacto y otro organizador no recibe ese evento.
- Given un evento habilitado para destacar, when el admin activa y desactiva destacado, then cada valor persiste.
- Given tokens de los tres roles, when llaman a cada ruta administrativa, then solo admin accede.
- Given una constancia privada, when se solicita el enlace autorizado, then abre el archivo y la URL sin firma sigue protegida.

## Implementation Notes

## Plan Change Log

## Review Triage Log

**Pasada 1 (quick), 2026-10-11:** high 0, medium 0, low 0, false 0, maybe-false 0.

La revisión independiente no encontró hallazgos. Verificó build, lint y las pruebas unitarias específicas de la API.

## Verification

- `pnpm build`, `pnpm lint`, `pnpm test`: todo en verde.
- `pnpm db:start` y `pnpm test:int`: integración con Supabase local y migración aplicada. No resetear datos locales existentes sin autorización; registrar cualquier impedimento de Docker.

**Resultados 2026-10-11:** `pnpm build` y `pnpm lint` en verde; `pnpm test` en verde (194 pruebas API y 57 web); `pnpm test:int` en verde (101 pruebas en 7 archivos); `git diff --check` en verde. La migración se aplicó directamente en la BD local porque el historial contenía la migración 2.3, ausente en esta rama. La semilla se reejecutó y confirmó ocho eventos y una alerta; no se hizo reset ni borrado.
