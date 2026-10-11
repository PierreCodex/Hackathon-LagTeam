---
type: epic
title: "Croquis con IA (opcional)"
parent: initiative-reto18-eventos
covers: [CAP-16]
after: []
assignee: ""
risk: high
---

# Croquis con IA (opcional)

## Description

El organizador sube la imagen del croquis de su local, y la IA (API de Claude) llena la pizarra con las secciones, las filas y los bloques que reconoce. Después, el organizador solo corrige. Es opcional: la demo funciona sin este epic, armando el mapa a mano en la pizarra.

## Outcome

En la demo, el croquis de ejemplo se convierte en el mapa casi completo en pocos segundos. Corresponde al paso 1 de `demo-flow.md`.

## Requirements

Los de la spec, por su id: CAP-16.

## Done when

1. En producción, con cada uno de los croquis de ejemplo, la pizarra sale casi completa, y el organizador la deja igual al original con pocas correcciones.
2. La propuesta de la IA no se guarda hasta que el organizador la confirma en la pizarra (AD-4, AD-11).
3. Si la API de Claude falla o tarda demasiado, la pizarra se abre vacía y se arma a mano.

## Boundaries

Se corta por capacidad. Incluye el adaptador de la API de Claude, la función `leerCroquis` del módulo `ia` y la subida del croquis. La pizarra es del epic 2. Lo que queda fuera está en los non-goals de la spec.

## References

- parent — _bmad-output/initiative-reto18-eventos/initiative-reto18-eventos.md
- spec — _bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/spec-reto18-plataforma-eventos.md, CAP-16
- spine — _bmad-output/initiative-reto18-eventos/architecture-reto18-plataforma-eventos/architecture-reto18-plataforma-eventos.md, AD-4 y AD-11
- mapa — _bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/mapa-asientos.md
- croquis — _bmad-output/initiative-reto18-eventos/insumos/ (las dos imágenes de WhatsApp)

## Notes

- Waits on epic-compra-butacas-acceso because: necesita la pizarra que recibe la propuesta.
- Waits on epic-marketing-ia because: necesita el módulo `ia` de la historia 3.1. El adaptador de la API de Claude lo construye este epic, porque solo él lo usa (10/10/2026).
- Decision: se construye solo cuando el flujo principal de la demo funciona. El responsable es quien termine primero (usuario, 10/10/2026).
- Decision: flujo del evento: alta (`pendiente`) → aprobación (1.5) → mapa del local (croquis con IA del epic 5 y/o pizarra 2.9) → publicar → ventas. Solo los eventos aprobados y publicados salen al público; publicar exige capacidad suficiente y cierra el mapa del local (AD-4). Cada sede tiene dueño: solo él edita su mapa y los demás la usan o la duplican a su nombre. La publicación se construye en la 2.3; la 1.6 filtra por `publicado`, la 1.10 y la 2.9 llevan al organizador a "Arma el mapa y publica", y el epic 5 entra en el flujo con la pizarra manual como respaldo (Jean Pierre, 10/10/2026).
- Unknown: si hay una clave de la API de Claude con saldo.
