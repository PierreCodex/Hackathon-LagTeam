---
id: CHANGE-layout-escritorio-estilo-joinnus
status: aprobada
date: 2026-10-10
scope: moderado
references:
  - ../ux-plataforma-eventos/DESIGN.md
  - ../ux-plataforma-eventos/EXPERIENCE.md
  - ../epic-base-roles-eventos/tickets.toml
---

# Propuesta de cambio: layout de escritorio con estructura tipo Joinnus

## 1. El problema

La web se diseñó "móvil primero" y en escritorio sigue siendo móvil: el layout `Pantalla` (`apps/web/components/layout/pantalla.tsx`) centra todo el contenido en una columna de 480 px (`md:max-w-contenido`) y pinta la barra inferior de pestañas en cualquier ancho. En una pantalla de 1440 px queda una franja estrecha con barra de app móvil (verificado con capturas de `/muestra` y `/registro`, 10/10/2026).

No es un error de la 1.7 ni de la 1.8: ambas cumplen lo que fijan `DESIGN.md` (§Layout & Spacing: "a partir de 768 px el contenido se centra en un máximo de 480 px… La navegación principal es una barra inferior fija") y `EXPERIENCE.md` (§Information Architecture: "Barra inferior fija por rol… Sin menú hamburguesa"; §Responsive & Platform). El cambio está en la UX.

Jean Pierre pide reestructurar el frontend siguiendo la estructura de Joinnus (joinnus.com, capturas del 10/10/2026: portada y pantalla de ingreso) y conservando nuestra identidad: negro, rojo `#ED3237`, Inter.

## 2. Impacto

**Epics.** Ningún epic cambia de objetivo ni de capacidades. Cambia la presentación de todas las historias "UI:".

**Historias.**

| Historia | Estado | Impacto |
|---|---|---|
| 1.7 UI: sistema de diseño y layout móvil | done | Los tokens y componentes base se mantienen. El layout se rehace en la nueva 1.12. |
| 1.8 UI: registro, inicio de sesión y menús por rol | built | La lógica (Supabase Auth, `destinoTrasIngreso` lleva a cada rol a su portada, guarda de rol) se mantiene. Cambia el aspecto de `/ingresar` y `/registro` en la 1.12. |
| 1.11 UI: catálogo, ficha y calendario | ready | Se reescribe: la portada adopta la estructura tipo Joinnus. |
| 1.9, 1.10, 2.8 a 2.12, 3.8 a 3.10, 4.4 a 4.6 | ready | Sin cambio de alcance. Heredan el layout de la 1.12 y se verifican también en escritorio. |

**Artefactos.** `DESIGN.md` y `EXPERIENCE.md` cambian (detalle en la sección 4). La spec no cambia: CAP-1 ya dice "desde la web y el móvil". La arquitectura no cambia: no hay contratos, módulos ni tablas nuevas.

**Técnico.** Solo `apps/web`: `components/layout/` (`pantalla.tsx`, `cabecera.tsx`, `barra-inferior.tsx`, `pantalla-sesion.tsx`), un pie nuevo, el token `max-w-contenido` de `globals.css` y las páginas `/ingresar` y `/registro`. La API y la base de datos no se tocan.

## 3. Enfoque recomendado

**Ajuste directo.** Se agrega la historia 1.12, que rehace el layout sobre lo ya construido, y se reescribe la 1.11. No se revierte nada: la 1.7 y la 1.8 quedan cerradas, porque su lógica y sus componentes siguen sirviendo.

- **Esfuerzo:** la 1.12 es media sesión de build (layout y dos pantallas de acceso). La 1.11 crece, de una lista con filtros a una portada con secciones.
- **Riesgo:** bajo. Las pruebas de `sesion.spec.ts` y `formularios.spec.ts` cubren la lógica, que no cambia.
- **Calendario:** la 1.12 tiene que fusionarse antes de empezar la 1.9, la 1.10 y la 1.11, para que no se construyan tres pantallas más sobre el layout viejo.

### Decisiones tomadas por defecto (revisables)

