---
title: 'Pizarra del mapa como sala de teatro (rehacer la vista de la 2.9)'
type: 'feature'
ticket: ''
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
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La pizarra de la 2.9 funciona, pero es un formulario: cada fila es una tarjeta con campo, "+ asiento", "Quitar pasillo" y "Quitar fila" por bloque, sobre fondo claro. 643 butacas ocupan varias pantallas y no se ve la sala. Eso contradice DESIGN.md (pizarra sobre `surface-inverse`, a todo el ancho) y la imagen de referencia (`insumos/WhatsApp Image 2026-10-10 at 3.57.46 PM (1).jpeg`), y no sirve de base para pintar precios (2.10).

**Approach:** Rehacer solo la vista (`components/pizarra/pizarra-mapa.tsx`) como un lienzo oscuro tipo sala: ESCENARIO arriba, cada sección en una tarjeta con su nombre, filas centradas con la letra a la izquierda, butacas compactas y el pasillo como un hueco. Se edita sobre el mapa mismo. La lógica, el guardado y el duplicado se reutilizan tal cual.

## Boundaries & Constraints

**Always:** Reutilizar las operaciones de `lib/pizarra-mapa.ts` y sus mínimos (tocar una butaca la quita, salvo la última del bloque; no se puede quitar la última fila de una sección ni el último bloque de una fila). "Datos de la sede", los avisos (guardado, error, sin sesión, duplicar, zonas generales) y el botón Guardar se comportan igual que ahora. Cada control conserva su nombre accesible (`aria-label`), y los nombres de sección y fila conservan los ids `idCampoSeccionNombre`/`idCampoFilaNombre`, para que el error y el foco sigan llegando a su campo. Solo tokens existentes (`surface-inverse`, `surface-inverse-raised`, `border-inverse`, `ink-on-inverse*`, `seat-*`) y la clase `superficie-inversa` para el foco. El lienzo se desplaza en horizontal dentro de sí mismo y la página no hace scroll horizontal a 360 px.

**Never:** Cambiar la API, `packages/shared`, `lib/api.ts` ni las páginas `sedes/nueva` y `sedes/[id]/mapa`. Pintar precios (2.10). Un editor libre (arrastrar, curvas). Ni dependencias ni tokens de color nuevos. Hacer commit o push sin la validación del equipo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ver sala sembrada | Teatro de 643 butacas | ESCENARIO arriba, 3 tarjetas, filas A–W centradas con pasillo visible, contador "643 butacas" | — |
| Quitar butaca | Tocar la butaca 5 de la fila A | Desaparece; la fila se renumera continua | Última butaca del bloque: deshabilitada |
| Añadir butaca | "+" al final de un bloque | Butaca nueva al final del bloque, numerada | Tope `asientosPorFila`: "+" deshabilitado |
| Pasillo | "+ pasillo" en la fila / tocar un hueco de pasillo | Bloque nuevo vacío con su "+" / el bloque de la derecha del hueco desaparece | Fila con un solo bloque: sin hueco que quitar |
| Fila vacía nueva | "Agregar fila" | Fila con su letra editable y un "+" | Validación al guardar, como ahora |
| Error en un nombre | La API señala `secciones.0.filas.2.nombre` | El mensaje aparece junto a esa letra y recibe el foco | — |
| Pizarra vacía | `sedes/nueva` | Lienzo con ESCENARIO y "Agregar sección" | — |

</frozen-after-approval>

## Code Map

