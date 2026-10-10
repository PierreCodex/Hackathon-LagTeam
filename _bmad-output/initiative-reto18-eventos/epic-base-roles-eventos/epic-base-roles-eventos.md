---
type: epic
title: "Base, roles y eventos"
parent: initiative-reto18-eventos
covers: [CAP-1, CAP-2, CAP-3, CAP-4]
after: []
assignee: "Jean Pierre"
risk: medium
---

# Base, roles y eventos

## Description

Es el epic que abre: la base de la plataforma. Monta el monorepo, el despliegue y Supabase. Luego entran los tres roles, el alta del evento por el organizador (formulario híbrido, sede con mapa y pregunta de APDAYC), la aprobación por el administrador y el catálogo público con filtros y calendario.

## Outcome

Un organizador nuevo publica un evento que, una vez aprobado, el público encuentra en el catálogo desde el móvil. Corresponde a los pasos 1 y 2 de `demo-flow.md`.

## Requirements

Los de la spec, por su id: CAP-1, CAP-2, CAP-3 (aprobación, rechazo y destacado; la alerta de la IA es del epic 3) y CAP-4. Este epic deja los datos de la sede y su mapa (AD-4), pero no la pizarra, que es del epic 2.

## Done when

1. En producción (Vercel, Railway y Supabase), un administrador, un organizador y una persona del público inician sesión desde el móvil, y cada uno ve solo lo de su rol. La API rechaza las peticiones que no son de su rol (AD-3).
2. Un organizador nuevo da de alta un evento, con su sede, tipos de entrada con precio y descripción, en menos de 2 minutos. Si hay música y no sube la constancia de APDAYC, el alta no se completa.
3. Un evento pendiente no aparece en el catálogo. Una vez aprobado, sí aparece, y el destacado se ve primero.
4. Al combinar los filtros de fecha, categoría, distrito y precio, solo aparecen los eventos aprobados que los cumplen, y el calendario muestra los eventos del mes.
5. `supabase/seed.sql` carga la sede de ejemplo (los croquis de `insumos/`) y los eventos de la demo.

## Boundaries

Se corta por capacidad. Incluye los módulos `identidad` y `eventos` (sin la pizarra) y la base de la plataforma. No incluye compra, butacas ni puerta (epic 2), ni IA (epic 3). Lo que queda fuera está en los non-goals de la spec.

## References

- parent — _bmad-output/initiative-reto18-eventos/initiative-reto18-eventos.md
- spec — _bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/spec-reto18-plataforma-eventos.md, CAP-1 a CAP-4
- spine — _bmad-output/initiative-reto18-eventos/architecture-reto18-plataforma-eventos/architecture-reto18-plataforma-eventos.md, AD-1 a AD-4, Convenciones, Semilla estructural
- mapa — _bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/mapa-asientos.md

## Notes

- Decision: la base de la plataforma (monorepo, CI, despliegue y Supabase) va en las primeras historias de este epic (10/10/2026).
- Decision: sin la historia de cierre "Repaso final de limpieza", por el tiempo de la hackathon (usuario, 10/10/2026).
- Decision: la historia 3 enlaza al organizador con auth.users, para poder construirse en paralelo con la 2; la 6 no depende de la 2, porque el catálogo es público (10/10/2026).
- Open question: ¿quién verifica los eventos en el Club y con qué criterios? Para la demo basta con la revisión manual.
- Decision: cada historia con pantalla se parte en una historia API (conserva su id y su responsable) y una historia "UI:" con id nuevo para Manuel Alexis; todas las UI esperan a la 1.7, sistema de diseño y layout móvil con la paleta de la plataforma (usuario, 10/10/2026).
- Decision: la 1.3 deja montadas las pruebas de integración de la API, que usan las demás historias API (10/10/2026).
- Decision: Sandro David y Manuel Alexis intercambian roles, porque Manuel no puede usar Claude Code. Sandro pasa a P3 y construye todas las historias "UI:" (y la 3.6) a partir del DESIGN.md de Manuel; Manuel pasa a P1: aceptación funcional de los PRs, validación de las 19:00, pitch y la parte manual de la 3.4. Jean Pierre revisa el código de todos (usuario, 10/10/2026).
