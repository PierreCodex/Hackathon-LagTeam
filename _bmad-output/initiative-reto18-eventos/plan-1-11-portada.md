---
title: 'Portada pública con eventos reales y ficha del evento (parte de la 1.11)'
type: 'feature'
ticket: '11'
created: '2026-10-11'
status: 'built'
baseline_revision: '7d19ffe8f9da55775e1e2cc8165ad53923f5941e'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-reto18-eventos/ux-plataforma-eventos/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-reto18-eventos/ux-plataforma-eventos/mockups/escritorio.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La portada (`/`) solo muestra "API ok · BD ok". Un visitante sin cuenta no ve ningún evento, aunque la API (`GET /eventos`, 1.6) ya devuelve los publicados. Además, el menú público muestra "Mis entradas" a quien no tiene sesión, y esa opción es del panel del comprador.

**Approach:** Construir la portada del mockup `mockups/escritorio.html` con los datos reales de la API: buscador con filtros, héroe de destacados con el lateral de Weekend y "Publica tu evento", fila de categorías, filas de eventos con "Ver todos", banda para organizadores y el pie existente. Sumar la ficha `/eventos/[id]` a la que llevan las tarjetas, y quitar "Mis entradas" del menú cuando no hay sesión.

## Boundaries & Constraints

**Always:** Los datos llegan solo de `GET /api/v1/eventos` y `GET /api/v1/eventos/:id`; los esquemas son los de `@reto18/shared` (`ListaEventosPublicosSchema`, `EventoPublicoSchema`), sin datos inventados. Precios como `S/ 25` (IGV incluido) y `Gratis` si cuestan 0. Fechas en hora de Lima. Si un evento no tiene `foto_url`, lleva un degradado según su categoría con tokens existentes (como el mockup). Se usan los componentes de `components/ui` y la paleta de `globals.css`. Funciona a 360 px y a 1440 px, y la página no se desplaza en horizontal (las filas sí, dentro de su carril). Si la API falla, sale un aviso con "Reintentar"; si no hay resultados, un vacío con un solo camino.

**Never:** Cambiar la API, `packages/shared` ni la semilla. Construir la compra (2.8), el calendario mensual (queda en la 1.11) ni la página de Weekend (3.x). Dependencias nuevas. Hacer commit o push sin la validación del equipo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Portada sin filtros | Semilla local: 6 publicados, 1 destacado | El héroe muestra los destacados (si no hay, el próximo evento); "Imperdibles de la semana" y una fila por categoría con eventos | — |
| Filtrar | `/?categoria=musica&distrito=Piura` | Cuadrícula "Resultados" solo con lo que devuelve la API para esos filtros; los selectores conservan su valor | Sin resultados: "No encontramos eventos con esos filtros" + "Ver todos los eventos" |
| Ver todos | "Ver todos" en la fila de Música | Lleva a `/?categoria=musica` | — |
| Fecha | "Este fin de semana" | `desde`/`hasta` = viernes–domingo de esta semana en Lima | — |
| Precio | "Gratis" / "Hasta S/ 20" | `precio_maximo_centimos` = 0 / 2000 | — |
| Ficha | `/eventos/<id publicado>` | Foto o degradado, título, fecha, sede y dirección, descripción y precios por categoría | Id no publicado o inexistente: 404 de Next |
| API caída | `GET /eventos` falla | Aviso "No pudimos cargar los eventos" + Reintentar | — |
| Menú sin sesión | Visitante anónimo | Cabecera y barra: Eventos · Calendario (sin Mis entradas ni Cuenta) + Registrarse/Ingresar | — |
| Menú con sesión de comprador | Rol `publico` con sesión | Eventos · Calendario · Mis entradas · Cuenta, como ahora | — |

</frozen-after-approval>

## Code Map

