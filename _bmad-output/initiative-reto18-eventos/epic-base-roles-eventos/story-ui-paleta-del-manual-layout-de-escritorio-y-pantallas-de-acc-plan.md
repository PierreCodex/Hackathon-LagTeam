---
title: 'UI: paleta del manual, layout de escritorio y pantallas de acceso'
type: 'feature'
ticket: '12'
created: '2026-10-10'
status: 'built'
baseline_revision: '22da709d6aa823598cee9906772ba05647af925d'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-reto18-eventos/ux-plataforma-eventos/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-reto18-eventos/ux-plataforma-eventos/mockups/escritorio.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La web de la 1.7 y la 1.8 es solo móvil: en escritorio queda una columna de 480 px con barra inferior, y usa negro puro y rojo de más, cuando la marca pide carbón y grises con el rojo solo como acento.

**Approach:** Cambiar los tokens de `globals.css` a la paleta clara del manual (`DESIGN.md`), poner el logotipo real y rehacer el layout: desde 1024 px, cabecera carbón con el menú del rol, contenedor de 1280 px, pie del Club y sin barra inferior; por debajo de 1024 px se mantiene la barra inferior. `/ingresar` y `/registro` pasan a la pantalla de acceso en dos mitades, con mostrar/ocultar contraseña, y `/muestra` enseña lo nuevo.

## Boundaries & Constraints

**Always:** Los valores de color salen exactos del frontmatter de `DESIGN.md`. El rojo solo en el botón principal, el subrayado del destino activo (3 px) y los enlaces de acento; nunca en fondos ni en precios. El menú de la cabecera y la barra leen de `lib/navegacion.ts`. Sin sesión se ve el menú de público. Con el perfil sin leer no se ve ningún menú. Los formularios siguen en una columna de 480 px. Objetivos táctiles de 48 px. Foco visible también sobre carbón. Con reducir movimiento, nada se anima.

**Decisions:** La pantalla de acceso va dentro de `Pantalla`, con cabecera, pie y barra inferior en móvil, como pide el `verify` del ticket. La cabecera de `/ingresar` y `/registro` va sin botones, para no tener dos botones rojos. El menú de la cabecera no repite "Cuenta": a la derecha va la cuenta (inicial y correo), que enlaza a `/cuenta` (10/10/2026). El panel de marca va sin flyer: logotipo, titular, subtítulo e isotipo de marca de agua; el flyer se suma cuando exista el catálogo (Sandro David, 10/10/2026). El pie muestra las secciones y sus textos sin enlaces (nada de `href="#"`); solo "Para organizadores" enlaza a `/registro`. Se enlazan cuando haya páginas y URLs del Club (Sandro David, 10/10/2026). El plan se mantiene entero aunque pase de 1600 tokens (Sandro David, 10/10/2026).

**Never:** Tocar la lógica de la 1.8 (`acciones.ts`, `lib/sesion*.ts`, `proxy.ts`), salvo el aspecto. La portada del catálogo, el buscador, el héroe y las filas (1.11). "¿Contraseña olvidada?", favoritos, blog y un menú desplegable de la cuenta. Dependencias nuevas. Commit, push o PR sin el visto bueno del equipo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Anónimo a 1440 px | `/muestra` sin sesión | Cabecera con el menú de público, Registrarse e Ingresar; pie; sin barra | — |
| Anónimo a 360 px | Cualquier pantalla | Logotipo e "Ingresar" arriba, barra de público abajo, el pie sin tapar, sin scroll horizontal | — |
| Organizador a 1440 px | Sesión de organizador en `/organizador` | Menú Mis eventos · Marketing · Ventas con Mis eventos activo; a la derecha su cuenta | — |
| Perfil sin leer | `sesion.tipo = "error"` | Sin menú ni barra; aviso con "Reintentar" | Igual que en la 1.8 |
| Mostrar contraseña | Pulsa el botón del campo | El campo pasa a texto y el botón dice "Ocultar contraseña" (`aria-pressed`); al volver a pulsar se oculta | — |

</frozen-after-approval>

## Code Map

