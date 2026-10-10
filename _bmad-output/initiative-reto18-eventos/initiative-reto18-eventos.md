---
type: initiative
title: "Plataforma regional de eventos culturales con marketing asistido por inteligencia artificial"
parent: none
covers: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7, CAP-8, CAP-9, CAP-10, CAP-11, CAP-12, CAP-13, CAP-14, CAP-15, CAP-16]
after: []
assignee: "Jean Pierre"
risk: high
---

# Plataforma regional de eventos culturales con marketing asistido por inteligencia artificial

## Description

Es la plataforma del Reto 18 (Hackathon Piura Innova) para el Club de Arte y Cultura. Los organizadores publican sus eventos y los promocionan con IA, el público compra con elección de butaca y entra con un QR, y el administrador modera y mide. La spec define las capacidades, los límites y lo que queda fuera. La arquitectura fija los contratos entre epics.

## Outcome

El jurado ve en vivo, en menos de 10 minutos, el flujo completo del criterio 8. Es la señal de éxito de la spec.

## Done when

1. El flujo de `demo-flow.md`, pasos 1 a 9, funciona en producción (Vercel + Railway + Supabase) en un ensayo cronometrado de menos de 10 minutos.
2. Cada criterio de la rúbrica, del 1 al 8, se puede mostrar en el modo indicado en `demo-flow.md`.
3. Hay un vídeo de respaldo de la demo completa grabado.
4. Cada dependencia externa (WhatsApp, Ollama, Claude, redes) se desconectó una vez en un ensayo, y la demo continuó con su respaldo.

## Boundaries

Se corta por capacidad, siguiendo el orden de la demo y con un responsable por epic. Lo que queda fuera está en los non-goals de la spec. Primer recorrido de punta a punta: un organizador crea un evento, el administrador lo aprueba, el público elige butaca y paga, recibe el QR, y el QR se valida en la puerta (epics 1 y 2).

- Touch point: Supabase (Auth, Postgres, Storage, Realtime) — proyecto, claves y RLS; owner: epic-base-roles-eventos
- Touch point: Vercel y Railway Hobby — proyectos, despliegue desde GitHub y variables; owner: epic-base-roles-eventos
- Touch point: Evolution API — instancia vinculada a un número de prueba; owner: epic-compra-butacas-acceso
- Touch point: Ollama en el PC de Jean Pierre y su túnel; API de Claude — modelo y claves; owner: epic-marketing-ia
- Touch point: Upload-Post o Zernio — cuenta e Instagram/Facebook del equipo conectados; owner: epic-marketing-ia

## References

- spec — _bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/spec-reto18-plataforma-eventos.md, section Capabilities
- spine — _bmad-output/initiative-reto18-eventos/architecture-reto18-plataforma-eventos/architecture-reto18-plataforma-eventos.md
- constraint — la misma spec, section Constraints (demo de menos de 10 minutos, coste mínimo, respaldo por dependencia)
- demo — _bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/demo-flow.md
- rúbrica — _bmad-output/initiative-reto18-eventos/reto.md, section Criterios de evaluación
- equipo — EQUIPO.md

## Notes

- Decision: 5 epics por capacidad, en el orden de la demo. El 5 (croquis con IA) es opcional (usuario, 10/10/2026).
- Decision: elegir butaca es imprescindible. La pizarra y la elección de butaca (CAP-15) van en el epic 2; la lectura del croquis con IA (CAP-16), en el epic 5 (usuario, 10/10/2026).
- Decision: responsables: epics 1 y 2, Jean Pierre; epics 3 y 4, Luis Armando; la interfaz de todos los epics, Manuel Alexis; el epic 5, quien termine primero. Sandro David no programa (usuario, 10/10/2026).
- Decision: cada historia con pantalla se parte en una historia API (conserva su id y su responsable) y una historia "UI:" con id nuevo para Manuel Alexis. Todas las UI esperan a la 1.7, sistema de diseño y layout móvil con la paleta de la plataforma (usuario, 10/10/2026). Reservas (quien termine primero si Manuel va cargado): 1.11, 3.10, 4.5 y 4.6.
- Decision: la arquitectura se fijó antes de dividir los epics en historias. Las decisiones que comparten varios epics viven en sus AD (usuario, 10/10/2026).
- Decision: CAP-3 se reparte: aprobación y moderación en el epic 1; la alerta de APDAYC con IA en el epic 3, que es el dueño del módulo `ia` (10/10/2026).
- Open question: ¿acepta el jurado el pago simulado para el criterio 3? Afecta al epic 2.
- Open question: preguntas abiertas de la spec (Ley 29733, verificación de eventos y de APDAYC, entregables y duración del pitch).
