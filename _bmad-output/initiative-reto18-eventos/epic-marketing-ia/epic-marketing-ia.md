---
type: epic
title: "Marketing con IA"
parent: initiative-reto18-eventos
covers: [CAP-8, CAP-9, CAP-10, CAP-14]
after: []
assignee: "Luis Armando"
risk: high
---

# Marketing con IA

## Description

A partir de los datos del evento, la IA escribe los textos para cada red, la campaña y la paleta, y las plantillas generan los flyers en cuatro formatos. Las piezas se publican en Instagram y Facebook, o se exportan. Cada pieza lleva un enlace rastreable. El administrador genera el Piura Cultural Weekend. Este epic también es dueño del módulo `ia`, por lo que incluye la alerta de APDAYC que se muestra en la aprobación.

## Outcome

En la demo, el evento recién creado sale con sus piezas, sus textos y su campaña generados en vivo. Una compra hecha desde el enlace de una pieza queda contada, y el evento aparece en el afiche del Weekend. Corresponde a los pasos 3, 4 y 9 de `demo-flow.md`.

## Requirements

Los de la spec, por su id: CAP-8, CAP-9, CAP-10 y CAP-14. Además:

- E1 (CAP-3): la alerta de APDAYC de la IA se muestra en la pantalla de aprobación del epic 1.

## Done when

1. En producción, para un evento aprobado y las redes que marca el organizador, se generan en vivo los flyers (9:16, 4:5, 16:9 y A4), el texto de cada red y la campaña. Fecha, sede y precio coinciden con el alta (AD-11, AD-12).
2. Una pieza se publica en una cuenta de Instagram del equipo con un botón. Si falla, se descarga, se copia el texto y llega el aviso por WhatsApp.
3. Cada clic en `/r/:codigo` queda registrado, y una compra hecha desde ese enlace aparece asignada a su pieza (AD-8).
4. "Generar Weekend" incluye en el afiche colectivo el evento aprobado minutos antes.
5. Un evento de "Muestra de arte" que menciona un DJ en vivo muestra la alerta en la aprobación. Si Ollama o el túnel no responden, la IA devuelve su respaldo y la demo sigue.

## Boundaries

Se corta por capacidad. Incluye los módulos `marketing` e `ia`, y las plantillas de piezas en `apps/web`. No incluye el envío de WhatsApp en sí (`notificaciones`, epic 2), los paneles (epic 4) ni la lectura del croquis (epic 5). Lo que queda fuera está en los non-goals de la spec.

## References

- parent — _bmad-output/initiative-reto18-eventos/initiative-reto18-eventos.md
- spec — _bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/spec-reto18-plataforma-eventos.md, CAP-3, CAP-8, CAP-9, CAP-10 y CAP-14
- spine — _bmad-output/initiative-reto18-eventos/architecture-reto18-plataforma-eventos/architecture-reto18-plataforma-eventos.md, AD-8, AD-9, AD-11 y AD-12
- piezas — _bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/piezas-marketing.md
- servicios — _bmad-output/initiative-reto18-eventos/insumos/apis.md

## Notes

- Waits on epic-base-roles-eventos because: necesita los datos del evento aprobado y la pantalla de aprobación donde va la alerta.
- Waits on epic-compra-butacas-acceso because: necesita el servicio de notificaciones, las órdenes que guardan `ref` y la lectura de ventas por `ref`.
- Decision: sin la historia de cierre "Repaso final de limpieza", por el tiempo de la hackathon (usuario, 10/10/2026).
- Decision: cada función de IA va en su propio archivo (`ia/funciones/<nombre>.ts`) para que las historias en paralelo no choquen. El adaptador de Claude es del epic 5 (10/10/2026).
- Decision: Ollama en el PC de Jean Pierre para los textos, con la API de Claude solo para el croquis (usuario, 10/10/2026).
- Unknown: el modelo de Ollama, y si el plan gratuito de Upload-Post o Zernio permite publicar y programar. Hay que comprobarlo al empezar la publicación.
- Decision: cada historia con pantalla se parte en una historia API (conserva su id y su responsable) y una historia "UI:" con id nuevo para Manuel Alexis; todas las UI esperan a la 1.7, sistema de diseño y layout móvil con la paleta de la plataforma (usuario, 10/10/2026).
- Decision: la 3.4 no se parte; el botón "Publicar ahora" lo añade Luis Armando a la pantalla de la 3.9. La 3.6 tampoco: la alerta se muestra en el hueco de la 1.10 (10/10/2026).
- Decision: Sandro David toma la 3.6 y la parte manual de la 3.4 (cuenta de publicación y redes) para aliviar a Luis Armando; sus PRs los acepta Jean Pierre. Sigue con su rol de P1 (usuario, 10/10/2026).
- Decision: Sandro David y Manuel Alexis intercambian roles, porque Manuel no puede usar Claude Code. Sandro pasa a P3 y construye todas las historias "UI:" (y la 3.6) a partir del DESIGN.md de Manuel; Manuel pasa a P1: aceptación funcional de los PRs, validación de las 19:00, pitch y la parte manual de la 3.4. Jean Pierre revisa el código de todos (usuario, 10/10/2026).
