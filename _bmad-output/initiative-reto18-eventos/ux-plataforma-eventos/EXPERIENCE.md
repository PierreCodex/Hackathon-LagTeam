---
name: Club de Arte & Cultura · Plataforma de eventos
status: final
updated: 2026-10-10
sources:
  - ../spec-reto18-plataforma-eventos/spec-reto18-plataforma-eventos.md
  - ../spec-reto18-plataforma-eventos/demo-flow.md
  - ../spec-reto18-plataforma-eventos/mapa-asientos.md
  - ../spec-reto18-plataforma-eventos/piezas-marketing.md
---

# Plataforma de eventos de Piura: espina de experiencia

> Visual: `DESIGN.md` (los tokens se citan como `{colors.accent}`). Esta espina manda sobre cualquier maqueta. Todo lo que no está aquí se decide en la historia que lo construye.

## Foundation

Web móvil primero (Next.js), a 360 px, sin app nativa. Cuatro tipos de usuario con un solo inicio de sesión y menús distintos por rol: **público**, **organizador**, **administrador** y **puerta** (personal que escanea; es una vista del organizador/administrador, instalable como PWA). Sistema de UI: lo elige la historia 1.7 `[ASSUMPTION: Tailwind + componentes tipo shadcn/ui; DESIGN.md define los tokens, la librería solo los aplica]`. Idioma: español de Perú.

**Construcción con datos simulados.** Cada pantalla se construye primero contra datos de muestra (los stubs de los contratos y la semilla) y se conecta a la API real cuando el ticket de API correspondiente se fusiona. Por eso toda pantalla debe poder renderizarse con una fuente de datos intercambiable y mostrar sus estados (cargando, vacío, error) desde el primer día.

## Information Architecture

| Superficie | Rol | Se llega desde | Propósito | Historia |
|---|---|---|---|---|
| Catálogo y calendario | Público (sin sesión) | Inicio, enlaces rastreables `/r/…` | Buscar y filtrar eventos aprobados | 1.11 |
| Ficha del evento | Público | Catálogo, enlace de pieza | Ver el evento y empezar la compra | 1.11 |
| Registro / inicio de sesión | Todos | Al comprar, o desde la cabecera | Entrar con WhatsApp obligatorio | 1.8 |
| Elegir butaca | Público | Ficha | Escoger asiento o cantidad | 2.11 |
| Pago simulado | Público | Elegir butaca | Tarjeta, Yape o Plin, dicho como simulado | 2.8 |
| Mis entradas | Público | Barra inferior | QR por entrada, sección, fila y asiento | 2.8 |
| Alta de evento | Organizador | Barra inferior | Formulario en pasos, con APDAYC | 1.9 |
| Pizarra del mapa | Organizador | Alta de evento / Sedes | Crear la sede y pintar precios | 2.9, 2.10 |
| Marketing | Organizador | Evento → Marketing | Flyer, textos, campaña, publicar | 3.8, 3.9 |
| Ventas | Organizador | Barra inferior | Ventas por evento, categoría y pieza | 4.4 |
| Aprobación | Administrador | Barra inferior | Aprobar, rechazar, destacar | 1.10 |
| Weekend | Administrador | Barra inferior | Afiche colectivo y piezas | 3.10 |
| Comisión y liquidación | Administrador | Barra inferior | Configurar y liquidar | 4.5 |
| Tablero | Administrador | Barra inferior | Cifras y Excel | 4.6 |
| Escáner de puerta | Puerta | Barra inferior | Validar QR, también sin conexión | 2.12 |

Barra inferior fija por rol: **Público** Eventos · Calendario · Mis entradas · Cuenta. **Organizador** Mis eventos · Marketing · Ventas · Cuenta. **Administrador** Aprobar · Weekend · Tablero · Cuenta. **Puerta** Escanear · Registro. Sin menú hamburguesa. Una hoja modal como máximo, nunca dos.

→ Composición de referencia: [`mockups/catalogo.html`](mockups/catalogo.html), [`mockups/mapa-y-compra.html`](mockups/mapa-y-compra.html), [`mockups/mis-entradas.html`](mockups/mis-entradas.html), [`mockups/marketing.html`](mockups/marketing.html). La espina manda en caso de conflicto.

## Voice and Tone

Microcopia. La postura visual vive en `DESIGN.md`. Voz cercana, clara y respetuosa; trato de **tú**; frases cortas. Sin jerga técnica (el organizador no sabe diseñar ni vender). Las cifras y fechas siempre exactas.

