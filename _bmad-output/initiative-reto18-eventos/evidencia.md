# Evidencia

Fuentes:
- **E1:** entrevista con el Club de Arte y Cultura (`insumos/notas-entrevistas/entrevista-01.md`). Participan Producer, Cultural Manager y Event Organizer. El minuto va entre corchetes.
- **N1:** datos adicionales anotados por el equipo (`insumos/notas-entrevistas/datosatenerencuenta.md`).
- **R:** reto oficial (`insumos/reto-original.jpeg`).

**Hecho:** lo que dijeron o está escrito. **Interpretación:** lo que deducimos. **Supuesto:** lo que creemos sin pruebas y hay que validar.

## Dolores del organizador

| # | Hecho | Interpretación | Supuesto | Fuente |
|---|---|---|---|---|
| 1 | Las productoras locales gestionan ventas, marketing y difusión solo por redes y no tienen tiempo para crear materiales | El asistente de IA ahorra tiempo, que es el recurso escaso | Un organizador aceptará piezas generadas con pocos retoques | E1 [0:08] |
| 2 | Piden que la IA genere flyers, vídeos, textos para redes, volantes imprimibles, banners y una guía de ventas | El reto exige publicación, historia y afiche. Vídeo y banners quedan fuera del MVP | — | E1 [0:08], R |
| 3 | Aunque paguen publicidad, tras publicar aparecen comentarios de gente que no sabía que había teatro en Piura | El problema es el alcance y el descubrimiento, no solo crear piezas | Un catálogo central atraerá público nuevo | E1 [0:08] |
| 4 | La mayoría de organizadores no sabe diseñar la campaña ni gestionar publicidad | La campaña propuesta (público, presupuesto y calendario) debe ser guiada y en lenguaje simple | — | N1, R |
| 5 | Llevaban las entradas en Excel y un error humano vendió la misma entrada a dos personas | Hay que impedir duplicados en la venta (aforo) y en la puerta (QR de un solo uso) | — | E1 [4:02], R |
| 6 | Antes vendían por WhatsApp: consultar asientos libres, informar zonas, reservar, recibir el voucher y registrar la venta. Hoy también venden por teléfono | La compra en línea sustituye un proceso manual largo | — | E1 [8:21], [25:12] |

## Plataforma y modelo

| # | Hecho | Interpretación | Supuesto | Fuente |
|---|---|---|---|---|
| 7 | Quieren una plataforma abierta donde cualquier organización publique sus eventos y venda entradas, como una ticketera tipo Teleticket, y que sirva de ventana para ver qué hacer cada fin de semana | Mercado de dos lados: organizadores y público | — | E1 [4:02], [19:02] |
| 8 | Tres perfiles: gestores (su equipo hace unas seis producciones al año), otras organizaciones con menos difusión y público | Coincide con los tres roles del reto | — | E1 [10:04], R |
| 9 | En el equipo gestor hay administrador general, director comercial y asistente operativo. Event Organizer lo resume en administrador, organizador y público | En el MVP basta con un único rol de administrador | Los cargos internos no hacen falta para la demo | E1 [16:11] |
| 10 | Quieren un calendario mensual de eventos culturales (por ejemplo, todo octubre en Piura) | Vista de calendario o filtro por fecha en el catálogo | — | E1 [10:04] |
| 11 | Categorías mencionadas: conciertos, muestras de arte y pintura, teatro, eventos para niños y capacitaciones | Lista inicial de categorías, ampliable por el administrador | — | E1 [10:04], [16:11] |
| 12 | Propuesta: la plataforma recauda, gestiona la pasarela, descuenta sus costes y transfiere al organizador | Hace falta liquidación por organizador (criterio 7 del reto) | El modelo de recaudación sigue siendo una propuesta, no una decisión | E1 [19:02] |
| 13 | Trabajan por entrada y con comisión por entrada. La tarifa podría depender de la categoría, los participantes y el aforo. La ganancia por entrada la configura el administrador | Comisión configurable por el administrador. Las reglas por categoría o aforo quedan fuera del MVP | — | E1 [19:02], N1 |
| 14 | El organizador necesita usuarios propios para administrar los datos de su evento | Cuenta de organizador con autoservicio | — | E1 [16:11], [19:02] |
| 15 | La venta de entradas termina al inicio del evento | Regla: cerrar la venta a la hora de inicio | — | N1 |