1. **Navegación híbrida.** Desde 1024 px: cabecera ancha con el menú del rol arriba, sin barra inferior y con contenido a todo el ancho (máximo 1280 px). Por debajo de 1024 px se mantiene la barra inferior por rol, que es lo que mejor sirve para comprar y escanear en la puerta con el móvil.
2. **Carrusel manual.** El héroe pasa los destacados con flechas y puntos, sin avance automático. Se mantiene la prohibición de carruseles automáticos del `EXPERIENCE.md`.
3. **Fuera de alcance de lo que muestra Joinnus:** favoritos (corazón), blog, selector de idioma, "Lo más vendido" con ranking (la API del catálogo, 1.6, no expone ventas por evento) y "¿Contraseña olvidada?". Esto último va a `deferred-work.md`.
4. **Formularios estrechos.** Los formularios siguen en columna estrecha centrada aunque el layout sea ancho. Solo se ensanchan el contenedor y la navegación.

## 4. Cambios propuestos

### 4.0 Paleta: la del manual de marca (opción 1, elegida por Jean Pierre, 10/10/2026)

**Problema.** El hex del rojo es correcto (`#ED3237`, manual p. 17), pero se usa de más. En el manual, el rojo aparece solo en la palabra "arte" del logotipo; en las versiones sobre fondo oscuro (p. 9) ni siquiera se usa. El resto es carbón y grises: cabeceras `#272424`, texto y líneas del logo `#373435`, fondos `#F1F1F2`, "CLUB" en `#848688`. Esos cuatro tonos faltaban en `DESIGN.md`. La interfaz actual (negro puro, bloques y degradados rojos) se siente más agresiva que la marca.

**Cambio en `DESIGN.md` §Colors y tokens del frontmatter.** Tema claro con estructura carbón:

| Token | Antes | Después | Origen |
|---|---|---|---|
| `surface-base` (fondo de página) | `#000000` | `#F1F1F2` | Manual, fondos de página |
| `surface-raised` (tarjetas, campos) | `#141414` | `#FFFFFF` | Manual |
| `surface-inverse` (nuevo: cabecera, pie, héroe, barra inferior, panel de acceso) | — | `#272424` | Manual, cabeceras |
| `surface-inverse-raised` (nuevo: tarjetas sobre carbón) | — | `#373435` | Manual, texto del logo |
| `border-hairline` | `#2E2F31` | `#DCDCDE` | Derivado |
| `ink-primary` | `#FFFFFF` | `#373435` | Manual, "cultura" del logo |
| `ink-secondary` | `#BDBFC1` | `#6D6E71` | Manual, texto corrido |
| `ink-on-inverse` (nuevo) | — | `#FFFFFF`, secundario `#BDBFC1` | Manual |
| `accent` | `#ED3237` | `#ED3237` (igual) | Manual |

**Regla del rojo (reemplaza "Rojo del Club es el único color de acción").** El rojo es acento, no superficie: el botón principal (uno por pantalla), el indicador del destino activo (subrayado de 3 px), la etiqueta "Destacado" y el subrayado de los enlaces "Ver todos". Nunca degradados rojos, fondos rojos, bloques promocionales rojos ni precios en rojo: el precio va en `ink-primary` en negrita.

**Logotipo.** Se usan los archivos de `apps/web/public/marca/`, recortados de los vectores del manual: `logo-oscuro` sobre carbón (cabecera, pie, panel de acceso), `logo-claro` sobre fondos claros, `isotipo-blanco` al 50 % como marca de agua sobre carbón o fotos (manual p. 14). Esto reemplaza el texto "CLUB DE ARTE & CULTURA" que usan hoy la cabecera y `/muestra`.

**Excepciones que siguen en oscuro:** el escáner de la puerta y la pizarra o el mapa de butacas, donde el contraste al aire libre y los colores de precio lo justifican. Usan `surface-inverse` como fondo.

Referencia visual: [`mockups/escritorio.html`](../ux-plataforma-eventos/mockups/escritorio.html).

### 4.1 UX: `DESIGN.md`

**§Layout & Spacing**

ANTES:
> Una sola columna con márgenes de `{spacing.margin-mobile}` (16 px). Diseño base a 360 px sin scroll horizontal; a partir de 768 px el contenido se centra en un máximo de 480 px para formularios y entradas, y el catálogo pasa a rejilla de 2 a 3 columnas. La pizarra del mapa es la excepción: usa todo el ancho y permite desplazarse y ampliar dentro de su lienzo.
>
> Objetivos táctiles de 48 px de alto como mínimo. La navegación principal es una barra inferior fija con tres a cinco destinos según el rol.

