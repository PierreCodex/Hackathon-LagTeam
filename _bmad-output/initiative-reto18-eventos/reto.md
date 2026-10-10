# Reto 18 · Plataforma regional de eventos culturales con marketing asistido por IA

**Presentado por:** Club de Arte y Cultura (Piura). Hackathon Piura Innova.
**Fuente:** `insumos/reto-original.jpeg`. La entrevista está en `evidencia.md`.

## Contexto

El Club de Arte y Cultura (Piura, 2019) forma talentos en actuación, canto, danza y desarrollo escénico, produce temporadas teatrales de más de mil espectadores y quiere ser el gestor cultural de referencia de la región: una plataforma para la oferta cultural de Piura, al estilo de las ticketeras nacionales pero pensada para la realidad regional.

## Problema central

- No existe un espacio digital que reúna la oferta cultural de la región. Los eventos se difunden dispersos en redes, grupos de WhatsApp y afiches, y el público no se entera a tiempo.
- La venta y el control de entradas son manuales: no se conoce el aforo real, hay duplicados y no se mide la asistencia.
- Muchos organizadores (artistas, colectivos y pequeñas empresas) no saben diseñar piezas gráficas ni gestionar publicidad pagada.

## Usuarios

| Rol | Quién |
|---|---|
| Administrador | Equipo gestor del Club (gestores culturales) |
| Organizador | Empresas, colectivos y artistas que organizan eventos |
| Público | Quien busca eventos y compra entradas |

## Criterios de evaluación → cómo los demostramos

Modo: **real** (funciona en vivo), **grabado** (vídeo de respaldo) o **simulado** (datos o servicio de prueba, dicho en voz alta). Es una propuesta inicial: se ajusta en la spec y en `demo-estado.md`.

| # | Criterio (resumen de la rúbrica) | Cómo lo demostramos | Modo propuesto |
|---|---|---|---|
| 1 | Web y celular, con tres roles y permisos diferenciados: administrador, organizador y público | Web *responsive*; entrar con los tres roles y enseñar que cada uno ve algo distinto, también en el móvil | Real |
| 2 | El organizador se registra, publica su evento (fecha, sede, aforo, tipos de entrada y precios) y ve sus ventas en un panel; el administrador aprueba, modera y destaca publicaciones | Registro, alta del evento, aprobación por el administrador y panel de ventas del organizador | Real (destacar puede ser simple) |
| 3 | Catálogo para el público con búsqueda y filtros (fecha, categoría, distrito y precio), compra con medios de pago de Perú (tarjeta, Yape o Plin, en modo de prueba) y entrega de la entrada digital con código QR | Buscar, filtrar, comprar con pasarela en modo de prueba y recibir el QR | Real (pago de prueba) |
| 4 | Control de acceso que valide el QR en la puerta, impida el uso duplicado y funcione con conectividad limitada | Escanear el QR desde el móvil: primera vez válido, segunda vez rechazado. Enseñar el modo sin conexión | Real; sin conexión, real o grabado |
| 5 | Asistente de marketing con IA que, a partir de la idea o los datos del evento, genere piezas gráficas para redes (publicación, historia y afiche), textos promocionales y una propuesta de campaña con público objetivo, presupuesto sugerido y calendario de publicaciones | Desde los datos del evento: tres piezas, textos y campaña generados en vivo | Real |
| 6 | Programar o exportar las campañas a redes (Facebook e Instagram) y medir alcance, clics y entradas vendidas por campaña con enlaces o códigos rastreables | Exportar (más rápido que integrar Meta) y enlace rastreable por campaña que cuente clics y ventas | Exportar y enlaces: real. Alcance en Meta: simulado |
| 7 | Modelo de ingresos configurable (comisión por entrada o tarifa por evento), liquidación a cada organizador y tablero analítico del administrador con ventas, asistencia, categorías y perfil del público, exportable a Excel | Configurar la comisión, ver la liquidación de un organizador, el tablero y descargar el Excel | Real con datos sembrados |
| 8 | **Demo:** un organizador nuevo se registra, describe su evento en pocas frases y obtiene la publicación, tres piezas gráficas y la propuesta de campaña; luego un usuario compra una entrada y la valida en la puerta con el QR, **todo en vivo y en menos de 10 minutos** | Es el flujo que debe funcionar sí o sí. Ensayado y cronometrado, con vídeo de respaldo | **Real** |

**Prioridad (equipo de cuatro):** el criterio 8 manda. Los criterios 2, 3, 4 y 5 forman parte de ese flujo y tienen que ser reales. Los criterios 6 y 7 se hacen en versión mínima y el resto se simula.

## Entregables

En la imagen del reto, los apartados **Datos**, **Documentación** y **Mentoría** están en blanco. **Pendiente:** preguntar a los organizadores qué hay que entregar y en qué formato.

## Por confirmar con los organizadores

- [ ] Contenido de los entregables (Datos, Documentación y Mentoría)
- [ ] Duración del pitch
- [ ] Si se exige una pasarela concreta para el pago de prueba
