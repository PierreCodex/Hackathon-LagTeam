---
name: Club de Arte & Cultura · Plataforma de eventos
description: Identidad visual de la plataforma de eventos culturales de Piura. Paleta del manual de marca (carbón, grises y rojo solo como acento), tema claro con estructura carbón, móvil a 360 px y escritorio desde 1024 px.
status: final
updated: 2026-10-10
sources:
  - imports/manual-de-marca.pdf
  - ../change-layout-escritorio-estilo-joinnus/change-layout-escritorio-estilo-joinnus.md
colors:
  surface-base: '#F1F1F2'
  surface-raised: '#FFFFFF'
  surface-overlay: '#FFFFFF'
  surface-inverse: '#272424'
  surface-inverse-raised: '#373435'
  border-hairline: '#DCDCDE'
  border-inverse: '#3F3C3C'
  ink-primary: '#373435'
  ink-secondary: '#6D6E71'
  ink-muted: '#727376'
  ink-on-inverse: '#FFFFFF'
  ink-on-inverse-secondary: '#BDBFC1'
  accent: '#ED3237'
  accent-pressed: '#C4262B'
  on-accent: '#FFFFFF'
  state-success: '#2E8B57'
  state-warning: '#B07A00'
  state-error: '#C4262B'
  seat-sold: '#3A3B3D'
  seat-held: '#727376'
  seat-selected: '#FFFFFF'
  price-1: '#ED3237'
  price-2: '#F2A900'
  price-3: '#2BB5A0'
  price-4: '#7C8CFF'
typography:
  display:
    fontFamily: 'Inter, Arial, sans-serif'
    fontSize: 28px
    fontWeight: 900
    lineHeight: 1.1
  title:
    fontFamily: 'Inter, Arial, sans-serif'
    fontSize: 20px
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: 'Inter, Arial, sans-serif'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: 'Inter, Arial, sans-serif'
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
  button:
    fontFamily: 'Inter, Arial, sans-serif'
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1
rounded:
  sm: 6px
  md: 12px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1280px
  form-max: 480px
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.on-accent}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    height: 48px
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-primary}'
    borderColor: '{colors.ink-muted}'
    rounded: '{rounded.md}'
    height: 48px
  card:
    backgroundColor: '{colors.surface-raised}'
    borderColor: '{colors.border-hairline}'
    rounded: '{rounded.md}'
    padding: '{spacing.4}'
  input:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.ink-primary}'
    borderColor: '{colors.ink-on-inverse-secondary}'
    rounded: '{rounded.sm}'
    height: 48px
  chip:
    backgroundColor: '{colors.surface-base}'
    textColor: '{colors.ink-secondary}'
    borderColor: '{colors.border-hairline}'
    rounded: '{rounded.full}'
    height: 32px
---

## Brand & Style

Club de Arte & Cultura quiere ser el gestor cultural de referencia de Piura. La interfaz sigue al manual de marca: estructura en carbón (cabecera, pie, héroe), contenido claro y ordenado, y el rojo del Club como acento puntual, igual que en el logotipo, donde solo la palabra "arte" es roja. Sobria y segura, no festiva. Las fotos y los flyers de los eventos son los protagonistas; la interfaz los enmarca.

La plataforma es abierta a cualquier organizador, así que la marca del Club aparece como anfitrión (cabecera, pantalla de entrada, pie de la entrada con QR) y no se impone sobre la identidad de cada evento.

## Colors

La paleta sale del manual de marca (p. 17: negro, rojo `#ED3237`, gris claro `#BDBFC1`, gris medio `#727376`) y de cómo el propio manual la aplica: cabeceras en carbón `#272424`, texto y líneas del logotipo en `#373435`, fondos de página en `#F1F1F2`. En el manual, el rojo aparece solo en la palabra "arte" del logotipo, y en las versiones sobre fondo oscuro ni eso. Ese es el peso que tiene en la interfaz. `[Cambio de paleta, opción 1, Jean Pierre, 10/10/2026]`

- **Gris claro de página (`#F1F1F2`)** es el lienzo del contenido; **blanco (`#FFFFFF`)** para tarjetas, campos y la banda del buscador. `[Manual]`
- **Carbón (`#272424`)** es la estructura: cabecera, pie, héroe, barra inferior, panel de la pantalla de acceso y bandas de llamada a la acción. Sobre carbón, las tarjetas van en `#373435`. `[Manual]`
- **Texto (`#373435`)** es el tono de "cultura" en el logotipo: texto principal sobre claro. Secundario en `#6D6E71`, el gris de los textos del manual. Sobre carbón: blanco y `#BDBFC1`. `[Manual]`
- **Rojo del Club (`#ED3237`)** es acento, no superficie: el botón principal (uno por pantalla), el indicador del destino activo (3 px), la etiqueta "Destacado" y el subrayado de enlaces como "Ver todos". Con texto blanco de 16 px en negrita da 4,6:1. **Nunca** degradados rojos, fondos o bloques rojos, ni precios en rojo: el precio va en `ink-primary` y negrita. `[Manual]`
- **Gris medio (`#727376`)** para bordes de campos inactivos, iconos inactivos y texto deshabilitado. `[Manual]`
- **Línea fina (`#DCDCDE`)** separa tarjetas sin sombras; sobre carbón, `#3F3C3C`. `[Derivado]`
- **Estados (`state-success`, `state-warning`, `state-error`)** no existen en el manual; son tonos oscurecidos para leerse sobre claro. El error (`#C4262B`) es el rojo pulsado y siempre lleva icono y texto, para no confundirse con la acción. `[Derivado]`
- **Colores de precio del mapa (`price-1` a `price-4`)** distinguen categorías de precio en la pizarra y en el mapa del público, y solo se usan dentro del mapa. `[Derivado]`