- `apps/web/app/globals.css` -- `@theme`: hoy oscuro. Nuevos valores y tokens `surface-inverse`, `surface-inverse-raised`, `border-inverse`, `ink-on-inverse`, `ink-on-inverse-secondary`. `--container-contenido` (480) pasa a `--container-formulario: 480px`, y se añaden `--container-max: 1280px` y `--spacing-margin-desktop: 32px`. `color-scheme: light`.
- `apps/web/app/layout.tsx` -- `viewport.themeColor` a `#272424` y `colorScheme` a `light`.
- `apps/web/lib/navegacion.ts` -- `DESTINOS_POR_ROL` es la única fuente. Se añade `destinosCabecera(rol)` (sin `cuenta`).
- `apps/web/components/layout/pantalla.tsx` -- esqueleto de toda pantalla. Hoy usa `md:max-w-contenido` y deja el hueco de la barra en `main`.
- `apps/web/components/layout/cabecera.tsx` -- `MarcaClub` (texto) y `Cabecera({ accion })`.
- `apps/web/components/layout/barra-inferior.tsx` -- barra por rol. La prop `fija={false}` la usa `/muestra`.
- `apps/web/components/layout/pantalla-sesion.tsx` -- `AccionCabeceraSesion` y `PantallaSesion` (usada por `/`, `/cuenta`, `/ingresar`, `/registro`, `GuardaRol`). `rolBarraDeSesion` viene de `lib/sesion.ts`, que no se toca.
- `apps/web/components/ui/` -- `boton.tsx` (variantes; deshabilitado hoy con `bg-surface-overlay`), `campo.tsx` (borde `ink-muted`), `chip.tsx`, `esqueleto.tsx` (`bg-surface-overlay`, que ahora es blanco y no se vería) y `aviso.tsx`.
- `apps/web/app/ingresar/*`, `apps/web/app/registro/*` -- páginas y formularios. Solo cambia el contenedor y el campo de contraseña.
- `apps/web/app/muestra/page.tsx` -- `PALETA` con los hex viejos; precio en `text-accent`.
- `apps/web/public/marca/*.svg` -- `logo-oscuro` (169×51) y `logo-claro` (448×115). `next/image` con `unoptimized` para el SVG.
- Referencia visual: `mockups/escritorio.html` (clases `header`, `.menu`, `footer .pie`, `.acceso`, `.panel`, `.form`).

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/app/globals.css`, `apps/web/app/layout.tsx` -- paleta clara y tokens nuevos del frontmatter de `DESIGN.md`. Sobre superficies carbón, el foco va en blanco.
- [ ] `apps/web/lib/navegacion.ts`, `apps/web/lib/navegacion.spec.ts` -- `destinosCabecera(rol)` y su prueba: quita `cuenta` y conserva el orden.
- [ ] `apps/web/components/ui/boton.tsx` -- variante `inverso` (contorno gris y texto blanco, para usar sobre carbón). Deshabilitado con `bg-border-hairline`.
- [ ] `apps/web/components/ui/campo.tsx`, `chip.tsx`, `esqueleto.tsx` -- ajustes de la paleta clara (borde del campo `#BDBFC1` y 2 px al enfocar; chip sobre `surface-base` con línea fina; esqueleto en `border-hairline`). En `Campo`, prop `accesorio` para un botón dentro del campo.
- [ ] `apps/web/components/ui/campo-contrasena.tsx` (+ export) -- cliente: `Campo` con botón de 48 px "Mostrar/Ocultar contraseña" (`aria-pressed`).
- [ ] `apps/web/components/layout/marca.tsx` -- `Logotipo({ variante: "oscuro" | "claro" })` con alt "Club de Arte & Cultura", de al menos 120 px. Sustituye a `MarcaClub`.
- [ ] `apps/web/components/layout/cabecera.tsx` -- carbón, 68 px, contenedor de 1280 px. Desde `lg`, menú del rol (activo en blanco con subrayado rojo de 3 px, `aria-current`); a la derecha, la acción.
- [ ] `apps/web/components/layout/pie.tsx` -- pie carbón con el logotipo, la frase del Club, las secciones del pie como texto sin enlace (solo "Para organizadores" → `/registro`), y "Pago simulado: no se cobra nada."
- [ ] `apps/web/components/layout/barra-inferior.tsx` -- carbón y `lg:hidden` cuando es fija.
- [ ] `apps/web/components/layout/pantalla.tsx` -- props `ancho: "completo" | "formulario"` y `sinAccionesCabecera`. Contenedor `max-w-max` y `px-margin-mobile lg:px-margin-desktop`. Pie al final. El hueco de la barra pasa al pie y se anula desde `lg`.
- [ ] `apps/web/components/layout/pantalla-sesion.tsx` -- `AccionCabeceraSesion`: si es anónima, "Registrarse" (inverso, solo `lg`) e "Ingresar" (primario); si hay cuenta, la inicial y el correo (el correo solo `lg`) enlazando a `/cuenta`. Pasa `rol` y `destinoActivo` a la cabecera.
- [ ] `apps/web/components/layout/pantalla-acceso.tsx` -- en `lg`, dos mitades: el panel carbón (logotipo, "Crea y vende tu evento con IA", subtítulo, isotipo de marca de agua sin flyer) y el formulario a 480 px con "Volver", el enlace inverso, `logo-claro` y el título. En móvil, solo el formulario.
- [ ] `apps/web/app/ingresar/*`, `apps/web/app/registro/*` -- usan `PantallaAcceso` y `CampoContrasena`, sin tocar los estados ni las acciones.
- [ ] `apps/web/app/cuenta/page.tsx`, `components/layout/guarda-rol.tsx` -- `ancho="formulario"` en la cuenta y en "Esta sección es para…".
- [ ] `apps/web/app/muestra/page.tsx` -- paleta nueva (con las inversas), una sección de logotipo, el precio en `ink-primary` negrita y la tarjeta con imagen sobre carbón.

