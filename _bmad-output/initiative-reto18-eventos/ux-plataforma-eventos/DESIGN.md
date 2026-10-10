---
name: Club de Arte & Cultura · Plataforma de eventos
description: Identidad visual de la plataforma de eventos culturales de Piura. Oscura por defecto, negro y rojo del manual de marca, móvil primero a 360 px.
status: final
updated: 2026-10-10
sources:
  - imports/manual-de-marca.pdf
colors:
  surface-base: '#000000'
  surface-raised: '#141414'
  surface-overlay: '#1E1F20'
  border-hairline: '#2E2F31'
  ink-primary: '#FFFFFF'
  ink-secondary: '#BDBFC1'
  ink-muted: '#727376'
  accent: '#ED3237'
  accent-pressed: '#C4262B'
  on-accent: '#FFFFFF'
  state-success: '#3DBE7A'
  state-warning: '#F2A900'
  state-error: '#FF6B6F'
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
    borderColor: '{colors.ink-muted}'
    rounded: '{rounded.sm}'
    height: 48px
  chip:
    backgroundColor: '{colors.surface-overlay}'
    textColor: '{colors.ink-secondary}'
    rounded: '{rounded.full}'
    height: 32px
---

## Brand & Style

Club de Arte & Cultura quiere ser el gestor cultural de referencia de Piura. La interfaz tiene que sentirse como una sala antes de que suba el telón: oscura, con el escenario (el contenido del evento) iluminado y un solo color de acción, el rojo del Club. Sobria y segura, no festiva. Las fotos y los flyers de los eventos son los protagonistas; la interfaz los enmarca.

La plataforma es abierta a cualquier organizador, así que la marca del Club aparece como anfitrión (cabecera, pantalla de entrada, pie de la entrada con QR) y no se impone sobre la identidad de cada evento.

## Colors

La paleta sale del manual de marca: negro, rojo, dos grises y blanco. Los demás valores son derivados necesarios para una interfaz y están marcados como tales.

- **Negro (`#000000`)** es el lienzo. Mantiene el contraste máximo al aire libre y deja que las imágenes destaquen. `[Manual]`
- **Rojo del Club (`#ED3237`)** es el único color de acción: botón principal, precio destacado, estado seleccionado de navegación. Sobre negro da contraste 4,6:1, apto para texto de 16 px en negrita o más. `[Manual]`
- **Gris claro (`#BDBFC1`)** es el texto secundario. Contraste 11:1 sobre negro. `[Manual]`
- **Gris medio (`#727376`)** solo para bordes de campos, iconos inactivos y texto deshabilitado. Sobre negro da 4,4:1: **no se usa para texto que haya que leer.** `[Manual]`
- **Blanco (`#FFFFFF`)** es el texto principal y el asiento seleccionado. `[Manual]`
- **Superficies (`#141414`, `#1E1F20`) y línea fina (`#2E2F31`)** son tonos derivados del negro para separar tarjetas sin sombras. `[Derivado]`
- **Estados (`state-success`, `state-warning`, `state-error`)** no existen en el manual. El error usa un rojo aclarado (`#FF6B6F`) distinto del rojo de acción para no confundir "error" con "pulsa aquí". Siempre llevan texto, nunca solo color. `[Derivado]`
- **Colores de precio del mapa (`price-1` a `price-4`)** distinguen categorías de precio en la pizarra y en el mapa del público. Son los únicos colores fuera del manual y solo se usan dentro del mapa. El gris `seat-sold` marca los vendidos, como en los croquis de ejemplo. `[Derivado]`

Evitar: degradados, fondos blancos grandes, el rojo como decoración o como fondo de bloques de texto, el rojo de acción para errores.

## Typography

Inter sustituye a Swis721 BT del manual, que es de pago y no se puede incrustar en la web; Inter es libre y de proporciones muy cercanas. La jerarquía sigue al manual: titulares en peso Black, cuerpo en Regular. `[Sustitución confirmada por Manuel Alexis, 10/10/2026]`

- **display** (28/900): nombre del evento en la ficha, cifra del panel.
- **title** (20/800): títulos de pantalla y de tarjeta.
- **body** (16/400): todo el texto corrido y los campos. Nunca por debajo de 16 px en formularios, para que iOS no amplíe la pantalla.
- **meta** (13/500): fechas, sede, etiquetas. Color `{colors.ink-secondary}`.
- **button** (16/700).