- `apps/web/components/pizarra/pizarra-mapa.tsx` -- se reescribe la parte visual (JSX de secciones y de `FilaPizarra`). Se conservan sin cambiar `guardar`, `alDuplicar`, `limpiarErrores`, el cálculo de `camposConError` y `avisoGenerico`, y los avisos.
- `apps/web/lib/pizarra-mapa.ts` -- solo se lee: `crearSeccion/quitarSeccion`, `crearFila/quitarFila`, `agregarBloque/quitarBloque`, `agregarAsiento/quitarAsiento`, `numerosDeFila`, `idCampo*`. Los bloques nuevos llegan vacíos (`asientos: []`).
- `apps/web/components/ui/` -- `Aviso`, `Boton`, `Campo`, `Tarjeta`. `Campo` es de 48 px y fondo claro: dentro del lienzo, los nombres usan un `<input>` propio y compacto.
- `apps/web/app/globals.css` -- tokens `--color-surface-inverse*`, `--color-seat-*` y `.superficie-inversa :focus-visible`.
- `apps/web/vitest.config.ts` -- las pruebas de componentes son `components/**/*.spec.tsx`, pintadas con `react-dom/server`.
- `ux-plataforma-eventos/mockups/mapa-y-compra.html` -- referencia de cómo se ven las butacas, la letra de fila y el pasillo.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/components/pizarra/pizarra-mapa.tsx` -- lienzo `bg-surface-inverse superficie-inversa` a todo el ancho con `overflow-x-auto`; cabecera con contador de butacas y un control de tamaño (− / +, tres pasos de butaca: 28, 36 y 48 px); ESCENARIO; secciones en `surface-inverse-raised` con el nombre en un input centrado y "Quitar sección"; filas con la letra en un input a la izquierda, bloques separados por un hueco de pasillo (botón "Quitar pasillo N"), butacas como botones "Quitar asiento N", "+" punteado al final de cada bloque, y "+ pasillo" y "Quitar fila" compactos a la derecha; "Agregar fila" al pie de cada sección y "Agregar sección" al pie del lienzo -- la vista que pide el diseño
- [ ] `apps/web/components/pizarra/pizarra-mapa.spec.tsx` -- pintar con un `MapaSede` de 2 filas y 2 bloques: hay ESCENARIO, el contador, un botón "Quitar asiento N" por butaca, "Quitar pasillo", los ids de los nombres y el lienzo `superficie-inversa` -- protege la estructura

**Acceptance Criteria:**
- Given el teatro sembrado, when el organizador abre su mapa a 1280 px, then al menos las 8 filas de Platea baja caben en una pantalla con su forma de sala.
- Given cualquier pizarra, when se guarda, duplica o falla, then el comportamiento es idéntico al de antes del cambio (mismo cuerpo de la petición y mismos avisos).
- Given una pantalla de 360 px, when se abre el teatro, then solo el lienzo se desplaza en horizontal, no la página.

## Implementation Notes

- Implementado directamente en la sesión (sin subagente), por decisión acordada con el usuario.
- `pizarra-mapa.tsx`: solo cambia el JSX del lienzo y `FilaPizarra`. Se añaden `BotonLienzo` y `NombreEnLienzo` (input compacto con los mismos ids `idCampo*` y el error asociado; en las filas, el error flota para no mover la fila). Control de tamaño con `TAMANOS_BUTACA = [28, 36, 48]` mediante la variable CSS `--butaca`. El lienzo abre centrado (`scrollLeft`) y se recentra al cambiar el tamaño. `guardar`, `alDuplicar` y los avisos no cambian.
- El hueco del pasillo quita el bloque de su derecha y sus butacas: es la misma semántica de `quitarBloque` que tenía "Quitar pasillo". `lib/pizarra-mapa.ts` no cambia.
- Probado en el navegador (3010, base local): 643 butacas; quitar A5 → 642; "+" → 643; "+ pasillo" y 2 butacas → 645; renombrar "AA"; guardar y recargar conserva todo. Nombre de fila vacío: error junto a la fila y con el foco. A 360 px la página no se desplaza en horizontal y el lienzo abre centrado. Platea baja entera cabe a 1280 px; el Mezanine (37 butacas por fila) se desplaza dentro del lienzo.
- Conocido y no tocado: el mensaje de nombre vacío sale en inglés de zod ("Too small…"). Ya está en `deferred-work.md` (2.9).
- Ampliación pedida por el usuario (2026-10-11): en Mis eventos, cada tarjeta lleva un botón a la pizarra de la sede del evento (`accionButacas` en `lib/revision.ts`): "Armar butacas" si está pendiente o aprobado sin publicar, "Ver butacas" si está publicado y ningún botón si está rechazado. Cierra el hueco que la 1.10 y la 2.9 se dejaban la una a la otra. Se actualizó la prueba de la 1.10 que exigía "sin enlace", porque la decisión cambió. Probado en el navegador: el botón lleva a `/organizador/sedes/<sede_id>/mapa`.

## Plan Change Log

## Review Triage Log

Pasada 1 (2026-10-11): revisión propia del diff, sin el lente `quick` en un subagente independiente (el usuario pidió verlo rápido; queda pendiente si el equipo la quiere). 0 high, 0 medium, 2 low, 1 false.

| Hallazgo | Veredicto | Ruta | Evidencia |
|---|---|---|---|
| Al quitar una butaca con el teclado, el foco se pierde (el botón desaparece) | low | rechazado | La pizarra anterior hacía lo mismo, y el arreglo (mover el foco a la vecina) añade lógica nueva; poco frecuente con teclado. |
| Doble línea bajo la cabecera del lienzo (`border-b` + `border-y` del escenario) | low | rechazado | Solo estética, es aceptable. |
| El ancho del pasillo ignora `desplazamiento` | false | — | La vista anterior también lo ignoraba; la API solo exige que exista y `aMapaEntrada` lo conserva tal cual. |

## Design Notes

El tamaño compacto (28–36 px) contradice el mínimo táctil de 48 px de DESIGN.md. Se resuelve con el control de tamaño: el paso grande da 48 px. DESIGN.md ya prevé "ampliar dentro de su lienzo". Las butacas usan `seat-held` (gris), igual que ahora, porque los colores de precio llegan en la 2.10.

## Verification

**Commands:**
- `pnpm --filter @reto18/web test` -- expected: todo en verde, incluida la nueva spec
- `pnpm build && pnpm lint` -- expected: sin errores

**Manual checks (if no CLI):**
- http://localhost:3010/organizador/sedes/<copia>/mapa: quitar y añadir butacas, añadir y quitar pasillos, renombrar, guardar y recargar; captura a 1280 px y a 360 px.
