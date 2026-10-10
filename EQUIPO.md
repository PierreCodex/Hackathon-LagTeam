# Equipo

Responsable de este archivo: **P1 (Sandro David)**. Solo P1 lo modifica; los demás le piden los cambios.

> **Cambio en el evento:** Jostin no pudo asistir. Sandro David pasa a P1 y el equipo trabaja con **cuatro personas**. Luis Armando une P4 y P5.

Los horarios y el resto del método vienen de `plan-hackathon-bmad-version-corregida.md` y `GUIA-POR-ROL.md`.

## Integrantes

| Rol | Nombre | Usuario de GitHub | Herramienta de IA | Portátil | Turno de descanso |
|---|---|---|---|---|---|
| P1 · Producto, entrevistas, spec, aceptación funcional y guion del pitch (no programa) | **Sandro David** | @Saler123 | Claude Code + Codex | | 04:00–06:30 |
| P2 · Tech lead, arquitectura, integración, manejo de la demo y **responsable de BMad** | **Jean Pierre** | @PierreCodex | Claude Code (principal) y Codex (respaldo) | **Principal de la demo** | 00:00–02:30 |
| P3 · Frontend y experiencia | **Manuel Alexis** | @Manuel-Silva-Hub | Claude Code | | 23:00–01:30 |
| P4 + P5 · Backend/IA, CI, entorno de demo, QA y respaldo de BMad | **Luis Armando** | @ljuarezar14 | Codex + Claude Code | **Respaldo de la demo** | 02:30–05:00 |

**Pitch:** quién presenta está por definir. Jean Pierre maneja la demo en su portátil mientras otra persona presenta.

**Responsable de BMad:** Jean Pierre. Respaldo: Luis Armando.

**Regla de descansos:** nunca descansan más de dos personas a la vez, y Jean Pierre y Luis Armando nunca coinciden.

## Ajustes por ser cuatro

1. **Alcance más pequeño:** un solo flujo completo. Lo demás queda fuera o simulado, y la spec lo deja explícito en la lista de lo que no entra.
2. **Pruebas de extremo a extremo solo si sobra tiempo.** Si no, lista de comprobación manual (como en la ruta comprimida del plan).
3. **Jean Pierre** puede tomar historias cortas de backend si Luis Armando se satura.

## Mañana del evento (09:30–12:00)

| Rol | Persona | Qué hace |
|---|---|---|
| P1 | Sandro David | Dirige la lectura del reto y la rúbrica (`reto.md`), **crea la iniciativa** con `bmad`, lidera las entrevistas (`evidencia.md`) |
| P2 | Jean Pierre | Inventario técnico del reto: APIs, datos, créditos. Preguntas técnicas a los mentores |
| P3 | Manuel Alexis | Investigación del dominio con `bmad-deep-recon` (si hace falta). **Acompaña a Sandro David en las entrevistas del coffee break** (11:00–11:30) |
| P4 + P5 | Luis Armando | Prueba técnica desechable de la integración más arriesgada; cuentas y entorno |

Después: brainstorming 12:00, endurecer la idea 12:45 y **decisión GO a las 13:30** (Sandro David y Jean Pierre). A las 19:00, Sandro David y Manuel Alexis validan el prototipo con un mentor o usuario.

## Qué ejecuta y qué lleva cada rol

| Rol | Persona | Skills que ejecuta | Documentos de los que es responsable | Aprueba |
|---|---|---|---|---|
| P1 | Sandro David | `bmad` (crear la iniciativa), `bmad-brainstorming`, `bmad-forge-idea`, `bmad-spec`, `bmad-review` y `bmad-party-mode` (pitch) | `reto.md`, `evidencia.md`, spec, `demo-estado.md`, guion del pitch, este archivo | GO, aceptación funcional de cada PR, entregables |
| P2 | Jean Pierre | `bmad-architecture`, `bmad-project-context`, `bmad-ticket`, `bmad-code-review`, `bmad status`, `bmad-build` (historias cortas) | Arquitectura (o `contratos.md`), `AGENTS.md`, `tickets.toml`, `ASIGNACION.md`, `README.md`, instalación de BMad | GO, PRs del flujo de la demo, congelamiento, cambios en BMad |
| P3 | Manuel Alexis | `bmad-deep-recon` (si aplica), `bmad-ux` (si aplica), `bmad-build` | `research-<tema>.md`, `ux-<slug>/` | Revisión cruzada de los PRs de Luis Armando |
| P4 + P5 | Luis Armando | `bmad-build` (esqueleto, backend/IA, CI), `bmad-qa-generate-e2e-tests` (si hay tiempo) | CI, entorno de demo, contratos de datos e IA; respaldo de la instalación de BMad | Revisión cruzada de los PRs de Manuel Alexis; PRs y dudas de BMad mientras Jean Pierre descansa (00:00–02:30) |

Cada dev es responsable del plan de los tickets que construye. Ese plan lo genera `bmad-build`.

**Reparto de historias (16:40):** en la petición de la guía por rol, cambiar "No asignes nada a Jostin" por "**No asignes nada a Sandro David** (P1, no programa). Backend, IA e infraestructura para Luis Armando; interfaz para Manuel Alexis; historias cortas para Jean Pierre."

## Herramientas de IA

| Herramienta | Quiénes | ¿Ve las skills? |
|---|---|---|
| Claude Code | Jean Pierre, Manuel Alexis, Sandro David, Luis Armando | Jean Pierre ☑ · Manuel Alexis ☐ · Sandro David ☐ · Luis Armando ☐ |
| Codex | Jean Pierre, Sandro David, Luis Armando | Jean Pierre ☑ · Sandro David ☐ · Luis Armando ☑ (el sandbox no arranca en su Windows: Full Access o usar Claude Code) |

## CODEOWNERS

```text
/.agents/          @PierreCodex @ljuarezar14
/.claude/skills/   @PierreCodex @ljuarezar14
/_bmad/            @PierreCodex @ljuarezar14
/skills-lock.json  @PierreCodex @ljuarezar14
```

## Pendiente

- [ ] Manuel Alexis y Sandro David: comprobar `/bmad status` en su herramienta
- [ ] Definir quién presenta el pitch
- [ ] Confirmar con los organizadores la duración del pitch (mientras tanto: versión de 3 minutos y ampliación a 5)
