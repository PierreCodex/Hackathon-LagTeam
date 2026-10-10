# Guía por rol: qué hacer en cada momento con BMad

Esta guía dice **qué hace cada persona, en qué orden y qué escribir** en su herramienta de IA durante la hackathon. El horario completo y el porqué de cada decisión están en `plan-hackathon-bmad-version-corregida.md`; los roles, en `EQUIPO.md`.

| Rol | Persona |
|---|---|
| P1 · Producto, aceptación, validación y pitch | Manuel Alexis |
| P2 · Tech lead, integración, demo y responsable de BMad | Jean Pierre |
| P3 · Frontend (historias "UI:") | Sandro David |
| P4 + P5 · Backend, IA, CI, despliegue, QA y respaldo de BMad | Luis Armando |

> **Equipo de cuatro:** Jostin no pudo asistir. Sandro David pasa a P1 y Luis Armando une P4 y P5. Por la noche, **Sandro David y Manuel Alexis intercambian roles** porque Manuel no puede usar Claude Code: Sandro pasa a P3 y Manuel a P1 (ver `EQUIPO.md`).

---

## 0. Antes de nada: cómo se usa BMad

### Cómo invocar una skill

| Herramienta | Cómo se escribe | Ejemplo |
|---|---|---|
| **Claude Code** | `/nombre-de-la-skill` y, después, lo que quieres | `/bmad-spec crea la spec a partir de forge-...` |
| **Codex** | En lenguaje natural, nombrando la skill | `Usa la skill bmad-spec para crear la spec a partir de forge-...` |

En esta guía los ejemplos están en formato Claude Code. En Codex, cambia `/bmad-spec …` por `Usa la skill bmad-spec para …`.

**Terminal** = comandos de `git`, `gh`, etc. **Chat** = lo que escribes dentro de Claude Code o Codex.

### Reglas de oro

1. **Abre siempre tu herramienta desde la carpeta del repo** (`Hackathon-LagTeam`).
2. **Una skill por conversación.** Para cada skill o ticket nuevo, empieza un chat nuevo (en Claude Code: `/clear`).
3. **Lee lo que propone el agente antes de aprobar.** BMad te muestra planes y pide confirmación: esa es tu parte del trabajo.
4. **Si no sabes qué hacer:** escribe `/bmad ¿qué hago ahora?`. Mira lo que hay en el repo y te dice el siguiente paso.
5. **Si te ofrece actualizar BMad o hacer setup: responde que NO.**
6. **Nadie trabaja ni hace push directamente en `main`.** Todo va por rama → PR → merge: el código en ramas `t/...` o `fix/...`, y los documentos de planificación (iniciativa, `ASIGNACION.md`, estados de tickets) en ramas `plan/...`. Después de cada merge, los demás hacen `git switch main` y `git pull`.
7. **Ahorro de tokens:** cada skill compartida la ejecuta **un solo responsable** y los demás leen sus documentos. No repitáis el mismo análisis cinco veces. Skills opcionales y revisiones extra, solo cuando aporten valor.
8. **Los horarios son límites orientativos, no esperas:** si una tarea ya tiene alcance, contratos y responsable claros, puede empezar antes. El horario oficial del evento sí se respeta siempre.

### Dónde quedan las cosas

Todo lo que produce BMad (spec, arquitectura, tickets, planes de cada ticket) se guarda en `_bmad-output/initiative-<nombre>/`. Los documentos del equipo (`reto.md`, `evidencia.md`, `demo-estado.md`) y el material en bruto van **en esa misma carpeta**, para que las skills los encuentren sin pegarlos en el chat (eso también ahorra tokens).