## Confianza y verificación

| # | Hecho | Interpretación | Supuesto | Fuente |
|---|---|---|---|---|
| 16 | No han definido si se publica directamente o con revisión, pero consideran necesario verificar que el evento sea real para evitar estafas que dañen a la institución | Flujo de aprobación por el administrador antes de publicar (el reto también lo pide) | Basta con una revisión manual para la demo | E1 [13:24], R |
| 17 | Si falla la plataforma (caída o entrada duplicada), el incidente lo revisa primero el equipo de la plataforma y luego se coordina con el organizador. Las colas en el evento son cosa del organizador | Registro de incidencias: fuera del MVP | — | E1 [22:23] |
| 18 | Cada evento tiene un aforo y el sistema debe evitar problemas de capacidad | La venta se bloquea al llegar al aforo | — | E1 [22:23] |
| 19 | Validar el pago a APDAYC con un motor de reglas por definir y comprobar la credibilidad del pago | Requisito de cumplimiento poco definido | Fuera del MVP; se menciona en el pitch como siguiente paso | N1 |

## Público y alcance

| # | Hecho | Interpretación | Supuesto | Fuente |
|---|---|---|---|---|
| 20 | Público principal en Piura, de unos 25 a 60 años. Llegan asistentes de Sullana y Talara, aunque los horarios frenan a algunos | Filtro por distrito o ciudad. Diseño legible para adultos | — | E1 [4:02], [8:21] |
| 21 | Foco inicial en Piura, con la posibilidad de crecer a la región | MVP solo para Piura | — | E1 [19:02] |
| 22 | Usan sobre todo Instagram y Twitter, y contactan a asistentes anteriores por WhatsApp, no por correo | Compartir por WhatsApp es más útil que el correo | — | E1 [0:08] |
| 23 | Quieren conectar con campañas de Meta y programarlas por evento. El reto pide programar **o exportar** | Exportar las piezas más un enlace rastreable es lo viable en 24 h | La API de Meta no se integra en el evento | E1 [10:04], R |
| 24 | Quieren fidelización: que la relación entre organizador y cliente continúe | Guardar el contacto del comprador para el organizador | Fuera del MVP, salvo exportar los compradores | E1 [13:24], N1 |

## Espacios y asientos

| # | Hecho | Interpretación | Supuesto | Fuente |
|---|---|---|---|---|
| 25 | Ya están desarrollando una ticketera interna solo para sus obras de teatro | Nuestra propuesta se diferencia por ser abierta y para todo tipo de evento | — | E1 [25:12] |
| 26 | Las sedes (Teatro Municipal, Auditorio Nacional) tienen zonas que cambian según el lugar; para conciertos u otros formatos el croquis es distinto. El organizador define el espacio | MVP con tipos de entrada por zona (General, VIP…) y no con mapa de asientos | Las zonas como tipos de entrada bastan para la demo | E1 [25:12], R |

## Impuestos y normativa (por investigar)

| # | Hecho | Interpretación | Supuesto | Fuente |
|---|---|---|---|---|
| 27 | IGV del 18 % | Mostrar el precio con IGV incluido | — | N1 |
| 28 | Ley CONADIS: 20 % (por investigar) | Sin confirmar qué exige | No entra en el MVP hasta confirmarlo | N1 |

## Material ofrecido y pendiente de recibir

- [ ] Manual de marca y paleta de colores del Club (E1 [13:24])
- [ ] Captura del croquis de asientos (E1 [25:12])

## Preguntas abiertas

- ¿Quién verifica los eventos y con qué criterios? (E1 [13:24])
- ¿Qué medios de pago y qué especificación concreta? Se mencionó, pero quedó sin aclarar (E1 [16:11])
- ¿Comisión por entrada o tarifa por evento como opción por defecto? (E1 [19:02], R)
- ¿Qué exige exactamente la Ley CONADIS? (N1)

## Lectura para el brainstorming

Hay **un solo entrevistado (el cliente del reto)**: tenemos un dolor claro, pero sin contrastar con organizadores independientes ni con público. Si da tiempo, conviene validar con 2 o 3 personas más (mentores, un artista o colectivo, alguien del público) antes de la decisión GO o en la validación de las 19:00.