DESPUÉS:
> Diseño base a 360 px sin scroll horizontal, con márgenes de `{spacing.margin-mobile}` (16 px). Tres anchos:
> - **Móvil (< 768 px):** una columna. Navegación con barra inferior fija por rol.
> - **Tableta (768–1023 px):** igual que móvil; el catálogo pasa a rejilla de 2 a 3 columnas.
> - **Escritorio (≥ 1024 px):** contenedor de hasta 1280 px con márgenes de 32 px. Cabecera ancha con el menú del rol; **sin barra inferior**. Las filas de eventos muestran 4 a 5 tarjetas. Los formularios (acceso, alta, pago) siguen en una columna de 480 px dentro del contenedor ancho. Ventas y Tablero usan el ancho completo.
>
> La pizarra del mapa es la excepción en todos los anchos: ocupa todo el ancho y permite desplazarse y ampliar dentro de su lienzo. Objetivos táctiles de 48 px de alto como mínimo.

**§Components:** se agregan estos componentes.

> - **Cabecera** — fondo `{colors.surface-base}` con línea fina inferior. Móvil: logotipo y acción ("Ingresar" o avatar). Escritorio: logotipo a la izquierda, menú del rol en texto (destino activo en blanco con subrayado rojo de 2 px), y a la derecha "Registrarse" (secundario) e "Ingresar" (primario), o el nombre de la cuenta con su menú. Sin sesión, el menú muestra el del público.
> - **Buscador del catálogo** — banda en `{colors.surface-raised}` bajo la cabecera, con el campo de búsqueda y filtros de fecha, distrito, precio y categoría. En escritorio va en una fila; en móvil, búsqueda arriba y filtros como chips desplazables.
> - **Héroe** — carrusel de eventos destacados en 16:9 (4:5 en móvil), con esquina `{rounded.md}`, flechas y puntos. Sin avance automático. En escritorio lleva a su derecha una columna de 1/4 con tarjetas promocionales propias: Piura Cultural Weekend y "Publica tu evento" para organizadores.
> - **Fila de categorías** — iconos de línea de 32 px con su etiqueta `meta`, desplazable en horizontal. La categoría activa lleva un punto rojo.
> - **Fila de eventos** — título de sección en `title` con "Ver todos" a la derecha. Tarjetas en carrusel horizontal con flechas en escritorio y desplazamiento táctil en móvil.
> - **Banda de llamada a la acción** — `{colors.surface-raised}` a todo el ancho del contenedor, un titular, una línea y un solo botón.
> - **Pie** — `{colors.surface-raised}`. Logotipo del Club, enlaces (Sobre el Club, Preguntas frecuentes, Términos, Privacidad), redes sociales y "Contáctanos" por WhatsApp. En móvil va encima del hueco de la barra inferior.
> - **Pantalla de acceso** — en escritorio, dos mitades: a la izquierda un panel de marca (flyer de un evento destacado o imagen del Club sobre negro, con el titular "Crea y vende tu evento con IA" en `display`); a la derecha "Volver", "¿No tienes cuenta? Regístrate" (o su inverso), el isotipo, "¡Bienvenido!" y el formulario. En móvil solo el formulario. La contraseña lleva un botón para mostrarla u ocultarla.

**§Components, Tarjeta de evento:** se agrega al final:
> En las filas, la imagen es vertical 4:5 y debajo van la fecha (`10 OCT`) y el distrito en `meta`, el título en dos líneas como máximo y "Desde S/ X".

### 4.2 UX: `EXPERIENCE.md`

**§Information Architecture**, párrafo de la barra:

ANTES:
> Barra inferior fija por rol: **Público** Eventos · Calendario · Mis entradas · Cuenta. **Organizador** … Sin menú hamburguesa. Una hoja modal como máximo, nunca dos.

DESPUÉS:
> Menú por rol: **Público** Eventos · Calendario · Mis entradas · Cuenta. **Organizador** Mis eventos · Marketing · Ventas · Cuenta. **Administrador** Aprobar · Weekend · Tablero · Cuenta. **Puerta** Escanear · Registro. En móvil y tableta es una barra inferior fija; en escritorio (≥ 1024 px) va en la cabecera y no hay barra inferior. Una sola fuente para los dos: `lib/navegacion.ts`. Sin menú hamburguesa. Una hoja modal como máximo, nunca dos.
>
> **Acceso.** Una sola pantalla de ingreso para todos: correo y contraseña. El rol no se elige al entrar; al iniciar sesión, cada cuenta llega a su portada (público: catálogo; organizador: Mis eventos; administrador: Aprobar). El tipo de cuenta solo se elige al registrarse.

