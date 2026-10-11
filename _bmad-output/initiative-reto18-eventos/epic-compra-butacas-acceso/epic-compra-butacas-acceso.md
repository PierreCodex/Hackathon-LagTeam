---
type: epic
title: "Compra, butacas y acceso"
parent: initiative-reto18-eventos
covers: [CAP-5, CAP-6, CAP-7, CAP-15]
after: []
assignee: "Jean Pierre"
risk: high
---

# Compra, butacas y acceso

## Description

El organizador arma el mapa de su local en la pizarra. El público se registra con su WhatsApp, elige butaca o compra entradas de zona general, y paga con el pago simulado. Recibe el QR por WhatsApp, y en la puerta el QR se valida una sola vez, también sin conexión. Es la parte de la demo con más riesgo técnico, por el bloqueo de butacas y el escaneo sin conexión.

## Outcome

El jurado compra una butaca desde su móvil, recibe el QR por WhatsApp y entra. Al segundo intento, el QR se rechaza. Corresponde a los pasos 5 a 7 de `demo-flow.md`.

## Requirements

Los de la spec, por su id: CAP-5, CAP-6, CAP-7 y CAP-15. La pizarra edita el mapa de la sede del módulo `eventos` (AD-4). El inventario, las órdenes, el pago, las entradas, la configuración de comisión, el acceso y las notificaciones son de este epic.

## Done when

1. En producción, desde los croquis de ejemplo, el organizador arma el mapa en la pizarra con sus filas, bloques, numeración y precios por rango.
2. Dos compradores eligen la misma butaca a la vez y solo uno consigue bloquearla. Si el bloqueo vence sin pago, la butaca se libera. Nunca se vende por encima del aforo, y la venta se cierra a la hora de inicio (AD-5).
3. Tras el pago simulado, la orden queda pagada con su comisión congelada (AD-6, AD-10). El QR llega por WhatsApp desde Evolution API y aparece en "Mis entradas".
4. El escaneo en la puerta acepta el QR la primera vez y lo rechaza la segunda. Sin conexión, valida contra el manifiesto local y sincroniza al volver la conexión (AD-7).
5. Si se corta Evolution API, la compra sigue y el QR está en "Mis entradas" (AD-9).

## Boundaries

Se corta por capacidad. Incluye los módulos `ventas`, `acceso` y `notificaciones`, y la pizarra dentro de `eventos`. La lectura del croquis con IA es del epic 5. Los paneles de ventas son del epic 4. Lo que queda fuera está en los non-goals de la spec.

## References

- parent — _bmad-output/initiative-reto18-eventos/initiative-reto18-eventos.md
- spec — _bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/spec-reto18-plataforma-eventos.md, CAP-5, CAP-6, CAP-7 y CAP-15
- spine — _bmad-output/initiative-reto18-eventos/architecture-reto18-plataforma-eventos/architecture-reto18-plataforma-eventos.md, AD-4 a AD-10
- mapa — _bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/mapa-asientos.md
- croquis — _bmad-output/initiative-reto18-eventos/insumos/ (las dos imágenes de WhatsApp)

## Notes

- Waits on epic-base-roles-eventos because: necesita el monorepo desplegado, la autenticación con roles, el modelo de sede y mapa, y eventos aprobados con categorías de precio.
- Decision: el pago es simulado, sin API de pasarela, detrás de la interfaz `PasarelaPago` (usuario, 10/10/2026).
- Decision: la configuración de comisión vive en `ventas`, con un valor por defecto de comisión por entrada; el epic 4 la edita (AD-10).
- Decision: sin la historia de cierre "Repaso final de limpieza", por el tiempo de la hackathon (usuario, 10/10/2026).
- Decision: el primer recorrido es una compra de zona general con QR y puerta en línea. La pizarra (historias 3 y 4) avanza en paralelo. La historia 1 crea `notificaciones.encolar()` como esqueleto para que la 2 no choque con la confirmación del pago (10/10/2026).
- Decision: los precios por asiento son un dato del evento en el módulo `eventos`, y `ventas` los copia al inventario (AD-4) (10/10/2026).
- Open question: ¿acepta el jurado el pago simulado para el criterio 3?
- Unknown: si Evolution API envía la imagen del QR de forma estable con un número de prueba. Hay que comprobarlo al empezar el envío por WhatsApp.
- Decision: cada historia con pantalla se parte en una historia API (conserva su id y su responsable) y una historia "UI:" con id nuevo para Manuel Alexis; todas las UI esperan a la 1.7, sistema de diseño y layout móvil con la paleta de la plataforma (usuario, 10/10/2026).
- Decision: el primer recorrido de punta a punta son la 2.1 (API) y la 2.8 (UI) juntas; la 2.8 envía el ?ref= con la orden (10/10/2026).
- Decision: el manifiesto de la puerta sin conexión lleva la lista de códigos válidos del evento, nunca el secreto HMAC; el móvil valida comprobando la lista (usuario, 10/10/2026).
- Decision: Sandro David y Manuel Alexis intercambian roles, porque Manuel no puede usar Claude Code. Sandro pasa a P3 y construye todas las historias "UI:" (y la 3.6) a partir del DESIGN.md de Manuel; Manuel pasa a P1: aceptación funcional de los PRs, validación de las 19:00, pitch y la parte manual de la 3.4. Jean Pierre revisa el código de todos (usuario, 10/10/2026).
- Decision: la web deja de ser solo móvil: desde 1024 px usa la estructura tipo Joinnus (cabecera ancha con el menú del rol, contenedor de 1280 px, pie, sin barra inferior) y la paleta del manual (estructura carbón #272424, contenido claro #F1F1F2, rojo solo como acento) con el logotipo real. Nueva historia 1.12 antes de las UI pendientes; la 1.11 se reescribe como portada. Propuesta: change-layout-escritorio-estilo-joinnus (Jean Pierre, 10/10/2026).
- Decision: Manuel Alexis vuelve a programar (ya puede usar Claude Code) y las historias "UI:" se reparten por epic: Sandro David, epic 1 (1.12, 1.11, 1.9, 1.10) y epic 3 (3.8, 3.9, 3.10, y la 3.6); Manuel Alexis, epic 2 (2.8 a 2.12) y epic 4 (4.4, 4.5, 4.6). Aceptación funcional cruzada entre los dos; Jean Pierre revisa el código. Manuel conserva la validación de las 19:00 y el pitch; la parte manual de la 3.4 vuelve a Sandro David. Reservas para quien termine primero: 1.11, 3.10, 4.5 y 4.6 (Jean Pierre, 10/10/2026).
- Decision: flujo del evento: alta (`pendiente`) → aprobación (1.5) → mapa del local (croquis con IA del epic 5 y/o pizarra 2.9) → publicar → ventas. Solo los eventos aprobados y publicados salen al público; publicar exige capacidad suficiente y cierra el mapa del local (AD-4). Cada sede tiene dueño: solo él edita su mapa y los demás la usan o la duplican a su nombre. La publicación se construye en la 2.3; la 1.6 filtra por `publicado`, la 1.10 y la 2.9 llevan al organizador a "Arma el mapa y publica", y el epic 5 entra en el flujo con la pizarra manual como respaldo (Jean Pierre, 10/10/2026).