| Hacer | No hacer |
|---|---|
| "Tu entrada está lista. Muéstrala en la puerta." | "Transacción completada con éxito" |
| "Pago simulado: no se cobra nada." | Omitir que el pago es simulado |
| "Esa butaca la acaba de elegir otra persona. Elige otra." | "Error 409" |
| "Falta la constancia de APDAYC para publicar con música." | "Campo requerido" |
| "No pudimos enviar el WhatsApp. Tu QR sigue aquí, en Mis entradas." | "Falló el envío" |
| "Aún no hay eventos con esos filtros." | Pantalla en blanco |

## Component Patterns

Comportamiento. El aspecto vive en `DESIGN.md.Components`.

| Componente | Uso | Reglas de comportamiento |
|---|---|---|
| Tarjeta de evento | Catálogo, calendario | Toda la tarjeta es un toque que abre la ficha. Muestra "Desde S/ X". |
| Chips de filtro | Catálogo | Fecha, categoría, distrito y precio. Se acumulan; el resultado se actualiza al cambiar. "Limpiar" siempre visible si hay filtros. |
| Formulario en pasos | Alta de evento | Un tema por paso: datos, sede, entradas, descripción, música. Barra de avance. Se guarda el borrador al pasar de paso. Si marca música sin constancia no se puede enviar y se dice por qué. |
| Pizarra del mapa | Organizador | Toca un asiento: lo quita. "+" al final de una fila: añade un asiento. Añadir/quitar fila completa. Seleccionar rango arrastrando; luego elegir categoría y se pinta. Zoom con pellizco y desplazamiento. Una sede con eventos aprobados no se edita: se duplica. |
| Mapa de butacas | Público | Toca un asiento disponible: se marca. Vendido o bloqueado: no responde, con aviso. Se actualiza en tiempo real sin recargar. Resumen fijo abajo con asiento, precio y botón "Pagar". |
| Cuenta atrás de bloqueo | Pago | Muestra los 10 minutos de la butaca. Al vencer, vuelve al mapa con el aviso. |
| Entrada con QR | Mis entradas | QR siempre visible sin pasos extra; brillo de pantalla al máximo al abrirlo. |
| Pieza de marketing | Marketing | Vista previa 4:5, botones Descargar, Copiar texto, Compartir por WhatsApp y Publicar. "Publicar" solo existe para Instagram y Facebook; TikTok y X: Descargar y Copiar. |
| Escáner | Puerta | Cámara a pantalla completa. Resultado en grande y con color y texto: ACEPTADA, YA USADA, NO VÁLIDA. |

## State Patterns

| Estado | Superficie | Tratamiento |
|---|---|---|
| Cargando | Cualquier lista o pieza | Esqueleto con la forma final; la IA muestra "Generando tu campaña…" con pasos. |
| Vacío | Catálogo, Mis entradas, Ventas | Mensaje y un solo camino: "Aún no tienes entradas. Mira los eventos". |
| Error de red | Cualquier pantalla | Aviso con "Reintentar"; lo ya escrito en formularios se conserva. |
| Sin permiso | Rutas de otro rol | Pantalla "Esta sección es para organizadores" con vuelta al inicio. La API responde 403. |
| Butaca perdida | Mapa de butacas | Aviso, el asiento pasa a gris y la selección se limpia. |
| Bloqueo vencido | Pago | "Se acabó el tiempo. Tu butaca quedó libre." y vuelta al mapa. |
| IA no disponible | Marketing, Aprobación | Se muestra la respuesta de respaldo con una nota, sin bloquear el flujo. |
| WhatsApp falló | Compra | La compra se completa y el QR queda en Mis entradas. |
| Sin conexión | Escáner | Banda "Sin conexión: validando en este móvil"; los escaneos se guardan y se sincronizan al volver. |
| Conflicto de sincronización | Escáner | Un QR usado en dos móviles queda en el registro de conflictos; gana el primero que llegó. |
| Reducir movimiento | Todas | Sin animaciones decorativas; las transiciones son cortes. |

## Interaction Primitives

- Toque para actuar. Sin gestos ocultos; la pizarra usa pellizco y arrastre solo dentro de su lienzo.
- El botón primario de cada pantalla está al alcance del pulgar, anclado abajo cuando hay una acción de avance.
- Confirmación solo en acciones destructivas o irreversibles (rechazar evento, pagar).
- **Prohibido:** carruseles automáticos, ventanas emergentes de bienvenida, notificaciones de reenganche, contadores de insistencia, pedir datos reales de tarjeta.

## Accessibility Floor

Comportamiento. El contraste visual vive en `DESIGN.md`.