```text
_bmad-output/initiative-<reto>/
├── initiative-<reto>.md          ← la crea Sandro David con /bmad (09:30)
│
├── insumos/                      ← material en bruto
│   ├── reto-original.pdf         ← enunciado y rúbrica tal como los entregan
│   ├── datos/                    ← datasets o ejemplos de los organizadores
│   ├── apis.md                   ← enlaces y notas de APIs disponibles (sin claves)
│   └── notas-entrevistas/        ← apuntes rápidos de cada entrevista
│
├── reto.md                       ← Sandro David: criterios de la rúbrica → cómo los demostramos
├── evidencia.md                  ← Sandro David: hecho / interpretación / supuesto / fuente
├── demo-estado.md                ← Manuel Alexis (P1): qué es real, grabado o simulado
├── ASIGNACION.md                 ← Jean Pierre: quién hace qué historia
│
├── research-<tema>/              ← Manuel Alexis con bmad-deep-recon (si hace falta)
├── brainstorm-<tema>/            ← bmad-brainstorming
├── forge-<idea>/                 ← bmad-forge-idea (decisión GO)
├── spec-<producto>/              ← Sandro David con bmad-spec
├── architecture-<producto>/      ← Jean Pierre con bmad-architecture
├── ux-<producto>/                ← Manuel Alexis con bmad-ux (si aplica)
└── <épica>/tickets.toml          ← Jean Pierre con bmad-ticket; aquí también quedan
                                    los planes de cada historia que genera bmad-build
```

- Las carpetas `research-…`, `brainstorm-…`, `forge-…`, `spec-…`, `architecture-…` y `ux-…` las crea BMad. El nombre exacto de la carpeta de la épica lo pone `bmad-ticket`.
- `insumos/`, `reto.md`, `evidencia.md`, `demo-estado.md` y `ASIGNACION.md` son del equipo: se crean a mano.
- **Nada de claves ni datos personales en `insumos/`.** Datos sensibles: fuera del repo o anonimizados.
- **Archivos grandes** (más de unas decenas de MB): fuera del repo; en `apis.md` se anota dónde están.

---

## 1. Todos, a las 09:30

**Terminal:**

```bash
cd Hackathon-LagTeam
git pull
```

**Sandro David** crea la iniciativa (ver su sección). En cuanto la suba, **los demás**:

```bash
git pull
```

```text
/bmad activa la iniciativa initiative-<nombre-que-diga-Sandro David>
```

✅ Termina cuando: los cinco tienen activa **la misma** iniciativa (`/bmad` la muestra).

---

## 2. El ciclo de un ticket (Jean Pierre, Manuel Alexis, Sandro David, Luis Armando)

Desde las 17:00 la mayor parte del trabajo es repetir este ciclo. Cada ticket tiene una referencia como `1.3` (épica 1, historia 3) que aparece en `tickets.toml`. **Tus historias están en los `tickets.toml` de cada epic, en el campo `assignee`**; el orden de las tablas es el orden de construcción, y `after` dice de qué dependen. Las historias `API:` son del dueño del epic y las `UI:` de Sandro David.

| Paso | Dónde | Qué hacer |
|---|---|---|
| 1 | Terminal | `git switch main` y `git pull` |
| 2 | Terminal | Crear la rama del ticket: `git switch -c t/1.3-nombre-corto` |
| 3 | Chat (nuevo) | `/bmad-build build story 1.3` |
| 4 | Chat | Leer el **plan** que propone. Si algo no cuadra, díselo. Si está bien, apruébalo |
| 5 | Chat | Deja que implemente, pruebe y revise. Al final hace un **commit local** (no sube nada) |
| 6 | Terminal | `git push -u origin t/1.3-nombre-corto` |
| 7 | Terminal | `gh pr create --fill` (o crear el PR desde la web de GitHub) |
| 8 | Mensaje | Avisar a **Jean Pierre** (revisión del código) y a **Manuel Alexis** (aceptación funcional, en la vista previa de Vercel) |
| 9 | — | Cuando esté aprobado, merge del PR. **Jean Pierre** marca el ticket como hecho |

**Importante:**

- **Nombra siempre el ticket** (`build story 1.3`). Si escribes solo `/bmad-build`, coge el primer ticket libre, que puede ser el de otra persona.
- **Antes del paso 3, la rama tiene que estar limpia** (`git status` sin cambios). Si no, `bmad-build` se detiene.
- **Si se corta a mitad** (se acaban los tokens, se cierra la herramienta): abre un chat nuevo y escribe `/bmad-build build story 1.3` otra vez. Encuentra su plan y continúa.
- **Revisión:** por defecto hace una revisión rápida. Para un ticket delicado del flujo de la demo, pide `/bmad-build build story 1.3, revisión thorough`.
- **Integra al menos cada 2 horas.** Mejor PRs pequeños y frecuentes que uno enorme al final.