**Superficies que siguen oscuras:** el escáner de la puerta y la pizarra o el mapa de butacas usan `surface-inverse` como fondo, por contraste al aire libre y para que se lean los colores de precio.

Evitar: degradados, el rojo como decoración o como fondo, negro puro como fondo de página, el rojo de acción para errores.

## Typography

Inter sustituye a Swis721 BT del manual, que es de pago y no se puede incrustar en la web; Inter es libre y de proporciones muy cercanas. La jerarquía sigue al manual: titulares en peso Black, cuerpo en Regular. `[Sustitución confirmada por Manuel Alexis, 10/10/2026]`

- **display** (28/900): nombre del evento en la ficha, cifra del panel.
- **title** (20/800): títulos de pantalla y de tarjeta.
- **body** (16/400): todo el texto corrido y los campos. Nunca por debajo de 16 px en formularios, para que iOS no amplíe la pantalla.
- **meta** (13/500): fechas, sede, etiquetas. Color `{colors.ink-secondary}`.
- **button** (16/700).

Sin mayúsculas sostenidas salvo siglas (APDAYC, IGV). Los precios se muestran como `S/ 25` con el IGV incluido.

## Layout & Spacing

Escala de 4 / 8 / 12 / 16 / 24 / 32 px. Diseño base a 360 px sin scroll horizontal. Tres anchos:

- **Móvil (< 768 px):** una columna con márgenes de `{spacing.margin-mobile}` (16 px). Navegación con barra inferior fija por rol.
- **Tableta (768–1023 px):** igual que móvil; las filas de eventos muestran 3 tarjetas.
- **Escritorio (≥ 1024 px):** contenedor de hasta `{spacing.container-max}` con márgenes de `{spacing.margin-desktop}`. Cabecera ancha con el menú del rol; **sin barra inferior**. Las filas de eventos muestran 5 tarjetas. Los formularios (acceso, alta, pago) siguen en una columna de `{spacing.form-max}` dentro del contenedor ancho. Ventas y Tablero usan el ancho completo.

La pizarra del mapa es la excepción en todos los anchos: ocupa todo el ancho y permite desplazarse y ampliar dentro de su lienzo. Objetivos táctiles de 48 px de alto como mínimo.

Estructura de referencia (tomada de Joinnus, con nuestra paleta): [`mockups/escritorio.html`](mockups/escritorio.html).

## Elevation & Depth

Sin sombras. La jerarquía se construye con tono: `{colors.surface-base}` → `{colors.surface-raised}` para tarjetas, hojas y diálogos, con una línea fina `{colors.border-hairline}`; la estructura va en `{colors.surface-inverse}`. Los diálogos llevan un velo carbón al 70 %.

## Shapes

`{rounded.md}` (12 px) para tarjetas, botones y hojas; `{rounded.sm}` (6 px) para campos y asientos; `{rounded.full}` para chips y filtros. Las imágenes de eventos siguen la esquina de su contenedor.

## Components