- `apps/web/app/page.tsx` -- hoy pinta la salud con `PantallaSesion`; pasa a ser la portada (`force-dynamic`, lee `searchParams`). `lib/salud.ts` queda sin uso en la portada; no se borra.
- `apps/web/lib/api.ts` -- `pedirApi(ruta, esquema, { apiUrl })` sirve también en el servidor; `process.env.API_URL` es la base (ver `app/organizador/datos-organizador.ts`).
- `packages/shared/src/eventos.ts` -- `CatalogoPublicoQuerySchema` (q, desde, hasta, categoria, distrito, precio_minimo/maximo_centimos), `EventoPublicoSchema` (sede, categorias, `precio_minimo_centimos`, `destacado`, `foto_url` nullable), `CategoriaEventoSchema`.
- `apps/web/lib/alta-evento.ts:37` -- etiquetas en español de cada categoría: reutilizarlas, sin duplicarlas.
- `apps/web/lib/navegacion.ts` -- `DESTINOS_POR_ROL`, `destinosCabecera`. `components/layout/{pantalla,cabecera,barra-inferior,pantalla-sesion}.tsx`: el visitante anónimo usa hoy el rol `publico` (`rolBarraDeSesion`).
- `apps/web/components/layout/layout.spec.tsx:16` -- prueba de la 1.12 que exige "Mis entradas" para el anónimo: se actualiza por la decisión del usuario.
- `apps/web/components/layout/icono-destino.tsx` -- iconos de trazo inline: mismo estilo para los iconos de categoría.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/lib/navegacion.ts` (+ spec) -- destinos que exigen sesión ("entradas", "cuenta") y un filtro para el visitante anónimo -- única fuente del menú
- [ ] `apps/web/components/layout/{pantalla,cabecera,barra-inferior,pantalla-sesion}.tsx` + `layout.spec.tsx` -- pasar "sin sesión" y filtrar; actualizar la prueba de la 1.12
- [ ] `apps/web/lib/catalogo.ts` (+ spec) -- funciones puras: `searchParams` → query de la API (fecha "hoy/fin de semana/este mes" en Lima, precio por tramos), precio "Desde S/ X"/"Gratis", fecha corta, degradado por categoría, armar filas (semana y por categoría) y héroe
- [ ] `apps/web/app/page.tsx` + `app/portada/*.tsx` -- buscador (formulario GET), héroe con carrusel (cliente), lateral Weekend ("Ver la ruta" → filtro del fin de semana) y "Publica tu evento" (`/registro`), fila de categorías, filas con carril desplazable y "Ver todos", resultados filtrados, banda CTA
- [ ] `apps/web/app/eventos/[id]/page.tsx` -- ficha pública; `notFound()` si la API responde 404

**Acceptance Criteria:**
- Given la semilla local, when un visitante sin sesión abre `/` a 1440 px, then la portada se parece al mockup de escritorio con los 6 eventos reales y sin "Mis entradas" en el menú.
- Given 360 px, when se abre `/`, then todo cabe en una columna y la página no se desplaza en horizontal.
- Given una tarjeta, when se pulsa, then abre su ficha con los datos de la API.

## Implementation Notes

- Implementado directamente en la sesión, sin subagente.
- Menú: `destinosBarra(rol, conSesion)` y `destinosCabecera(rol, conSesion)` en `lib/navegacion.ts`. `PantallaSesion` pasa `conSesion={sesion.tipo !== "anonima"}`. Se actualizó la prueba de la 1.12, que exigía "Mis entradas" para el anónimo.
- `lib/catalogo.ts`: filtros de la URL → consulta de la API, precios, fechas, degradados y filas. `instanteActual()` está aparte porque la regla `react-hooks/purity` no deja llamar a `Date.now()` dentro del componente.
- Filas: "Imperdibles de la semana" (7 días), "Próximos eventos" (todos, sin "Ver todos") y una fila por categoría solo con 2 o más eventos (`MINIMO_FILA_CATEGORIA`). Con 6 eventos de la semilla, las filas de un solo evento quedaban vacías.
- Ficha `/eventos/[id]`: `cache()` para que la página y `generateMetadata` hagan una sola llamada. Un id inválido o `EVENTO_NO_EXISTE` da 404.
- Probado en el navegador (3020, base local): menú anónimo Eventos · Calendario; con el comprador, Eventos · Calendario · Mis entradas. Filtros: música + Piura → 1, gratis → la muestra de arte, sin resultados → vacío. Ficha con 3 precios. El evento pendiente da 404. A 360 px no hay desplazamiento horizontal.

## Plan Change Log

## Review Triage Log

Pasada 1 (2026-10-11): revisión propia, sin un lente independiente. 0 high, 0 medium, 2 low.

| Hallazgo | Veredicto | Ruta | Evidencia |
|---|---|---|---|
| Con 2 o más destacados, en móvil las flechas del héroe (`left-3`) se montan sobre el texto (`px-6`) | low | rechazado | La semilla tiene un solo destacado y entonces no hay flechas; queda para la 1.11 completa. |
| "Calendario" (menú y fila de categorías) da 404 | low | aplazado | El calendario mensual queda fuera de este plan; es el resto de la 1.11. |

## Design Notes

El héroe es "manual" (DESIGN.md): flechas y puntos, sin avance automático. "Calendario" sigue en el menú porque el diseño lo hace público, pero hasta que la 1.11 lo construya da 404. Lo mismo pasa con su atajo en la fila de categorías. El lateral de Weekend no inventa fechas: dice "Este fin de semana en Piura" y filtra por viernes–domingo.

## Verification

**Commands:**
- `pnpm --filter @reto18/web test` -- expected: todo en verde, con las specs nuevas
- `pnpm build && pnpm lint` -- expected: sin errores

**Manual checks (if no CLI):**
- http://localhost:3020/ sin sesión a 1440 y 360 px; filtros combinados; "Ver todos"; ficha; con la sesión de comprador sí aparece "Mis entradas".