**§Information Architecture**, fila "Catálogo y calendario": el propósito pasa a ser "Portada: buscador, destacados, categorías y filas de eventos; calendario mensual".

**§Interaction Primitives:** se agrega:
> - Los carruseles (héroe y filas) avanzan solo cuando se toca o se pulsa una flecha, y con reducir movimiento se desplazan sin animación.

**§Inspiration & Anti-patterns:** se agrega:
> - **Tomado de Joinnus:** la estructura de la portada (buscador con filtros, héroe con lateral, categorías con iconos, filas por tema con "Ver todos", pie completo) y la pantalla de acceso en dos mitades. Se descarta su paleta, el carrusel automático, los favoritos y el blog.

**§Responsive & Platform**

ANTES:
> Móvil primero. A partir de 768 px: formularios y entradas centrados a 480 px; catálogo en rejilla de 2 a 3 columnas; Ventas y Tablero pueden usar tablas completas. …

DESPUÉS:
> Móvil primero, y escritorio de verdad desde 1024 px: cabecera con menú, contenido a 1280 px y sin barra inferior (`DESIGN.md` §Layout). Formularios y entradas siguen en columna de 480 px; Ventas y Tablero usan tablas completas. Toda historia UI se verifica a 360 px y a 1440 px. La puerta y la compra se prueban en móvil real; el administrador puede trabajar en portátil.

### 4.3 Historias: epic 1 (`epic-base-roles-eventos/tickets.toml`)

**Nueva: 1.12**

```toml
[[entry]]
id = 12
type = "story"
title = "UI: paleta del manual, layout de escritorio y pantallas de acceso"
description = "Cambia los tokens de globals.css a la paleta del manual (sección 4.0 de la propuesta: tema claro, cabecera y pie en carbón #272424, rojo solo como acento) y pone el logotipo real de public/marca/ en la cabecera, el pie y el acceso. Rehace el layout de la 1.7 para escritorio según DESIGN.md §Layout: desde 1024 px cabecera ancha con el menú del rol (de lib/navegacion.ts) y Registrarse/Ingresar o la cuenta, contenedor de 1280 px, pie del Club y sin barra inferior; por debajo se mantiene la barra inferior. Rehace /ingresar y /registro como pantalla de acceso en dos mitades (panel de marca y formulario), con mostrar/ocultar contraseña, sin tocar su lógica (1.8). Actualiza /muestra con la cabecera, el pie y la pantalla de acceso."
verify = "/muestra enseña la paleta nueva con el rojo solo en acentos y el logotipo real. A 1440 px, /muestra, /ingresar y /registro usan todo el ancho con la cabecera y el pie y sin barra inferior; a 360 px se ven como hoy, con barra inferior y sin scroll horizontal. Al ingresar, público, organizador y administrador llegan cada uno a su portada y ven su menú en la cabecera."
covers = ["CAP-1"]
after = [7, 8]
hitl = false
risk = "low"
assignee = "Sandro David"
references = ["ux-plataforma-eventos/DESIGN.md", "ux-plataforma-eventos/EXPERIENCE.md", "change-layout-escritorio-estilo-joinnus/change-layout-escritorio-estilo-joinnus.md"]
```

**1.11 UI: catálogo, ficha y calendario.** Cambian `description`, `verify` y `after`.

ANTES:
> description = "Entrega el catálogo sin inicio de sesión con búsqueda y filtros, destacados primero, la ficha del evento y la vista de calendario mensual, adaptados al móvil (CAP-4)."
> verify = "Sobre los eventos de la semilla, combinar filtros en el móvil muestra solo los aprobados que los cumplen y el calendario muestra los del mes."
> after = [6, 7]

DESPUÉS:
> description = "Entrega la portada pública sin inicio de sesión con la estructura de DESIGN.md: buscador con filtros de fecha, distrito, precio y categoría; héroe manual con los destacados y lateral de Weekend y 'Publica tu evento'; fila de categorías; filas de eventos por tema con 'Ver todos' (destacados, esta semana, por categoría) que abren la lista filtrada; banda de llamada a la acción y pie. Además, la ficha del evento y la vista de calendario mensual. Todo en móvil y escritorio (CAP-4)."
> verify = "Sobre la semilla, a 360 px y a 1440 px: la portada muestra los destacados primero en el héroe y las filas por categoría; combinar filtros muestra solo los aprobados que los cumplen; 'Ver todos' abre la lista de esa categoría; el calendario muestra los eventos del mes."
> after = [6, 12]

