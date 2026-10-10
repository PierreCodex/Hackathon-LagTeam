---
id: SPEC-reto18-plataforma-eventos
companions:
  - demo-flow.md
  - piezas-marketing.md
  - mapa-asientos.md
  - ../reto.md
  - ../evidencia.md
  - ../insumos/apis.md
  - ../architecture-reto18-plataforma-eventos/architecture-reto18-plataforma-eventos.md
sources:
  - ../brainstorm-reto18-plataforma-eventos/brainstorm-reto18-plataforma-eventos.md
---

> **Contrato canónico.** Esta spec y los archivos de `companions:` son el contrato completo de qué construir, probar y validar. Los documentos de `sources:` solo sirven para la trazabilidad.

# Plataforma de eventos culturales de Piura con marketing asistido por IA

## Why

**Dolor y oportunidad.** En Piura, la oferta cultural se difunde dispersa por redes, WhatsApp y afiches, y el público no se entera a tiempo. La venta de entradas es manual (Excel y WhatsApp), con duplicados y sin control del aforo. La mayoría de organizadores (artistas, colectivos y pequeñas productoras) no sabe diseñar piezas ni campañas. El Club de Arte y Cultura quiere ser el gestor cultural de referencia de la región con una plataforma abierta a cualquier organizador.

El diferencial frente a Teleticket, y frente a la ticketera interna que el propio Club está construyendo, no es la IA, porque todos los equipos la usan. Es **la red cultural de Piura**: el único lugar donde están todos los eventos de la región, con una IA adaptada a esa realidad (WhatsApp, público de Sullana y Talara, APDAYC). La entrega es una demo en vivo para el jurado de la Hackathon Piura Innova.

## Capabilities

- **CAP-1**
  - **intent:** Administrador, organizador y público acceden con permisos diferenciados desde la web y el móvil.
  - **success:** Al entrar con cada uno de los tres roles en un móvil, cada uno ve solo sus funciones y no puede acceder a las de los otros roles.
- **CAP-2**
  - **intent:** Un organizador se registra y da de alta un evento indicando fecha, sede, distrito, aforo, categoría, tipos de entrada por zona con su precio, y una descripción libre de 2 o 3 frases. Debe responder si habrá música en vivo o grabada y, si la respuesta es sí, subir la constancia de APDAYC.
  - **success:** Un organizador nuevo completa el registro y el alta en menos de 2 minutos durante la demo, y el evento queda "pendiente de aprobación". Si marca que hay música y no sube la constancia, el alta no se completa.
- **CAP-3**
  - **intent:** El administrador revisa, aprueba, rechaza y destaca eventos. La IA le avisa cuando el contenido sugiere música sin constancia de APDAYC.
  - **success:** Un evento sin aprobar no aparece en el catálogo. Un evento con la categoría "Muestra de arte" y una descripción que menciona un DJ en vivo muestra la alerta en la pantalla de aprobación.
- **CAP-4**
  - **intent:** El público encuentra eventos con búsqueda, filtros por fecha, categoría, distrito y precio, y una vista de calendario mensual.
  - **success:** Al combinar filtros, solo aparecen los eventos aprobados que cumplen todos los criterios. El calendario muestra los eventos del mes.
- **CAP-5**
  - **intent:** Una persona del público se registra con su WhatsApp y compra entradas con un pago simulado dentro de la plataforma, eligiendo tarjeta, Yape o Plin.
  - **success:** Una compra con pago simulado se completa desde un móvil, y en la demo se dice en voz alta que el pago es simulado. No se pueden vender más entradas que el aforo de cada zona. La venta se cierra a la hora de inicio del evento.
- **CAP-6**
  - **intent:** Quien compra recibe su entrada con un código QR por WhatsApp y la tiene también en "Mis entradas".
  - **success:** El QR llega al WhatsApp del comprador segundos después del pago. Si el envío falla, el mismo QR sigue disponible en "Mis entradas".
- **CAP-7**
  - **intent:** El personal de la puerta valida entradas escaneando el QR con un móvil, incluso con conectividad limitada.
  - **success:** Un QR válido se acepta la primera vez y se rechaza la segunda. El escaneo sin conexión valida contra los datos guardados en el dispositivo y sincroniza al recuperar la conexión. Esto se muestra en vivo o en vídeo.
- **CAP-8**
  - **intent:** Desde los datos y las frases del evento, el asistente de IA genera flyers para las redes que elige el organizador, un texto para cada red y una propuesta de campaña con público objetivo, presupuesto en soles y calendario de publicaciones, todo en lenguaje sencillo.
  - **success:** En la demo, las piezas, los textos y la campaña se generan en vivo para el evento recién creado, y las fechas, precios y sedes coinciden con el alta.
- **CAP-9**
  - **intent:** El organizador publica las piezas en Instagram y Facebook desde la plataforma, y exporta las de TikTok y X. En cada fecha del calendario recibe un aviso por WhatsApp con la pieza y el texto listos.
  - **success:** Una publicación sale en una cuenta de Instagram del equipo con un solo botón. Si eso falla, las piezas se descargan, el texto se copia y el aviso por WhatsApp llega.
- **CAP-10**
  - **intent:** Cada pieza y cada campaña llevan un enlace rastreable que registra clics y ventas.
  - **success:** Una compra hecha desde un enlace aparece asignada a esa pieza en el panel del organizador.
- **CAP-11**
  - **intent:** El organizador ve sus ventas por evento, por tipo de entrada y por pieza de marketing.
  - **success:** El panel refleja la compra de la demo segundos después de hacerla.
- **CAP-12**
  - **intent:** El administrador configura el modelo de ingresos (comisión por entrada o tarifa por evento) y consulta la liquidación de cada organizador.
  - **success:** Al cambiar la comisión, cambia el importe a liquidar mostrado para un organizador con ventas sembradas.
