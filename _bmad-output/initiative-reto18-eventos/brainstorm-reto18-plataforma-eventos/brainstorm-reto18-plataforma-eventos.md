---
type: brainstorm-intent
initiative: initiative-reto18-eventos
source: .memlog.md
date: 2026-10-10
status: pendiente de validar por el equipo
---

# Intención: Reto 18, plataforma de eventos culturales de Piura con marketing asistido por IA

Destilado de la sesión de brainstorming. Sirve de entrada para `bmad-spec` o `bmad-product-brief`. Contexto completo: `../reto.md` y `../evidencia.md`.

## Tesis

El diferencial no es la IA, porque todos los equipos la usan. Es **la red cultural de Piura**: el único sitio donde están todos los eventos de la región, con una IA pensada para su realidad (WhatsApp, público de Sullana y Talara, APDAYC). Frase del pitch: *"No vendemos entradas: encendemos la agenda cultural de Piura cada fin de semana."*

## Flujo de la demo (criterio 8, menos de 10 minutos, en vivo)

El hilo conductor es el **enlace rastreable**, que conecta marketing, venta, acceso y medición.

1. **Organizador nuevo** se registra y da de alta su evento con el **formulario híbrido**.
2. **Administrador** aprueba el evento, viendo la **alerta de APDAYC de la IA**.
3. **IA** genera los flyers para las redes elegidas, el texto de cada red y la campaña, cada pieza con su enlace rastreable. Publicación real en Instagram y Facebook, si se confirma la API.
4. **Un miembro del jurado** compra desde un enlace, con su móvil y el pago de prueba.
5. **El QR le llega por WhatsApp** (Evolution API). Respaldo: QR en pantalla.
6. **Puerta:** el QR vale la primera vez y se rechaza la segunda.
7. **Panel del organizador:** la venta aparece asignada a la pieza que la generó.
8. **Cierre:** "Generar Weekend". El evento nuevo aparece en el afiche colectivo del fin de semana.

## Decisiones

### Alta y moderación del evento
- **Formulario híbrido.** Campos para vender (fecha, sede, distrito, aforo, categoría, tipos de entrada por zona con precio) y una caja libre de 2 o 3 frases que la IA usa para el marketing. Cumple la frase del criterio 8 *"describe su evento en pocas frases"*. Sin audio, por tiempo.
- **Ningún evento se publica sin aprobación** del administrador.
- **APDAYC:**
  - Pregunta obligatoria *"¿Habrá música en vivo o grabada?"*. Si la respuesta es sí, se exige subir la constancia, sea cual sea la categoría.
  - La IA revisa el título, la descripción y la imagen, y avisa al administrador si detecta música aunque la categoría diga lo contrario.

### Asistente de marketing con IA (criterios 5 y 6)
- **Redes:** Instagram, Facebook, X, TikTok y WhatsApp. El organizador marca las suyas y solo se generan esas piezas.
- **Flyers con plantillas por familia de formato**, renderizados de HTML a PNG. No se usa generación de imagen pura, para ganar velocidad y no tener errores en fechas y precios.

  | Formato | Tamaño | Para |
  |---|---|---|
  | Vertical 9:16 | 1080 × 1920 | Historias, estados de WhatsApp, TikTok |
  | Feed 4:5 | 1080 × 1350 | Publicaciones de Instagram y Facebook |
  | Horizontal 16:9 | 1600 × 900 | X, portada de Facebook |
  | A4 | Imprimible | Afiche con QR rastreable |

- **Texto por red** en una sola llamada a la IA:
  - Instagram: emojis y hashtags locales.
  - Facebook: largo e informativo.
  - WhatsApp: corto, con enlace.
  - X: una frase.
- **Campaña en lenguaje sencillo:** público objetivo, presupuesto en soles repartido y calendario de publicaciones.
- **Un enlace rastreable por pieza:** clics y ventas por pieza en el panel del organizador.
- **Publicación:**
  - Instagram y Facebook se publican automáticamente con una API unificada en plan gratis (Upload-Post o Zernio).
  - TikTok y X se exportan.
  - Respaldo sin coste: en cada fecha del calendario, aviso al organizador por WhatsApp con la pieza y el texto listos.
- **Un solo estilo de piezas** en la demo.

### Público: compra y entrada
- El público se registra con **WhatsApp obligatorio** (*"aquí te llegará tu entrada"*), ciudad o distrito opcional y una casilla para aceptar avisos.
- En el pago, el número aparece ya escrito y se puede cambiar si la entrada es para otra persona.
- Tras el pago, el **QR llega por WhatsApp** y queda guardado en "Mis entradas".
- **Dos canales de marketing:**
  - Las redes captan público con mensajes generales, sin datos personales. El origen se mide con enlaces rastreables por zona o grupo.
  - WhatsApp fideliza a quienes ya compraron, con los datos que dejaron en la plataforma.

### Piura Cultural Weekend (cierre de la demo)
- Cada semana se agrupan los eventos aprobados de viernes a domingo.
- La IA genera el nombre, el afiche colectivo, la historia, una ruta sugerida y un mensaje de WhatsApp.
- El administrador lo aprueba con un clic.
- Cada organizador recibe su pieza "Parte del Weekend", con su enlace.
- Se comparte con el botón "Compartir por WhatsApp" (enlace wa.me), no con envío masivo.

## Para el pitch, no para la demo
- **Semáforo de ventas:** ventas reales frente a las esperadas, con una pieza sugerida cuando el evento va lento.
- **Calendario de campaña conectado al semáforo.**
- **Pasaporte cultural:** sellos por compra, entrada gratis por fidelidad y rutas de fin de semana.
- **Combo cruzado:** recomendar el evento a quien compró en eventos parecidos.
- **Declaración jurada** del organizador e **historial de confianza** ("organizador verificado").
- **Mapa de demanda:** Sullana y Talara como público que hoy nadie atiende.
- **Producción:** pasar de Evolution API a la API oficial de WhatsApp de Meta, y de los planes gratis a planes de pago cuando haya ingresos por comisión.

## Descartado
- **Metricool:** cuesta dinero; la API está en planes de pago.
- **Alta del evento por audio.**
- **Generar varios estilos de piezas en vivo.**
- **API de X:** se paga por publicación.

## Por validar
- **P2 (prueba técnica):**
  - Evolution API: montaje y envío de imagen.
  - Plan gratis de Upload-Post o Zernio: si permite programar y cuánto se tarda en conectar Instagram.
- **Con el Club:**
  - Qué exige APDAYC (por categoría o por uso de música) y quién lo verifica.
  - Si el modelo de comisión por defecto es por entrada.
- **Legal:** consentimiento para guardar WhatsApp y ciudad (Ley 29733 de protección de datos personales).
- **Riesgo de evidencia:** solo hay un entrevistado. Conviene contrastar con un artista independiente y con alguien del público.