---

## 3. P1 · Manuel Alexis (producto, aceptación y pitch)

No programa ni necesita Claude Code. Su trabajo es que construyamos **lo correcto** y que el jurado lo crea. Hasta la noche este rol lo llevó Sandro David (las filas hasta las 16:15 ya están hechas); desde el intercambio lo lleva Manuel Alexis. Además hace **la parte manual de la 3.4** (crear la cuenta de Upload-Post o Zernio, conectar el Instagram y el Facebook del equipo y comprobar si el plan gratuito permite publicar).

**Cómo acepta un PR sin Claude Code:** abre el enlace de vista previa de Vercel que aparece en el PR, recorre en el móvil el `verify` de la historia y deja en GitHub su aprobación o lo que falla.

| Hora | Qué hace | Qué escribir | Necesita antes | Termina cuando |
|---|---|---|---|---|
| 09:30 | Lee el reto y la rúbrica con todos y crea `reto.md`: cada criterio de la rúbrica y cómo lo demostraremos | — | El reto | Cada criterio tiene una forma de demostrarlo |
| 09:45 | Crea la iniciativa | `/bmad crea una iniciativa nueva llamada <nombre-del-reto> y actívala` | Nombre corto del reto | Existe `_bmad-output/initiative-<nombre>/` |
| 09:50 | Publica la iniciativa por PR | Terminal: `git switch -c plan/iniciativa` · `git add _bmad-output` · `git commit -m "chore: iniciativa"` · `git push -u origin plan/iniciativa` · `gh pr create --fill` | — | Jean Pierre hace merge; Sandro David avisa al grupo del nombre |
| 10:00–11:30 | Entrevistas con mentores (con Manuel Alexis). Anota en `evidencia.md`: **hecho**, **interpretación**, **supuesto**, fuente | — | Preguntas preparadas (`plan`, sección 4) | ≥5 entrevistas o ≥3 fuentes con el mismo dolor |
| 12:00 | Lluvia de ideas con todos | `/bmad-brainstorming sobre el reto, usando reto.md y evidencia.md` | `evidencia.md` | Quedan ≤3 propuestas |
| 12:45 | Endurecer la favorita | `/bmad-forge-idea con la propuesta <X>, usando evidencia.md` | La propuesta elegida | Idea endurecida o descartada |
| **13:30** | **Decisión GO** con Jean Pierre | — | Resultado de forge | GO, o pasar a la ruta comprimida |
| 13:30–15:45 | Escribir la spec | `/bmad-spec crea la spec a partir de forge-<x>, evidencia.md y reto.md` | Forge, evidencia, rúbrica | Spec con lo que entra y lo que **no** entra |
| 15:45 | Actualizar la spec con arquitectura y UX | `/bmad-spec actualiza la spec incorporando la arquitectura y la UX` | Arquitectura (y UX si la hay) | Jean Pierre la aprueba |
| 16:15 | Prioridades de los tickets | — (revisa lo que propone Jean Pierre) | Spec | Tickets aprobados a las 17:00 |
| Cuanto antes | Parte manual de la 3.4: cuenta de publicación y redes conectadas; avisa a Luis Armando de si el plan gratuito sirve | — | — | Cuenta lista o alternativa decidida |
| 17:00–03:15 | **Aceptación** de cada PR: prueba la funcionalidad y dice sí o no | — | PR abierto | Cada PR aceptado o con cambios pedidos |
| 19:00 | Prototipo ante un mentor o usuario (con Sandro David). Lo anota en `evidencia.md` | — | Algo que enseñar | Nueva evidencia |
| 22:30 | Aprueba el **flujo completo demostrable** | — | — | Recorre la demo sin ayuda |
| 22:30–04:00 | Borrador del pitch y `demo-estado.md` (qué es real, grabado o simulado) | — | Evidencia | Borrador listo |
| 06:30 | Revisar el guion del pitch | `/bmad-review revisa el guion del pitch` (en Claude Desktop pegando el guion, o lo ejecuta otro) | Guion | Correcciones aplicadas |
| 07:00 | Jurado simulado | `/bmad-party-mode hagan de jurado de la hackathon y háganme preguntas difíciles sobre el pitch` | Guion | Respuestas preparadas |
| **08:30** | Entregables listos y enviados antes de las 09:00 | — | Lista de entregables | Enviado |

