---
type: epic
title: "Paneles y negocio"
parent: initiative-reto18-eventos
covers: [CAP-11, CAP-12, CAP-13]
after: []
assignee: "Luis Armando"
risk: low
---

# Paneles y negocio

## Description

El organizador ve sus ventas por evento, tipo de entrada y pieza. El administrador configura la comisión, ve la liquidación de cada organizador y consulta un tablero de ventas, asistencia, categorías y perfil del público, que se exporta a Excel. Se muestra con datos sembrados y con los de la demo.

## Outcome

El jurado ve el panel del organizador reflejar la compra de la demo y al administrador descargar el Excel. Corresponde al paso 8 de `demo-flow.md` y al criterio 7 de la rúbrica.

## Requirements

Los de la spec, por su id: CAP-11, CAP-12 y CAP-13.

## Done when

1. En producción, el panel del organizador muestra la compra de la demo, asignada a la pieza que la generó, segundos después de hacerla.
2. Al cambiar la comisión, cambia la liquidación mostrada para las ventas nuevas, y las ya pagadas conservan su comisión congelada (AD-10).
3. El tablero del administrador muestra ventas, asistencia, categorías y perfil del público con los datos sembrados, y el Excel descargado se abre con esas cifras.

## Boundaries

Se corta por capacidad. Incluye el módulo `negocio` y las pantallas de paneles. Lee de `ventas`, `marketing` e `identidad` solo a través de sus servicios (AD-2, AD-8), y cambia la comisión a través de `ventas` (AD-10). Lo que queda fuera está en los non-goals de la spec.

## References

- parent — _bmad-output/initiative-reto18-eventos/initiative-reto18-eventos.md
- spec — _bmad-output/initiative-reto18-eventos/spec-reto18-plataforma-eventos/spec-reto18-plataforma-eventos.md, CAP-11 a CAP-13
- spine — _bmad-output/initiative-reto18-eventos/architecture-reto18-plataforma-eventos/architecture-reto18-plataforma-eventos.md, AD-2, AD-8 y AD-10

## Notes

- Waits on epic-compra-butacas-acceso because: necesita órdenes pagadas con la comisión congelada, la asistencia y `ventas_config_comision`.
- Waits on epic-marketing-ia because: necesita los enlaces rastreables y los clics por pieza.
- Assumption: la comisión por entrada es el modelo por defecto (spec, Assumptions).
- Decision: sin la historia de cierre "Repaso final de limpieza", por el tiempo de la hackathon (usuario, 10/10/2026).
- Decision: se añade la dependencia `negocio → identidad` a la arquitectura (AD-2), para leer el perfil del público (usuario, 10/10/2026).
- Decision: con tarifa por evento, la orden congela el modelo y la tarifa con importe 0, y la liquidación descuenta la tarifa una vez por evento (10/10/2026).
- Decision: cada historia con pantalla se parte en una historia API (conserva su id y su responsable) y una historia "UI:" con id nuevo para Manuel Alexis; todas las UI esperan a la 1.7, sistema de diseño y layout móvil con la paleta de la plataforma (usuario, 10/10/2026).
- Decision: Sandro David y Manuel Alexis intercambian roles, porque Manuel no puede usar Claude Code. Sandro pasa a P3 y construye todas las historias "UI:" (y la 3.6) a partir del DESIGN.md de Manuel; Manuel pasa a P1: aceptación funcional de los PRs, validación de las 19:00, pitch y la parte manual de la 3.4. Jean Pierre revisa el código de todos (usuario, 10/10/2026).
