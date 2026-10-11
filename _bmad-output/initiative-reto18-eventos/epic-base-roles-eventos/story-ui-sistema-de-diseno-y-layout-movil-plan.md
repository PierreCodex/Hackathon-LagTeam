---
title: 'UI: sistema de diseño y layout móvil'
type: 'feature'
ticket: '7'
created: '2026-10-10'
status: 'done'
baseline_revision: '3dad1db473afa6b5870fe66dac2dd64a158a5b6a'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-reto18-eventos/ux-plataforma-eventos/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-reto18-eventos/ux-plataforma-eventos/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ninguna pantalla "UI:" puede empezar: `apps/web` no tiene paleta, tipografía, componentes base, layout móvil ni un cliente HTTP común, y su CSS actual (gris claro/oscuro del esqueleto) no sigue el DESIGN.md.

**Approach:** Llevar los tokens del DESIGN.md (colores, tipografía Inter, radios, espaciado) a `apps/web`, crear los componentes base (botones, campo, tarjeta, chip, aviso, esqueleto de carga), el layout móvil (cabecera con la marca del Club y barra inferior por rol) y un cliente HTTP que traduce el formato de error de la API. Una página `/muestra` enseña todo a 360 px.

## Boundaries & Constraints

**Always:** Tokens con los valores exactos del DESIGN.md, tema oscuro único (sin modo claro). Inter 400/500/700/800/900. Móvil primero a 360 px sin scroll horizontal; a partir de 768 px, contenido centrado a 480 px. Objetivos táctiles de 48 px, foco visible en blanco, etiquetas visibles en los campos y error asociado al campo (`aria-describedby`). Estados con texto o símbolo, no solo color. Sin sombras ni degradados. Barra inferior con los destinos por rol de EXPERIENCE.md (público, organizador, administrador, puerta), sin menú hamburguesa; recibe el rol como dato, porque la sesión llega con la 1.8. Cliente HTTP: `API_URL` + `/api/v1/…`, tiempo límite, nunca lanza; devuelve el dato validado con zod o un error `{ codigo, mensaje }` con `ErrorApiSchema` de `@reto18/shared`. Textos en español de Perú con trato de tú. `prefers-reduced-motion` sin animaciones.

**Decisions:** Librería de UI: Tailwind CSS 4 con componentes propios; los tokens del DESIGN.md van en `@theme` (Sandro David, 10/10/2026). La verificación es en local a 360 px; la comprobación en Vercel se suma a la tarea de despliegue aplazada (Sandro David, 10/10/2026).

**Never:** Pantallas de negocio (catálogo, login, formularios de evento: son de otras historias). Llamadas a Supabase desde la web. Estilos de las piezas de marketing. Romper la página de salud de la 1.1 ni sus pruebas. Commit, push o PR sin el visto bueno de Jean Pierre.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Respuesta válida | 2xx con JSON que cumple el esquema | `{ ok: true, datos }` | No error expected |
| Error de la API | 4xx/5xx con `{ error: { codigo, mensaje } }` | `{ ok: false, error: { codigo, mensaje } }` con lo que mandó la API | El mensaje de la API se muestra tal cual en un Aviso |
| Respuesta fuera de contrato | 2xx que no cumple el esquema, o cuerpo no JSON | `{ ok: false, error: { codigo: "RESPUESTA_INVALIDA", … } }` | Mensaje amable, no el detalle técnico |
| API inalcanzable | fallo de red, tiempo límite o falta `API_URL` | `{ ok: false, error: { codigo: "SIN_CONEXION", … } }` | Aviso con "Reintentar" |

</frozen-after-approval>

## Code Map