- **CAP-13**
  - **intent:** El administrador consulta un tablero con ventas, asistencia, categorías y perfil del público, y lo exporta a Excel.
  - **success:** El tablero muestra datos sembrados y los de la demo, y el Excel se descarga y se abre con esas cifras.
- **CAP-14**
  - **intent:** El administrador genera con IA el paquete "Piura Cultural Weekend" con los eventos aprobados de viernes a domingo: nombre, afiche colectivo, historia, ruta sugerida y mensaje de WhatsApp. Cada organizador recibe su pieza "Parte del Weekend".
  - **success:** Al pulsar "Generar Weekend" en la demo, el evento creado minutos antes aparece en el afiche colectivo.
- **CAP-15**
  - **intent:** El organizador arma el mapa de su local en una pizarra visual organizada por secciones, filas y bloques separados por pasillos. Puede quitar un asiento tocándolo, añadir asientos al final de una fila, añadir o quitar filas, y asignar categorías de precio seleccionando rangos de asientos. El público elige su butaca en ese mismo mapa (`mapa-asientos.md`).
  - **success:** Partiendo de la pizarra vacía, el organizador reproduce uno de los croquis de ejemplo con sus filas, sus bloques, su numeración y sus colores de precio. El jurado elige una butaca y su QR indica sección, fila y asiento. La butaca elegida queda bloqueada para otros compradores durante el pago.
- **CAP-16**
  - **intent:** El organizador sube el croquis de su local y la IA llena la pizarra de CAP-15 con las secciones, las filas y los bloques que reconoce, para que el organizador solo corrija lo que falte o sobre.
  - **success:** Con los croquis de ejemplo, la pizarra sale casi completa, y el organizador la deja igual al original con pocas correcciones.

## Constraints

- La demo del criterio 8 se hace en vivo y en menos de 10 minutos, de principio a fin (`demo-flow.md`). Lo que no sirva a ese flujo se recorta o se simula.
- El equipo es de 4 personas y tiene unas 24 horas. Coste mínimo: 5 USD al mes de Railway Hobby. Todo lo demás, en planes gratuitos o de código abierto.
- No se integra ninguna API de pasarela de pago. El pago es simulado y no pide datos reales de tarjeta.
- Cada dependencia externa de la demo (WhatsApp, publicación en redes, IA) tiene un respaldo que no rompe el flujo.
- WhatsApp se envía desde un número de prueba del equipo, nunca desde el número del Club.
- Las fechas, los precios y las sedes de las piezas tienen que ser exactos. Esos textos no los dibuja un modelo de imagen (`piezas-marketing.md`).
- El alcance geográfico es Piura.
- No hay un mapa genérico: cada local tiene el suyo. Conviven zonas numeradas, donde se elige butaca, y zonas no numeradas, que se venden por cantidad.
- Una butaca nunca se vende dos veces: queda bloqueada durante 10 minutos mientras se paga y se libera si el pago no se completa.
- Lo que propone la IA sobre el croquis nunca llega al público sin que el organizador lo revise y lo guarde en la pizarra.
- Los precios se muestran con el IGV (18 %) incluido.

## Non-goals

- Alta del evento por audio.
- Integración directa con las APIs de Meta, TikTok o X, y uso de Metricool.
- Vídeo y banners generados por IA.
- Generar varios estilos de piezas por evento.
- Envío masivo o automático de WhatsApp al público. Se comparte con el botón "Compartir por WhatsApp".
- Cargos internos del Club. Hay un único rol de administrador.
- Registro de incidencias, y reglas de comisión por categoría o aforo.
- Fidelización más allá de guardar el contacto del comprador.
- Cumplimiento de la Ley CONADIS.
- Semáforo de ventas, pasaporte cultural, combo cruzado, declaración jurada y confianza del organizador. Se presentan solo en el pitch (`demo-flow.md`).

## Success signal

- En el ensayo cronometrado y ante el jurado, sin cortes y en menos de 10 minutos: un organizador nuevo crea su evento; el administrador lo aprueba; la IA genera las piezas y la campaña; un miembro del jurado compra desde un enlace rastreable con su propio móvil y recibe el QR por WhatsApp; ese QR entra en la puerta y se rechaza al segundo intento; y el evento aparece en el afiche del Weekend.

## Assumptions

- La constancia de APDAYC se exige cuando hay música, en vivo o grabada, y no según la categoría.
- Pedir el WhatsApp como dato obligatorio en el registro del público es aceptable.
- Para la demo basta con que el administrador revise los eventos a mano para evitar estafas.
- La opción por defecto del modelo de ingresos es la comisión por entrada.
- La lectura del croquis con IA (CAP-16) se construye después del flujo principal de la demo. Elegir butaca (CAP-15) es obligatorio.
- El plan gratuito de Upload-Post o de Zernio permite publicar en Instagram y Facebook desde la API.
- Evolution API puede enviar la imagen del QR de forma estable durante la demo.

## Open Questions

- ¿Acepta el jurado un pago simulado para el criterio 3, o exige una pasarela concreta en modo de prueba?
- ¿Qué consentimiento exige la Ley 29733 para guardar el WhatsApp y la ciudad del comprador?
- ¿Quién verifica los eventos en el Club, y con qué criterios?
- ¿Qué exige exactamente APDAYC, y cómo se comprueba que la constancia es auténtica?
- ¿El plan gratuito de Upload-Post o de Zernio permite programar publicaciones, o solo publicar al momento?
- ¿Se guardan los locales como sedes reutilizables, para que el siguiente organizador encuentre el mapa ya hecho?
- ¿Qué entregables (Datos, Documentación, Mentoría) y qué duración de pitch exige la organización?
