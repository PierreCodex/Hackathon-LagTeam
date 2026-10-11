---
story: 1.6
title: API: catálogo público
status: ready-for-dev
risk: low
---

## Objetivo

Servir el catálogo público sin sesión con una proyección segura de eventos que estén
simultáneamente `estado = aprobado` y `publicado = true`. La API debe permitir búsqueda,
filtros combinables, detalle de un evento y consulta de un mes; los destacados se ordenan
antes que el resto.

## Diseño

### Contrato compartido

En `packages/shared/src/eventos.ts` se añadirán los contratos zod para los parámetros de
consulta y la respuesta pública. La consulta aceptará texto (`q`), rango de fechas,
`categoria`, `distrito` y precio máximo en céntimos; el mes se validará como `YYYY-MM`.
La respuesta no reutilizará `EventoSchema`: excluirá `organizador_id`, `motivo_rechazo`,
`constancia_apdayc_url` y cualquier dato administrativo. Incluirá sede resumida,
categorías de precio, foto, `destacado` y `precio_minimo_centimos`.

### API

En `EventosController` se añadirán rutas públicas sin `@Roles`:

- `GET /api/v1/eventos`: lista filtrable y ordenada por `destacado DESC`, `inicio ASC`, `id`.
- `GET /api/v1/eventos/calendario?mes=YYYY-MM`: lista del mes calendario en la zona
  horaria de Lima, con la misma proyección y orden.
- `GET /api/v1/eventos/:id`: ficha pública; un UUID inexistente o no publicado responde
  404 `EVENTO_NO_EXISTE`.

Las rutas estáticas se declararán antes del parámetro `:id` para no interferir con las
rutas administrativas existentes. `StandardSchemaValidationPipe` validará query y params.

### Persistencia

`EventosService` tendrá una proyección SQL explícita con relaciones de sede y categorías.
Todas las consultas aplicarán ambos predicados de visibilidad, evitando filtrar solo por
estado. Los filtros se compondrán en Supabase (`ilike`, `eq`, `gte`, `lt`, `lte`) y el
precio máximo se evaluará contra el mínimo precio de las categorías del evento. Se
mantendrá la semántica existente de `precioMinimo`: las entradas gratuitas solo ganan si
son el único precio; si hay entradas de pago, el precio “desde” es el menor de ellas.

### Pruebas y documentación

Se añadirá una prueba de integración de catálogo sobre la semilla: pendiente y aprobado
sin publicar no aparecen; búsqueda y todos los filtros combinados devuelven solo eventos
visibles y destacados primero; detalle oculta eventos no publicados; la consulta mensual
devuelve exactamente los eventos del mes solicitado. Se documentarán rutas, parámetros y
la regla de visibilidad en `README.md`.

## Archivos previstos

- `packages/shared/src/eventos.ts`
- `apps/api/src/eventos/eventos.controller.ts`
- `apps/api/src/eventos/eventos.service.ts`
- `apps/api/test/integracion/catalogo-publico.int.spec.ts`
- `README.md`

## Verificación

Ejecutar `pnpm build`, `pnpm lint`, `pnpm test` y `pnpm test:int` (API, con Docker y
`pnpm db:start`). No se tocarán secretos ni los archivos locales sin seguimiento.