- Contraste mínimo AA: texto de 16 px o más en negrita sobre rojo, y `ink-secondary` para texto secundario. Nada legible en `ink-muted`.
- Objetivos táctiles de 48 px; los asientos tienen área táctil de 44 px.
- Todo estado tiene texto o símbolo además de color: asientos disponibles, vendidos y seleccionados; aceptada/rechazada en el escáner.
- Etiquetas visibles en cada campo; el error se anuncia y se asocia al campo.
- El mapa de butacas ofrece una **alternativa en lista** ("Elegir por sección y fila") para quien no pueda usar el lienzo.
- Orden de foco igual al orden de lectura; foco visible en blanco.
- Lectores de pantalla: cada asiento anuncia "Platea baja, fila A, asiento 7, S/ 60, disponible".
- Mover o ampliar nunca es el único modo de llegar a un asiento.

## Inspiration & Anti-patterns

- **Tomado de Teleticket y Joinnus:** el mapa de butacas con colores por precio y el resumen fijo abajo, pero sin pasos de compra innecesarios.
- **Rechazado, la compra con cuenta obligatoria antes de ver el evento:** el catálogo y la ficha son públicos; solo se pide el registro al pagar.
- **Rechazado, la presentación de IA como protagonista:** la IA aparece como resultado ("Tu flyer está listo"), no como chat. El organizador revisa lo que propone antes de publicar.
- **Rechazado, el editor libre del mapa:** la pizarra se limita a secciones, filas y bloques.

## Responsive & Platform

Móvil primero. A partir de 768 px: formularios y entradas centrados a 480 px; catálogo en rejilla de 2 a 3 columnas; Ventas y Tablero pueden usar tablas completas. La puerta y la compra se prueban en móvil real; el administrador puede trabajar en portátil.

## Key Flows

### Flow 1 — Alta del evento (Lucía, organizadora de una compañía de teatro, entre ensayos)

1. Lucía se registra con su WhatsApp y entra como organizadora.
2. Abre "Nuevo evento" y completa el paso de datos: título, fecha, distrito.
3. Elige su sede en la lista o crea una de zona general con aforo.
4. Define las categorías de precio con el IGV incluido.
5. Escribe dos frases sobre la obra.
6. Responde "¿Habrá música?" Sí, y sube la constancia de APDAYC.
7. Pulsa "Enviar a aprobación".
8. **Clímax:** ve "Tu evento está pendiente de aprobación" y, debajo, "Mientras tanto, prepara tu campaña" con un solo botón: Marketing.

Fallo: marca música sin constancia → el botón se desactiva y el motivo aparece junto al campo.

### Flow 2 — Compra desde un enlace (Marco, miembro del jurado, con su propio móvil)

1. Marco abre en su móvil el enlace de la pieza y ve la ficha del evento.
2. Pulsa "Elegir butaca" y se le pide registrarse con su WhatsApp.
3. En el mapa elige una butaca de platea en rojo; el resumen abajo muestra sección, fila, asiento y S/ 60.
4. Pulsa "Pagar" y elige Yape. Un aviso dice "Pago simulado: no se cobra nada".
5. Confirma.
6. **Clímax:** aparece su entrada con el QR grande y "Platea baja · Fila A · Asiento 7". Segundos después le llega el mismo QR por WhatsApp.

Fallo: otra persona tomó la butaca → aviso, el asiento pasa a gris, vuelve al mapa.

### Flow 3 — Escaneo en la puerta (Rosa, personal de la puerta)

1. Rosa abre Escanear en el móvil del evento.
2. Apunta la cámara al QR de Marco.
3. **Clímax:** pantalla verde, "ACEPTADA", con sección, fila y asiento.
4. Vuelve a escanear el mismo QR: pantalla roja, "YA USADA" con la hora del primer uso.

Sin conexión: la banda lo avisa y valida igualmente; al volver, sincroniza.

### Flow 4 — Aprobar y destacar (Diego, administrador del Club)

1. Diego abre Aprobar y ve el evento de Lucía como pendiente.
2. Lee la descripción y la constancia; la IA muestra una alerta si la descripción sugiere música sin constancia.
3. Pulsa "Aprobar" y marca "Destacar".
4. **Clímax:** el evento aparece primero en el catálogo.

### Flow 5 — Campaña y Weekend (Lucía y Diego)

1. Lucía abre Marketing de su evento y pulsa "Generar".
2. Elige sus redes: Instagram y Facebook.
3. **Clímax:** ve el flyer 4:5 con la fecha, la sede y el precio exactos y la campaña con presupuesto en soles.
4. Pulsa "Publicar ahora".
5. Diego abre Weekend y pulsa "Generar Weekend"; el evento de Lucía aparece en el afiche colectivo.