- **Botón primario** — fondo `{colors.accent}`, texto blanco 700, 48 px de alto, ancho completo en móvil. Uno por pantalla. Pulsado: `{colors.accent-pressed}`. Deshabilitado: fondo `{colors.border-hairline}`, texto `{colors.ink-muted}`.
- **Botón secundario** — contorno `{colors.ink-muted}`, sin relleno; texto `{colors.ink-primary}` sobre claro y blanco sobre carbón.
- **Tarjeta de evento** — fondo `{colors.surface-raised}` con línea fina; imagen 4:5 arriba; debajo, fecha (`10 OCT`) y distrito en `meta`, título en dos líneas como máximo y "Desde S/ X" con el importe en `ink-primary` negrita. Etiqueta "Destacado" roja sobre la imagen. Sin sombras.
- **Chip de filtro** — 32 px, activo con borde y texto `{colors.ink-primary}` y punto rojo; inactivo en `{colors.ink-secondary}`.
- **Campo** — 48 px, etiqueta visible encima (nunca solo placeholder), fondo blanco, borde `#BDBFC1`, borde de 2 px `{colors.ink-primary}` al enfocar. Error: borde y mensaje en `{colors.state-error}` con texto explicativo.
- **Aviso** — banda en `{colors.surface-raised}` con borde izquierdo de 3 px del color del estado, icono y texto.
- **Asiento** — 28 px de lado con área táctil de 44 px, esquina `{rounded.sm}`. Disponible: color de su categoría de precio. Vendido: `{colors.seat-sold}` con la X. En pago de otro comprador: `{colors.seat-held}`. Seleccionado: blanco con borde rojo. Todo estado lleva forma o símbolo además de color.
- **Entrada con QR** — tarjeta `{colors.surface-raised}`; el QR va sobre un cuadro blanco con margen de 16 px (necesario para que el escáner lo lea); debajo, sección, fila y asiento en `title`. Cabecera con el logotipo del Club.
- **Barra inferior** (solo < 1024 px) — fondo `{colors.surface-inverse}`, icono y etiqueta en `#BDBFC1`; destino activo en blanco con barra roja de 3 px.
- **Cabecera** — fondo `{colors.surface-inverse}`, 68 px, logotipo `logo-oscuro` a la izquierda. Móvil: logotipo y acción ("Ingresar" o avatar). Escritorio: menú del rol en texto (activo en blanco con subrayado rojo de 3 px) y, a la derecha, "Registrarse" (secundario) e "Ingresar" (primario), o el nombre de la cuenta con su menú. Sin sesión muestra el menú del público.
- **Buscador del catálogo** — banda blanca bajo la cabecera con la búsqueda y los filtros de fecha, distrito, precio y categoría. En escritorio, una fila con botón de búsqueda carbón; en móvil, búsqueda arriba y filtros como chips desplazables.
- **Héroe** — carrusel de destacados en `{colors.surface-inverse}`: el flyer del evento a un lado y, al otro, categoría, título en `display`, fecha y sede, botón primario y "Desde S/ X". Flechas y puntos, sin avance automático. En escritorio lleva a su derecha una columna de 1/4 con dos tarjetas: Piura Cultural Weekend (carbón) y "Publica tu evento" (blanca).
- **Fila de categorías** — tarjeta blanca con iconos de línea de 32 px y su etiqueta `meta`, desplazable en horizontal; la activa en negrita con punto rojo.
- **Fila de eventos** — título de sección en `title` con "Ver todos" (subrayado rojo) a la derecha; carrusel horizontal de tarjetas con flechas en escritorio y desplazamiento táctil en móvil.
- **Banda de llamada a la acción** — `{colors.surface-inverse}` a todo el ancho del contenedor, titular, una línea y un botón secundario; isotipo blanco al 12 % como marca de agua.
- **Pie** — `{colors.surface-inverse}`. Logotipo, enlaces (Sobre el Club, Preguntas frecuentes, Términos, Privacidad, Libro de reclamaciones), redes y "Contáctanos por WhatsApp". En móvil, por encima del hueco de la barra inferior.
- **Pantalla de acceso** — en escritorio, dos mitades: a la izquierda un panel `{colors.surface-inverse}` con el logotipo, el titular "Crea y vende tu evento con IA" y el flyer de un evento destacado; a la derecha, sobre blanco, "Volver", "¿No tienes cuenta? Regístrate" (o su inverso), `logo-claro`, "¡Bienvenido!" y el formulario. En móvil solo el formulario. La contraseña lleva un botón para mostrarla u ocultarla. El rol no se elige al entrar.
- **Logotipo e isotipo** — archivos recortados de los vectores del manual en `apps/web/public/marca/` (PNG y SVG): `logo-oscuro` sobre carbón, `logo-claro` sobre claro, `logo-blanco` monocromo, `isotipo` en grises e `isotipo-blanco`. Tamaños mínimos del manual: logotipo principal 2,6 cm, solo nombre 1,5 cm, isotipo 1,2 cm; en pantalla, no menos de 120 px, 80 px y 32 px. Isotipo sobre imágenes en blanco al 50 % de opacidad; nunca rotado ni recoloreado. Área segura alrededor: la altura de un triángulo del isotipo. `[Manual]`

## Do's and Don'ts

| Hacer | No hacer |
|---|---|
| Un solo botón rojo por pantalla; el rojo solo como acento | Rojo en bloques, fondos, degradados, decoración o precios |
| Texto legible en `{colors.ink-primary}` o `{colors.ink-secondary}` | Texto en `{colors.ink-muted}` que el usuario deba leer |
| Estructura en carbón `#272424` y contenido en `#F1F1F2` | Negro puro como fondo de página |
| Estado con texto y símbolo, además de color | Comunicar disponibilidad, error o selección solo con color |
| El QR sobre cuadro blanco | QR en blanco sobre carbón, o con transparencia |
| Mostrar el precio con IGV incluido: `S/ 25` | Precios sin IGV o con decimales de más |
| Rotular el pago como simulado | Pedir datos reales de tarjeta |
| Isotipo en blanco al 50 % sobre imágenes | Rotar o recolorear el isotipo |
| Tipografía Inter en Black y Regular | Más de dos pesos por pantalla |