**Acceptance Criteria:**
- Given `/muestra` a 1440 px, when se abre, then se ven la cabecera carbón con el logotipo real y el menú, el contenido a todo el contenedor, el pie y ninguna barra inferior, y el rojo solo en el botón principal, el subrayado activo y los chips activos.
- Given `/ingresar` y `/registro` a 1440 px, when se abren, then se ven el panel de marca a la izquierda y el formulario de 480 px a la derecha, con la cabecera y el pie.
- Given las mismas tres páginas a 360 px, when se abren, then hay una columna con la barra inferior y no hay scroll horizontal.
- Given tres cuentas (público, organizador y administrador), when cada una ingresa a 1440 px, then llega a su portada y ve su menú en la cabecera con el destino activo marcado.
- Given la navegación con Tab, when se recorren la cabecera, el pie y el botón de mostrar contraseña, then cada control muestra un foco visible.

## Implementation Notes

- El token del contenedor se llama `--container-pagina` (`max-w-pagina`), no `--container-max`: `max-w-max` choca con la utilidad `max-content` de Tailwind y solo funcionaba por el orden de las reglas.
- "Registrarse" usa `max-lg:hidden`: con `hidden lg:inline-flex`, `inline-flex` del botón ganaba y se veía en móvil.
- Pruebas de la tabla: `components/layout/layout.spec.tsx` pinta `Pantalla` con `react-dom/server` (anónimo, organizador, perfil sin leer, acceso sin botones, contraseña). `vitest.config.ts` incluye `components/**/*.spec.tsx`, con JSX automático (oxc) y el alias `@/`. `estadoContrasena(visible)` se extrajo para probar el cambio de estado sin DOM.
- Textos elegidos: "¡Bienvenido!" / "Crea tu cuenta" con subtítulo; "Volver" lleva a `/`. Los formularios conservan su enlace inferior "Regístrate"/"Ingresar" (no se tocan).
- Pendiente manual: revisar en el navegador a 360 y 1440 px y entrar con las tres cuentas (`pnpm db:start`).

## Design Notes

La pantalla de acceso no es el `.acceso` del mockup a pantalla completa: vive en el `main` de `Pantalla`, porque el ticket pide la cabecera y el pie. En `lg` ocupa todo el contenedor con `grid-cols-2`. El panel es una tarjeta carbón con `rounded-md` y el formulario va sobre `surface-raised`.

Breakpoint único: `lg` (1024 px) para la cabecera ancha, el pie en 4 columnas, ocultar la barra y las dos mitades. No se usa `md` para el layout.

## Verification

**Commands:**
- `pnpm build && pnpm lint && pnpm test` -- expected: todo en verde, incluida `navegacion.spec.ts`.

**Manual checks (if no CLI):**
- `pnpm --filter @reto18/web dev` y revisar `/muestra`, `/ingresar` y `/registro` a 360 px y a 1440 px. Con `pnpm db:start`, ingresar con las tres cuentas.


## Review Triage Log

Pasada 1 (quick): 7 hallazgos — high 0 · medium 1 · low 4 · false 0 · rechazados 2.

| Hallazgo | Veredicto | Ruta | Evidencia / acción |
|---|---|---|---|
| `/ingresar` y `/registro` sin "Cuenta" con el perfil sin leer | medium | patch | `PantallaAcceso` pasaba siempre `sinAccionesCabecera`; ahora solo si la sesión es anónima. |
| Alto del logotipo depende del orden de reglas (`h-11` + override) | low | patch | `Logotipo` pone `h-11` solo si no llega `className`. `IsotipoMarcaAgua` no choca (clases fijas de posición). |
| `/cuenta` en escritorio sin destino activo marcado | low | patch | El enlace de la cuenta lleva el subrayado rojo de 3 px desde `lg` cuando está activa. |
| Rojo en el enlace "Para organizadores" del pie (AC 1) | low | patch | Se quitó `decoration-accent`; el subrayado queda en blanco. |
| Pulsado del botón secundario invisible sobre el lienzo | low | patch | `active:bg-border-hairline`. |
| Tareas del plan sin marcar | — | rechazado | Su arreglo es editar el plan de esta build. |
| Mostrar contraseña sin prueba de interacción | low | rechazado | Requiere DOM (jsdom o Testing Library), dependencias nuevas que el plan prohíbe; el cambio de estado se prueba con `estadoContrasena` y queda la revisión manual. |