Sin mayúsculas sostenidas salvo siglas (APDAYC, IGV). Los precios se muestran como `S/ 25` con el IGV incluido.

## Layout & Spacing

Escala de 4 / 8 / 12 / 16 / 24 / 32 px. Una sola columna con márgenes de `{spacing.margin-mobile}` (16 px). Diseño base a 360 px sin scroll horizontal; a partir de 768 px el contenido se centra en un máximo de 480 px para formularios y entradas, y el catálogo pasa a rejilla de 2 a 3 columnas. La pizarra del mapa es la excepción: usa todo el ancho y permite desplazarse y ampliar dentro de su lienzo.

Objetivos táctiles de 48 px de alto como mínimo. La navegación principal es una barra inferior fija con tres a cinco destinos según el rol.

## Elevation & Depth

Sin sombras. La jerarquía se construye con tono: `{colors.surface-base}` → `{colors.surface-raised}` → `{colors.surface-overlay}` para hojas inferiores y diálogos, y con una línea fina `{colors.border-hairline}`. Los diálogos llevan un velo negro al 70 %.

## Shapes

`{rounded.md}` (12 px) para tarjetas, botones y hojas; `{rounded.sm}` (6 px) para campos y asientos; `{rounded.full}` para chips y filtros. Las imágenes de eventos siguen la esquina de su contenedor.

## Components

- **Botón primario** — fondo `{colors.accent}`, texto blanco 700, 48 px de alto, ancho completo en móvil. Uno por pantalla. Pulsado: `{colors.accent-pressed}`. Deshabilitado: fondo `{colors.surface-overlay}`, texto `{colors.ink-muted}`.
- **Botón secundario** — contorno `{colors.ink-muted}`, texto blanco, sin relleno.
- **Tarjeta de evento** — imagen 4:5 arriba, título en `title`, fecha y sede en `meta`, precio "Desde S/ X" en rojo y negrita. Sin sombras.
- **Chip de filtro** — 32 px, activo con borde y texto blancos y punto rojo; inactivo en `{colors.ink-secondary}`.
- **Campo** — 48 px, etiqueta visible encima (nunca solo placeholder), borde `{colors.ink-muted}`, borde blanco al enfocar. Error: borde y mensaje en `{colors.state-error}` con texto explicativo.
- **Aviso** — banda en `{colors.surface-overlay}` con borde izquierdo de 3 px del color del estado, icono y texto.
- **Asiento** — 28 px de lado con área táctil de 44 px, esquina `{rounded.sm}`. Disponible: color de su categoría de precio. Vendido: `{colors.seat-sold}` con la X. En pago de otro comprador: `{colors.seat-held}`. Seleccionado: blanco con borde rojo. Todo estado lleva forma o símbolo además de color.
- **Entrada con QR** — tarjeta `{colors.surface-raised}`; el QR va sobre un cuadro blanco con margen de 16 px (necesario para que el escáner lo lea); debajo, sección, fila y asiento en `title`. Cabecera con el logotipo del Club.
- **Barra inferior** — fondo negro, icono y etiqueta; destino activo en blanco con barra roja de 2 px.
- **Logotipo e isotipo** — en blanco sobre negro. Tamaños mínimos del manual: logotipo principal 2,6 cm, solo nombre 1,5 cm, isotipo 1,2 cm; en pantalla, no menos de 120 px, 80 px y 32 px. Isotipo sobre imágenes en blanco al 50 % de opacidad; nunca rotado ni recoloreado. Área segura alrededor: la altura de un triángulo del isotipo. `[Manual]`

## Do's and Don'ts

| Hacer | No hacer |
|---|---|
| Un solo botón rojo por pantalla | Rojo en bloques grandes, fondos o decoración |
| Texto legible en `{colors.ink-primary}` o `{colors.ink-secondary}` | Texto en `{colors.ink-muted}` que el usuario deba leer |
| Estado con texto y símbolo, además de color | Comunicar disponibilidad, error o selección solo con color |
| El QR sobre cuadro blanco | QR en blanco sobre negro, o con transparencia |
| Mostrar el precio con IGV incluido: `S/ 25` | Precios sin IGV o con decimales de más |
| Rotular el pago como simulado | Pedir datos reales de tarjeta |
| Isotipo en blanco al 50 % sobre imágenes | Rotar o recolorear el isotipo |
| Tipografía Inter en Black y Regular | Más de dos pesos por pantalla |