**Si cambia el alcance durante el día:** `/bmad-spec actualiza la spec: <qué cambia>`. Te dice qué tickets dejan de encajar; avisa a Jean Pierre. **Nunca edites la spec a mano.**

---

## 4. P2 · Jean Pierre (tech lead, integración, demo y BMad)

| Hora | Qué hace | Qué escribir | Necesita antes | Termina cuando |
|---|---|---|---|---|
| 09:30–12:00 | Inventario técnico del reto: APIs, datos, créditos. Preguntas técnicas a mentores | — | El reto | Lista de recursos y riesgos técnicos |
| 12:00–13:30 | Brainstorming y forge con el equipo | — | — | **GO a las 13:30** con Sandro David |
| 13:30–15:45 | Arquitectura (con Luis Armando), incluido el **modo de presentación** (desplegado o local) | `/bmad-architecture crea la arquitectura a partir de la spec, vía rápida` | Borrador de la spec | Stack, contratos entre partes y modo de presentación decididos |
| 15:45 | Reglas para los agentes | `/bmad-project-context setup` | Stack decidido | `AGENTS.md` aprobado; en `CLAUDE.md` la línea `@AGENTS.md` |
| 16:05 | Aprueba la spec | — | Spec actualizada | — |
| 16:15 | Tickets | `/bmad-ticket incept the epic a partir de la spec` (indicando que el esqueleto ya lo hace Luis Armando) | Spec aprobada | Tickets ordenados, con dependencias |
| 16:40 | **Reparto de historias** (ver abajo) | Petición de reparto en el chat | `tickets.toml` y `EQUIPO.md` | `ASIGNACION.md` revisado, mergeado por PR y avisado al grupo a las 17:00 |
| 17:00–03:15 | **Revisa PRs**, integra en `main` (ventanas 18:30, 19:45, 22:30, 00:00, 03:00) y construye tickets cortos con el ciclo de la sección 2 | Para PRs del flujo de la demo: `/bmad-code-review revisa el PR #<n>` | PR abierto | PR aprobado y mergeado |
| Tras cada merge | Marca el ticket como hecho, en una rama `plan/estados` (puede agrupar varios tickets por ventana de integración) | `/bmad-ticket mark story 1.3 done`; luego push y PR de `plan/estados` | PR del ticket mergeado y aceptado por Manuel Alexis | Estado actualizado en `main` por merge |
| Cuando haga falta | Ver cómo va todo | `/bmad-ticket what's ready?` | — | — |
| **03:15** | **Congelamiento**: desde aquí solo correcciones | Terminal: `git tag freeze` · `git push --tags` | — | — |
| 06:00 | Versión final con Luis Armando | Terminal: `git tag demo-v1` · `git push --tags` | Todo probado | Demo probada en ambos portátiles |
| 10:30 | Maneja la demo en su portátil | — | — | — |

### Reparto de historias (16:40–17:00)

`bmad-ticket` deja las historias en `tickets.toml`, en orden y con sus dependencias, pero **no las asigna a personas**. El reparto lo propone el agente y lo decide Jean Pierre.

**1. Chat** (puede ser el mismo de `bmad-ticket` o uno nuevo):

```text
Lee tickets.toml de la iniciativa activa y EQUIPO.md. Asigna cada historia a una persona
según su rol, respetando las dependencias: las historias que bloquean a otras primero.
Que cada uno tenga trabajo desde las 17:00 sin depender de otro, y Jean Pierre solo
tickets cortos. Crea ASIGNACION.md con: persona, historias en orden, de qué dependen
y con quién coordinarse. Manuel Alexis (P1) solo recibe la parte manual de la 3.4.
```

**2. Revisar el reparto antes de publicarlo.** Comprobar que:

