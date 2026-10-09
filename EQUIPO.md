# Equipo

Responsable de este archivo: **P1 (Jostin)**. Solo P1 lo modifica; los demás le piden los cambios.

Los roles, horarios y turnos vienen de `plan-hackathon-bmad-version-corregida.md`.

## Integrantes

| Rol | Nombre | Usuario de GitHub | Herramienta de IA | Portátil | Turno de descanso |
|---|---|---|---|---|---|
| P1 · Producto, investigación, guion del pitch y aceptación funcional (no programa) | **Jostin** | @UserNewEngi | Por confirmar (urgente) | | 04:00–06:30 |
| P2 · Tech lead, arquitectura, integración, manejo de la demo y **responsable de BMad** | **Jean Pierre** | @PierreCodex | Claude Code (principal) y Codex (respaldo si se alcanza el límite de Claude Pro) | **Principal de la demo** | 00:00–02:30 |
| P3 · Frontend y experiencia | **Manuel Alexis** | @Manuel-Silva-Hub | Claude Code | | 23:00–01:30 |
| P4 · Backend, datos o IA | **Sandro David** | @Saler123 | Claude Code + Codex | | 01:30–04:00 |
| P5 · CI, entorno de demo, QA y respaldo del responsable de BMad | **Luis Armando** | @ljuarezar14 | Codex + Claude Code | **Respaldo de la demo** | 02:30–05:00 |

**Pitch:** quién presenta está por definir; puede ser cualquiera del equipo. P2 maneja la demo en su portátil mientras otra persona presenta.

**Portátil de la demo:** principal el de Jean Pierre (P2); respaldo el de Luis Armando (P5).

**Responsable de BMad:** Jean Pierre (P2), que hizo la instalación. Respaldo: Luis Armando (P5).

**Regla de descansos:** nunca descansan más de dos personas a la vez, y P2 y P5 nunca coinciden.

## Mañana del evento (09:30–12:00)

| Rol | Persona | Qué hace |
|---|---|---|
| P1 | Jostin | Dirige la lectura del reto y la rúbrica (`reto.md`), crea la iniciativa con `bmad`, lidera las entrevistas (`evidencia.md`) |
| P2 | Jean Pierre | Inventario técnico del reto: APIs, datos, créditos. Preguntas técnicas a los mentores |
| P3 | Manuel Alexis | Investigación del dominio con `bmad-deep-recon` (si hace falta). Escucha las entrevistas del coffee break (11:00–11:30) y lee `evidencia.md` antes del brainstorming |
| P4 | Sandro David | Acompaña a P1 en las entrevistas y pregunta por datos, APIs y restricciones. Ayuda a consolidar la evidencia |
| P5 | Luis Armando | Prueba técnica desechable de la integración más arriesgada; prepara cuentas y entorno |

Después: brainstorming 12:00, endurecer la idea 12:45 y **decisión GO a las 13:30** (P1 y P2). A las 19:00, P1 y P3 validan el prototipo con un mentor o usuario.

## Qué ejecuta y qué lleva cada rol

| Rol | Persona | Skills que ejecuta | Documentos de los que es responsable | Aprueba |
|---|---|---|---|---|
| P1 | Jostin | `bmad` (crear la iniciativa), `bmad-brainstorming`, `bmad-forge-idea`, `bmad-spec`, `bmad-review` y `bmad-party-mode` (pitch) | `reto.md`, `evidencia.md`, spec, `demo-estado.md`, guion del pitch, este archivo | GO, aceptación funcional de cada PR, entregables |
| P2 | Jean Pierre | `bmad-architecture`, `bmad-project-context`, `bmad-ticket`, `bmad-code-review`, `bmad status` | Arquitectura (o `contratos.md`), `AGENTS.md`, `tickets.toml`, `README.md`, instalación de BMad | GO, PRs del flujo de la demo, congelamiento, cambios en BMad |
| P3 | Manuel Alexis | `bmad-deep-recon` (si aplica), `bmad-ux` (si aplica), `bmad-build` | `research-<tema>.md`, `ux-<slug>/` (`DESIGN.md`, `EXPERIENCE.md`) | Revisión cruzada de los PRs de P4 |
| P4 | Sandro David | `bmad-build` | — | Revisión cruzada de los PRs de P3 |
| P5 | Luis Armando | `bmad-build` (esqueleto y tickets), `bmad-qa-generate-e2e-tests` | CI, entorno de demo; respaldo de la instalación de BMad | PRs y dudas de BMad mientras P2 descansa (00:00–02:30) |

Cada dev es responsable del plan de los tickets que construye. Ese plan lo genera `bmad-build`.

## Herramientas de IA

| Herramienta | Quiénes | ¿Ve las skills? (comprobado con `PREPARACION-BMAD.md`, Paso 4) |
|---|---|---|
| Claude Code | Jean Pierre, Manuel Alexis, Sandro David, Luis Armando | Jean Pierre ☑ · Manuel Alexis ☐ · Sandro David ☐ · Luis Armando ☐ |
| Codex | Jean Pierre, Sandro David, Luis Armando | Jean Pierre ☑ · Sandro David ☐ · Luis Armando ☑ (el sandbox de Codex no arranca en su Windows: pide permiso por cada comando; pendiente de arreglar o usar Full Access) |
| OpenCode | Nadie por ahora | — |
| Por confirmar | Jostin | ☐ |

## CODEOWNERS

P2 crea `.github/CODEOWNERS` con este contenido (Jean Pierre como responsable de BMad y Luis Armando como respaldo):

```text
/.agents/          @PierreCodex @ljuarezar14
/.claude/skills/   @PierreCodex @ljuarezar14
/_bmad/            @PierreCodex @ljuarezar14
/skills-lock.json  @PierreCodex @ljuarezar14
```

## Pendiente

- [x] Asignar roles: Jostin (P1), Jean Pierre (P2), Manuel Alexis (P3), Sandro David (P4), Luis Armando (P5)
- [x] Portátil de la demo: principal Jean Pierre, respaldo Luis Armando
- [x] Jean Pierre comprueba Claude Code y Codex
- [x] Luis Armando comprueba Codex (`current: true`)
- [x] Usuarios de GitHub de los cinco (invitados al repo privado)
- [ ] **Jostin:** confirmar herramienta de IA y probar BMad (urgente: P1 usa BMad desde la primera hora)
- [ ] **Manuel Alexis:** clonar el repo y probar Claude Code con BMad (`/bmad status`)
- [ ] **Sandro David:** clonar el repo y hacer la prueba de la guía
- [ ] **Luis Armando:** dejar Codex funcionando sin pedir permiso por cada comando, o usar Claude Code
- [ ] Definir quién presenta el pitch
- [ ] Preguntar a los organizadores la duración del pitch (mientras tanto: versión de 3 minutos y ampliación a 5)