- `apps/web/app/globals.css` -- hoy tokens propios claro/oscuro del esqueleto; se reemplaza por los tokens del DESIGN.md. Las clases `.tarjeta`, `.estado`, `.ok`, `.error`, `.detalle` las usa `app/page.tsx`: migrar esa página a los componentes nuevos.
- `apps/web/app/layout.tsx` -- `RootLayout` con `lang="es"`; añadir Inter (`next/font/google`) y `themeColor` negro en `viewport`.
- `apps/web/app/page.tsx` -- página de salud de la 1.1 (`consultarSalud`, `resumir` de `lib/salud.ts`); mantener su lógica, solo cambia el aspecto.
- `apps/web/lib/salud.ts` -- patrón a seguir para el cliente HTTP (fetch inyectable, `AbortSignal.timeout`, `safeParse`, nunca lanza). No cambiar su contrato.
- `packages/shared/src/error.ts` -- `ErrorApiSchema` (`codigo`, `mensaje`); reutilizar, no duplicar.
- `apps/web/vitest.config.ts` -- solo incluye `lib/**/*.spec.ts`, entorno node: las pruebas del cliente van en `lib/`.
- `apps/web/package.json` -- Next 16.4.0, React 19.3; las versiones se fijan exactas, sin `^`.
- `apps/web/AGENTS.md` -- Next 16 cambia APIs: leer `node_modules/next/dist/docs/` antes de usar `next/font` o rutas nuevas.
- `_bmad-output/initiative-reto18-eventos/ux-plataforma-eventos/mockups/catalogo.html` -- referencia visual de la cabecera, los chips, la tarjeta y la barra inferior (la espina manda si hay conflicto).

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/package.json`, `postcss.config.mjs` -- añadir `tailwindcss` 4 y `@tailwindcss/postcss` con versión exacta -- base de estilos
- [x] `apps/web/app/globals.css` -- `@import "tailwindcss"` y los tokens del DESIGN.md en `@theme` (`--color-*`, radios, espaciado, tipografía), reset, foco visible, `prefers-reduced-motion` -- paleta única
- [x] `apps/web/app/layout.tsx` -- Inter, fondo negro, `themeColor` -- tipografía global
- [x] `apps/web/components/ui/` -- `Boton` (primario, secundario, deshabilitado, ancho completo), `Campo` (etiqueta, error asociado), `Tarjeta`, `Chip` (activo con punto rojo), `Aviso` (éxito, advertencia, error, info; acción opcional "Reintentar"), `Esqueleto` -- componentes base
- [x] `apps/web/components/layout/` -- `Cabecera` (marca del Club, acción a la derecha), `BarraInferior` (destinos por rol, activo en blanco con barra roja de 2 px), `Pantalla` (cabecera + contenido + barra; márgenes 16 px; 480 px máx. desde 768 px) -- layout móvil
- [x] `apps/web/lib/api.ts` -- `pedirApi(ruta, esquema, opciones)` según la matriz -- cliente común para todas las UI
- [x] `apps/web/lib/api.spec.ts` -- pruebas de las cuatro filas de la matriz con fetch simulado -- cubrir la matriz
- [x] `apps/web/lib/navegacion.ts` -- destinos por rol de EXPERIENCE.md como datos tipados -- una sola fuente de los menús
- [x] `apps/web/app/muestra/page.tsx` -- paleta, tipografía, cada componente en todos sus estados y la barra de cada rol -- verificación visual
- [x] `apps/web/app/page.tsx` -- usar `Pantalla`, `Tarjeta` y `Aviso` sin cambiar la lógica de salud -- coherencia con la paleta

**Acceptance Criteria:**
- Given la web en local, when se abre `/muestra` a 360 px de ancho, then se ven la paleta, la tipografía y todos los componentes base sin scroll horizontal.
- Given `/muestra` a 1024 px, when se mira el contenido, then queda centrado a 480 px como máximo.
- Given la página con teclado, when se navega con Tab, then cada control muestra foco blanco y sigue el orden de lectura.
- Given un clon limpio, when se ejecutan `pnpm build`, `pnpm lint` y `pnpm test`, then los tres pasan, incluidas las pruebas de salud de la 1.1.

## Implementation Notes

- Versiones exactas: `tailwindcss` y `@tailwindcss/postcss` 4.3.3 (dev); `zod` 4.6.5 en la web (la misma de `@reto18/shared`) para tipar `pedirApi`.
- `@theme` vacía las paletas y sombras por defecto de Tailwind: solo existen los tokens del DESIGN.md. El espaciado es el múltiplo de 4 px de Tailwind: la escala del DESIGN.md 4/8/12/16/24/32 px es Tailwind 1/2/3/4/6/8 (`h-12` = 48 px). `md:max-w-contenido` = 480 px.
- Componentes en `components/ui` (`Boton`, `BotonEnlace`, `Campo`, `Tarjeta`, `Chip`, `Aviso`, `Esqueleto`, `EsqueletoGrupo`) y `components/layout` (`Cabecera`, `MarcaClub`, `BarraInferior`, `Pantalla`); son componentes de servidor, sin JS de cliente. `Campo` exige `id`; `Aviso` recibe la acción ("Reintentar") como nodo.
- Las rutas de `lib/navegacion.ts` son previstas: cada historia que construye la pantalla confirma la suya.
- `pedirApi` usa `process.env.API_URL` por defecto (solo existe en el servidor); desde un componente de cliente hay que pasar `apiUrl`.
- Verificado en local con Chrome sin interfaz (CDP): a 360 px `scrollWidth` = 360 en `/muestra` y `/`; a 1024 px el `main` mide 480 px centrado; Tab recorre los controles en orden de lectura con contorno blanco de 2 px; fuente calculada Inter.

## Plan Change Log

## Review Triage Log

Pasada 1 (lente `quick`). Veredictos: high 0 · medium 3 · low 6 · false 0 · maybe-false 0.

| Hallazgo | Veredicto | Ruta | Evidencia / acción |
|---|---|---|---|
| La escala `--spacing-1..6` redefinida hace `size-6` = 32 px (icono de Aviso) y `h-5` = 24 px | medium | patch | Confirmado en el CSS compilado; trampa para todas las historias UI. Fix: quitar las redefiniciones; la escala del DESIGN.md se mapea a 1/2/3/4/6/8 de Tailwind. |
| Foco recortado en la barra inferior (`overflow-hidden` en /muestra y borde de la pantalla en la barra fija) | medium | patch | Rompe el AC de foco visible. Fix: contorno de foco hacia dentro en los enlaces de la barra. |
| `pedirApi` trata un 2xx sin cuerpo como RESPUESTA_INVALIDA | medium | patch | NestJS responde 200/201 vacío en controladores `void`. Fix: leer texto y parsear solo si no está vacío + 1 prueba. |
| Placeholder del Campo en `ink-muted` | low | patch | DESIGN.md prohíbe texto legible en ink-muted. Fix directo: `ink-secondary`. |
| `className` del Campo tipado como del input pero aplicado al contenedor | low | patch | Fix directo en el tipo y su JSDoc. |
| JSDoc de Cabecera dice "fija" y no lo es | low | patch | Fix directo del comentario. |
| `aria-live` anidado alrededor de un Aviso con `role` | low | patch | Fix directo: quitar el envoltorio. |
| `AbortSignal.timeout` fuera del `try` lanza con un `tiempoLimiteMs` inválido | low | rejected | Solo con un valor de programación absurdo (negativo/NaN); el fix añade guardas. |
| GET con `cuerpo` o `JSON.stringify` circular se informan como SIN_CONEXION | low | rejected | Error de programación improbable en el uso diario; el fix añade ramas. |

## Design Notes

El cliente devuelve un resultado (`{ ok, datos } | { ok, error }`) en vez de lanzar, como `consultarSalud` de la 1.1: las pantallas siempre tienen un estado que pintar (EXPERIENCE.md exige cargando, vacío y error desde el primer día) y el `mensaje` de la API llega intacto al usuario.

## Verification

**Commands:**
- `pnpm install && pnpm build && pnpm lint && pnpm test` -- expected: todo en verde (web con las pruebas nuevas de `api.spec.ts` y las 6 de salud)

**Manual checks (if no CLI):**
- `pnpm dev:web` y abrir `/muestra` y `/` a 360 px y a 1024 px: sin scroll horizontal, colores y fuente del DESIGN.md, foco visible con Tab.