- Las historias que bloquean a otras van primero y a alguien que puede empezar ya.
- Todos tienen trabajo desde las 17:00 sin pisarse.
- La carga está equilibrada y Jean Pierre tiene pocas historias, y cortas.
- Encaja con lo que domina cada uno (esto lo sabe Jean Pierre mejor que el agente).

**3. Publicarlo por PR.** Terminal: `git switch -c plan/asignacion` · `git add ASIGNACION.md` · `git commit -m "docs: asignación de historias"` · `git push -u origin plan/asignacion` · `gh pr create --fill`, y merge. Avisar al grupo para que hagan `git switch main` y `git pull`.

**4. Mantenerlo al día.** Si cambian los tickets durante el evento (cambio de alcance, historia dividida, bloqueo), Jean Pierre actualiza también `ASIGNACION.md`, para que no haya dos versiones distintas.

**Si un ticket bloquea a otros:** `/bmad-ticket what's blocked?`. El dueño del ticket bloqueante sube primero una versión simulada del contrato (stub) para que los demás sigan.

**Si un cambio afecta a la arquitectura o la UX** (no solo a la spec): `/bmad-correct-course <qué cambió>`. Propone los cambios; luego se aplican con cada skill.

**Si los agentes repiten un error:** `/bmad-project-context record: <el error y la regla>`. Lo añade a `AGENTS.md`.

---

## 5. P3 · Sandro David (frontend)

Desde el intercambio, **Sandro David construye todas las historias `UI:` y la 3.6** con el ciclo de la sección 2, empezando por la 1.7. Parte del trabajo de UX que dejó Manuel Alexis en `ux-plataforma-eventos/` (`DESIGN.md`, `EXPERIENCE.md` y maquetas). Las filas de abajo hasta las 15:45 las hizo Manuel. Las reservas (1.11, 3.10, 4.5 y 4.6) las toma quien termine primero si va cargado.

| Hora | Qué hace | Qué escribir | Necesita antes | Termina cuando |
|---|---|---|---|---|
| 10:00–11:00 | Investigación del dominio (solo si hay preguntas que bloquean la decisión) | `/bmad-deep-recon investigación de dominio rápida sobre <tema>: necesitamos decidir <qué>` | Las preguntas abiertas | `research-<tema>.md` con fuentes |
| 11:00–11:30 | Escucha las entrevistas con mentores del coffee break | — | — | — |
| 11:30 | Lee `evidencia.md` | — | — | Conoce al usuario y su problema |
| 12:00–13:30 | Brainstorming y forge con el equipo | — | — | GO |
| 13:30–15:45 | UX, **solo si la interfaz es importante para la demo** | `/bmad-ux crea el diseño de la experiencia a partir de la spec, con mockups de las pantallas clave` | Borrador de la spec | `DESIGN.md` y `EXPERIENCE.md`; flujo de la demo pantalla por pantalla |
| 15:45–17:00 | Componentes base; ayuda a estimar tickets | — | — | — |
| 17:00 en adelante | **Tickets de interfaz** con el ciclo de la sección 2 | `/bmad-build build story 1.N` | Ticket asignado | PR aceptado |
| 19:00 | Prototipo ante un mentor o usuario (con Manuel Alexis) | — | Algo que enseñar (o el mock de la UX) | Nueva evidencia |
| 23:00–01:30 | **Descanso** | | | |
| 03:15–06:00 | Solo correcciones (`fix/…`) | `/bmad-build corrige: <el fallo>` | Rama `fix/...` | PR aceptado |
| 06:00 | Graba el video de respaldo de la demo | — | Versión final | Video guardado |

**Si la UX cambia después:** `/bmad-ux actualiza: <qué cambia>`. No edites `DESIGN.md` ni `EXPERIENCE.md` a mano.

---

## 6. P4 · Backend, datos o IA (lo asume Luis Armando)

Con el equipo de cuatro, este rol lo lleva **Luis Armando** (sección 7): las historias `API:` de los epics 3 y 4 y el módulo `ia`. Sandro David ya no es P4: está en la sección 5.

