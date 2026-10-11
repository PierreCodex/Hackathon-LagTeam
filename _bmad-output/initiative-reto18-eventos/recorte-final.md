# Recorte final: 5 horas para cerrar la propuesta

Decidido el 11/10/2026. Quedan 5 horas y unas 25 historias, así que se corta según la rúbrica (`reto.md`) y el flujo de `spec-reto18-plataforma-eventos/demo-flow.md`: el criterio 8 manda. Jean Pierre queda fuera del reparto por ahora; la carga se reparte entre Manuel Alexis, Luis Armando y Sandro David.

Ya en `main`: epic 1 completo, 2.1, 2.3, 2.4, 2.8, 2.9, 3.1, 3.2 y 3.8.

## Bloques: cada uno es API y UI de punta a punta, con una sola persona responsable

| Persona | Bloque | Historias | Criterio | Versión mínima |
|---|---|---|---|---|
| Manuel Alexis | **A. Elegir butaca y comprarla** | 2.5, 2.6, 2.11 y 2.10 reducida | 3 y 8 | Mapa del evento con butacas libres u ocupadas. Una restricción única en la BD evita la doble venta, sin bloqueo temporal. El precio sale del rango de 2.4, sin pintarlo en la pizarra. |
| Luis Armando | **C. Comisión, liquidación, tablero y Excel** + datos sembrados | 4.2, 4.3, 4.5 y 4.6 | 7 | La comisión es un % configurable. La liquidación es una tabla por organizador. El tablero va con datos sembrados y el Excel se exporta a `.xlsx`. |
| Sandro David | **D. Piezas por red y exportar** | 3.3 y 3.9 reducidas | 5 y 6 | Publicación, historia y afiche, con un texto por red. Botones para descargar la pieza y copiar el texto. |
| Sandro David | **B. Panel de ventas del organizador** | 4.1 y 4.4 | 2 y paso 8 de la demo | Entradas vendidas, ingresos y ventas por pieza, con el `ref` de 3.2. |
| Quien termine primero | **E. Puerta sin conexión** (opcional) | 2.7 y 2.12 | 4 | Guarda en el móvil la lista de QR del evento y valida contra ella. Si no llega, se usa el vídeo grabado. |

**Punto de choque:** B y C leen las mismas órdenes pagadas. Luis Armando publica primero (en unos 30 min) la consulta base de ventas por evento, y Sandro construye B encima.

## Cortadas: se cuentan en el pitch o se simulan

- 2.2 QR por WhatsApp: el QR se enseña en "Mis entradas".
- 3.4 Publicar en Instagram y Facebook y 3.5 Avisos por WhatsApp: se exporta (criterio 6).
- 3.6 Alerta de APDAYC: la aprobación va sin alerta.
- 3.7 y 3.10 Weekend: afiche pregenerado o solo en el pitch.
- 2.13 Mapa tipo cine, 2.14 y 2.15 Google Places.
- Epic 5 completo (croquis con IA).

## Calendario

| Hora | Qué |
|---|---|
| 0:00 a 3:00 | Construir los bloques. Cada uno ensaya su parte de la demo en local. |
| 3:00 a 4:00 | Fusionar en `main`, sembrar datos y desplegar (Vercel, Railway y Supabase). Responsable: Luis Armando. |
| 4:00 a 5:00 | Ensayo cronometrado de la demo (menos de 10 min), vídeo de respaldo y correcciones. |

## Proceso rápido

- Una rama y un PR por bloque (`feat/<bloque>`), sin `story-*-plan.md` ni revisión con varios revisores.
- Antes del PR: `pnpm build && pnpm lint && pnpm test`. Un compañero lo revisa en 5 minutos y se fusiona.