Motivo: la portada estilo Joinnus es la vista que pidió el usuario, y tiene que construirse sobre el layout de la 1.12.

**1.9 y 1.10.** `after` pasa a incluir la 12: `[4, 8, 12]` y `[5, 8, 12]`. En `verify`, "desde el móvil" pasa a "en móvil y en escritorio".

### 4.4 Historias: epics 2, 3 y 4

Solo cambian las dependencias, que pasan de `"1.7"` a `"1.12"` en las historias que hoy dependen de la 1.7: 2.9, 3.8, 4.4, 4.5 y 4.6. La 2.8, la 2.11 y la 2.12 heredan la 1.12 a través de la 1.8 o de la 2.8; se les agrega `"1.12"` a `after` para que quede explícito. Su `verify` queda igual, porque la regla de verificar a 360 px y a 1440 px vive en `EXPERIENCE.md` §Responsive.

### 4.5 Trabajo aplazado (`deferred-work.md`)

> - **¿Contraseña olvidada?** en la pantalla de acceso (Supabase `resetPasswordForEmail` y una pantalla para la contraseña nueva). Joinnus lo tiene; no está en la spec y no sirve al flujo de la demo. (Propuesta de cambio de layout, 10/10/2026.)
> - **Favoritos y "Lo más vendido"** en la portada. Requieren datos que la API no expone (ventas por evento en el catálogo). (Ídem.)

## 5. Entrega

**Alcance: moderado.** Hay que reorganizar el backlog (una historia nueva, una reescrita y dependencias movidas) sin replanificar el producto.

Aprobada por Jean Pierre (10/10/2026). Las secciones 4.0 a 4.5 ya están aplicadas a `DESIGN.md`, `EXPERIENCE.md`, los `tickets.toml` y `deferred-work.md`.

### Reparto de las historias "UI:"

Manuel Alexis vuelve a programar. Se reparte por epic para que cada uno sea dueño de un flujo completo y no se pisen archivos:

| Sandro David | Manuel Alexis |
|---|---|
| **1.12** Paleta, layout de escritorio y acceso (va primero: bloquea al resto) | **2.9** Pizarra del mapa de la sede |
| 1.11 Portada, ficha y calendario | 2.10 Pintar precios en la pizarra |
| 1.9 Formulario de alta de evento | 2.8 Compra, Mis entradas y escáner |
| 1.10 Pantalla de aprobación | 2.11 Elegir butaca en el mapa |
| 3.8 Pantalla Marketing y flyer 4:5 | 2.12 Puerta sin conexión |
| 3.9 Formatos por red, compartir y resultados | 4.4 Panel de ventas del organizador |
| 3.10 Weekend y afiche colectivo | 4.5 Comisión y liquidación |
| 3.6 Alerta de APDAYC con IA | 4.6 Tablero del administrador |

- **Orden:** Sandro empieza por la 1.12. Mientras tanto, Manuel instala y prueba Claude Code con BMad (`/bmad status`) y lee `DESIGN.md`, `EXPERIENCE.md` y `mapa-asientos.md`. Cuando se fusione la 1.12, empieza por la 2.9: su lienzo usa todo el ancho y depende poco del layout.
- **Puntos de contacto:** la 3.9 de Sandro espera a la 2.8 de Manuel, y la 4.4 de Manuel también la espera. Por eso la 2.8 va pronto en la cola de Manuel, en cuanto exista la API 2.1.
- **Aceptación funcional cruzada:** Sandro acepta los PRs de Manuel y Manuel los de Sandro, a 360 px y a 1440 px. Jean Pierre revisa el código de todos.
- **Otras tareas:** Manuel conserva la validación de las 19:00 y el pitch. La parte manual de la 3.4 (cuenta de publicación y redes) vuelve a Sandro, que lleva la UI del epic 3.
- **Reservas** para quien termine primero: 1.11, 3.10, 4.5 y 4.6.
- **`EQUIPO.md`:** lo modifica solo P1. Hay que pedirle a Manuel Alexis que registre el cambio de roles.

**Criterios de éxito**

- A 1440 px ninguna pantalla se ve como columna de móvil y no hay barra inferior; a 360 px nada cambia respecto de hoy.
- Ingresar con cualquiera de los tres roles lleva a su portada con su menú.
- La 1.9, la 1.10 y la 1.11 empiezan después de fusionar la 1.12.
- La paleta, la tipografía y la regla de "un solo botón rojo por pantalla" se mantienen.