**Regla:** toda llamada a un servicio externo pasa por su adaptador, con tiempo límite y respuesta de respaldo (AD-11 de la arquitectura).

---

## 7. P4 + P5 · Luis Armando (backend, IA, CI, despliegue, QA y respaldo de BMad)

| Hora | Qué hace | Qué escribir | Necesita antes | Termina cuando |
|---|---|---|---|---|
| 10:00–12:00 | Prueba técnica desechable de la integración más arriesgada (rama `spike/…`, **nunca se integra**) | `/bmad-build spike: comprobar si <API/servicio> funciona para <uso>` | API candidata | Nota: funciona o no, límites, costo |
| 12:45–13:30 | Viabilidad del entorno (despliegue o local), cuentas | — | — | Opciones claras para la arquitectura |
| 13:30–15:45 | Protección de `main`; con Jean Pierre en el modo de presentación; CI | — | — | — |
| 15:45 | **Esqueleto** de la app con CI, en el modo elegido | `/bmad-build crea el esqueleto del proyecto con el stack de la arquitectura y CI en GitHub Actions` | Arquitectura | **A las 17:45** arranca y la CI pasa |
| 17:45 en adelante | Tickets con el ciclo de la sección 2 | `/bmad-build build story 1.N` | Ticket asignado | PR aceptado |
| 22:30 | Prueba la demo en el portátil principal y en el de respaldo | — | Flujo completo | Funciona en los dos |
| 23:30–01:30 | Pruebas de extremo a extremo del flujo de la demo | `/bmad-qa-generate-e2e-tests create qa automated tests for el flujo de la demo` | Flujo completo | Las pruebas pasan en la CI |
| 00:00–02:30 | **Cubre a Jean Pierre**: revisa y aprueba PRs, resuelve dudas de BMad | `/bmad status` si hay dudas | — | — |
| 02:30–05:00 | **Descanso** | | | |
| 06:00 | Versión final (desplegada o local) con Jean Pierre | — | — | Probada en ambos portátiles |
| 08:30–09:00 | Comprueba que la solución arranca o está accesible | — | — | — |

**Codex en tu Windows:** su sandbox no arranca. Antes del evento, arréglalo o usa `/permissions` → Full Access (trabajando siempre en una rama y haciendo commit a menudo). Si no, usa Claude Code.

---

## 8. Si algo pasa

| Situación | Qué hacer |
|---|---|
| No sé qué hacer ahora | `/bmad ¿qué hago ahora?` |
| Cambia un requisito y solo afecta a la spec | Manuel Alexis avisa; Jean Pierre: `/bmad-spec actualiza la spec: <cambio>` |
| Cambia algo que afecta a arquitectura o UX | Jean Pierre: `/bmad-correct-course <cambio>` |
| Un ticket bloquea a otros | Jean Pierre: `/bmad-ticket what's blocked?`; el dueño sube un stub |
| `bmad-build` se detiene al empezar | `git status`: haz commit o guarda los cambios y comprueba que estás en la rama del ticket |
| Se acabaron los tokens a mitad de un ticket | Cambia de herramienta (Claude Code ↔ Codex), abre un chat nuevo y repite `build story 1.N`: retoma su plan |
| El agente repite un error | Jean Pierre: `/bmad-project-context record: <error y regla>` |
| Falla una API durante la demo | Cambiar al modo `recorded` y **decirlo en voz alta** |
| Vamos atrasados (sin GO a las 13:30 o sin esqueleto a las 18:15) | Ruta comprimida: sección 9 del plan |

## 9. Frases útiles

| Para | Escribe |
|---|---|
| Saber qué hacer | `/bmad ¿qué hago ahora?` |
| Ver el estado de la instalación | `/bmad status` |
| Ver la iniciativa activa | `/bmad` |
| Ver los tickets listos | `/bmad-ticket what's ready?` |
| Ver mis historias | Buscar tu nombre en `assignee` de los `tickets.toml` de cada epic |
| Construir un ticket | `/bmad-build build story 1.3` |
| Revisar un PR | `/bmad-code-review revisa el PR #12` |
| Preguntar por una skill | `/bmad ¿para qué sirve bmad-<nombre>?` |
