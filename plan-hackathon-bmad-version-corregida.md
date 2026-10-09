# Plan de BMad para una hackathon de 24 horas (versión 4: reglas confirmadas)

Equipo de 5 desarrolladores · GitHub compartido · Claude Code, Codex y OpenCode · reto todavía desconocido.

Objetivo: identificar el problema correcto, elegir una solución defendible, construir un MVP coherente con un flujo completo demostrable y presentar evidencia convincente al jurado.

**Leyenda:**

| Etiqueta | Significa |
|---|---|
| **[Confirmado]** | Confirmado por los organizadores, por el itinerario oficial o por el equipo |
| **[BMad]** | Comportamiento comprobado en los archivos instalados; se cita la fuente |
| **[Eq]** | Recomendación nuestra. No es una regla del evento ni un requisito de BMad. Todos los horarios internos, el número de entrevistas y el tamaño de los PRs son [Eq] |
| **[Pendiente]** | Falta confirmarlo con los organizadores o decidirlo durante el evento |

**H0** = 09:30 del día 1 (inicio oficial). **H24** = 09:30 del día 2 (stop de desarrollo y bloqueo de repositorios).

---

## 0. Hechos, recomendaciones y preguntas pendientes

### Hechos confirmados con los organizadores [Confirmado]

1. El desarrollo empieza a las **09:30 del día 1**.
2. De 08:30 a 09:30 el equipo está en la apertura y el sorteo, esperando el reto. **Esa franja no es tiempo de trabajo.**
3. El proyecto y los entregables deben quedar **terminados y entregados antes del cierre de las 09:30 del día 2**. Después se bloquean los repositorios.
4. **Se permite preparar previamente skills, scripts, plantillas y configuración de CI.**
5. **No se permite llevar módulos funcionales del producto ya construidos** (pagos u otras funcionalidades). La autorización anterior no cambia esto.
6. El código de la solución se construye durante el periodo autorizado, una vez conocido el reto. **No se prepara una aplicación base ni se traslada código de ensayos al proyecto del evento.**
7. Se puede evaluar un stack de referencia, pero **la elección definitiva depende del reto**.
8. **El pitch de las 10:30 no añade tiempo de desarrollo.**
9. Itinerario: coffee break con mentores de 11:00 a 11:30, almuerzo de 14:00 a 15:00, cena de 20:00 a 21:00, break nocturno de 02:45 a 03:15, evaluación del jurado a las 10:00, pitch a las 10:30 y premiación a las 12:30.

### Hechos confirmados con el equipo [Confirmado]

1. **Herramientas:** el equipo usará Claude Code, OpenCode y Codex. Todavía no está decidido qué herramienta usará cada persona.
2. **APIs de IA:** hay acceso a las APIs de OpenAI y de Claude. **No están confirmados los saldos, los límites ni los modelos disponibles.** Comprobarlos es una tarea previa (sección 10).
3. **Portátil de presentación:** no hay uno designado; cualquiera del equipo puede servir. Hay que elegir uno principal y otro de respaldo, y probar la demo en ambos.
4. **Deep research:** no hay una herramienta externa confirmada. No es un requisito del plan: `bmad-deep-recon` se usa en su modo de investigación dentro de la propia sesión.
5. **El despliegue no está decidido.** Depende del reto, del tipo de producto y de los requisitos del evento.

### Recomendaciones principales [Eq]

1. **El hito obligatorio es un flujo completo funcionando y demostrable**, no una URL pública. El modo de presentación (despliegue, ejecución local u otro formato permitido) se decide durante la definición técnica (sección 8).
2. **Versión final y entregables listos a las 08:30**, comprobados y enviados antes de las 09:00 si la plataforma lo permite, y de 09:00 a 09:30 solo margen para incidencias de entrega.
3. **Congelamiento de funcionalidades a las 03:15**, justo después del break nocturno.
4. **Una sola rama `main`.** Si hay despliegue, la producción se promueve con tags (sección 11).
5. **La preparación previa incluye herramientas, skills, scripts auxiliares, plantillas y CI**, todo versionado en el repositorio del evento. Nada de código del producto.
6. **Si la solución usa IA, OpenAI y Claude se configuran como respaldo mutuo** detrás del mismo adaptador, siempre que los modelos elegidos se hayan probado antes.
7. **La demo se prueba en un portátil principal y en uno de respaldo**, a las 22:30 y a las 06:00.

### Preguntas pendientes para los organizadores [Pendiente]

1. ¿Cuál es el listado exacto de entregables y por qué plataforma se envían?
2. ¿El jurado necesita acceder a la aplicación después del bloqueo de las 09:30? **Bloquear el repositorio no es lo mismo que apagar el servicio.**
3. ¿Hay requisitos sobre el formato de la demostración: despliegue, ejecución local, equipo propio o del evento?

### Preguntas pendientes para el equipo [Pendiente]

1. ¿Qué herramienta de IA usará Jostin? (Los demás ya están confirmados en `EQUIPO.md`: Claude Code para Manuel Alexis; Claude Code + Codex para Jean Pierre, Sandro David y Luis Armando.)
2. ¿Qué saldo, límites de uso y modelos tenemos realmente en OpenAI y en Claude? (tarea previa de la sección 10)
3. ¿Quién presenta el pitch y cuánto dura?

Ya resuelto [Confirmado]: roles y personas (sección 5 y `EQUIPO.md`); portátil principal el de Jean Pierre y de respaldo el de Luis Armando.

---

## 1. Historial de cambios

### Versión 2 (correcciones de la revisión crítica)

| # | Problema | Corrección |
|---|---|---|
| 1 | El tope de planificación no coincidía con el fin de los tickets | Un único tope de planificación con los tickets aprobados |
| 2 | El hito de despliegue y la señal de alarma no coincidían | Esqueleto, hito y alarma con horas coherentes |
| 3 | La ruta B se activaba antes de que la ruta A tuviera que decidir | La ruta B se activa en el mismo punto de decisión GO |
| 4 | P2 aparecía en varias actividades a la vez | Cronograma por persona con **A** activo, **C** consulta puntual, **Ap** aprobación |
| 5 | "Más de un documento por propietario" como señal de exceso | Sustituida por una tabla de documentos con decisión, responsable y lector |
| 6 | "No programar antes de H4" | Sustituida por criterios de preparación |
| 7 | La ruta B no conservaba ningún acuerdo técnico | Añadido `contratos.md` |
| 8 | Se mezclaban integración real, mocks y respuestas guardadas | Tres modos separados y declaración al jurado |
| 9 | Afirmaciones sobre BMad sin fuente | Verificadas en los archivos instalados |
| 10 | Cifras presentadas como reglas de BMad | Marcadas como [Eq] |

### Versión 3 (reglas del evento)

| Cambio | Motivo |
|---|---|
| Todo empieza a las 09:30; la franja de 08:30 a 09:30 queda fuera del plan | No está confirmado que se pueda trabajar en ella |
| La lectura del reto pasa a 09:30–10:00 y el resto del descubrimiento se desplaza 30 min | Consecuencia de lo anterior |
| GO a las 13:30 (antes 13:00); tickets aprobados a las 17:00 (antes 16:15) | Consecuencia del desplazamiento |
| Versión final a las 06:00, entregables a las 08:30, envío antes de las 09:00, margen hasta las 09:30 | El pitch no añade tiempo de desarrollo |
| Congelamiento a las 03:15 (antes 04:00) | Hay que cerrar los entregables a las 08:30 |
| El hito obligatorio es un flujo completo demostrable; el despliegue es una opción | El despliegue no está decidido |
| Decisión explícita del modo de presentación durante la definición técnica, con variantes para despliegue y ejecución local | Mismo motivo |
| La preparación previa solo incluye herramientas; el ensayo se hace en un repositorio aparte y nada se traslada | Prohibido llevar código del producto o una base de aplicación |
| La inclusión previa de BMad, plantillas y CI en el repositorio queda pendiente, con alternativa si no se autoriza | Autorización no confirmada |
| Turnos de sueño recalculados | Nuevos horarios de congelamiento y cierre |
| Se separan hechos, recomendaciones y preguntas pendientes | Petición del equipo |

### Versión 4 (confirmaciones de organizadores y equipo)

| Cambio | Motivo |
|---|---|
| BMad, scripts, plantillas y CI se preparan y versionan antes del evento; se elimina la instalación de BMad a las 09:30 | Los organizadores lo autorizan |
| Se elimina la pregunta sobre la franja de 08:30 a 09:30 | Confirmado: no es tiempo de trabajo |
| `bmad-deep-recon` se usa en modo de investigación dentro de la sesión; el modo de prompt para una herramienta externa queda opcional | No hay herramienta de deep research confirmada |
| Tarea previa: comprobar saldos, límites y modelos de OpenAI y Claude | Hay acceso, pero no están confirmados |
| OpenAI y Claude como respaldo mutuo detrás del mismo adaptador | Las dos APIs están disponibles |
| Elegir un portátil principal y otro de respaldo, prepararlos antes del evento y probar la demo en ambos | No hay portátil designado |
| Tarea previa: decidir qué herramienta usa cada persona y verificar que las tres ven las skills | Se usarán las tres, sin reparto decidido |

---

## 2. Cómo está el repositorio hoy

### Skills que se pueden invocar (30)

Son las que aparecen en `.agents/skills/`, y `.claude/skills/` apunta a ellas.

| Módulo | Skills |
|---|---|
| core-tools | `bmad`, `bmad-brainstorming`, `bmad-forge-idea`, `bmad-deep-recon`, `bmad-advanced-elicitation`, `bmad-review`, `bmad-party-mode`, `bmad-customize` |
| method | `bmad-spec`, `bmad-product-brief`, `bmad-prfaq`, `bmad-prd`, `bmad-ux`, `bmad-architecture`, `bmad-ticket`, `bmad-build`, `bmad-build-auto`, `bmad-correct-course`, `bmad-code-review`, `bmad-walkthrough`, `bmad-qa-generate-e2e-tests`, `bmad-retrospective`, `bmad-project-context`, `bmad-agent-analyst`, `bmad-agent-pm`, `bmad-agent-ux-designer`, `bmad-agent-architect`, `bmad-agent-dev` |
| toolsmith | `bmad-toolsmith`, `bmad-eval` |

**Registros internos, que no se invocan nunca:** `bmod-core-tools`, `bmod-method` y `bmod-toolsmith`. Solo guardan los metadatos y la ayuda de cada módulo.

Cómo invocar una skill: en Claude Code, `/nombre-skill`; en Codex y OpenCode, nombrándola en el mensaje.

### Problemas que hay que resolver antes del evento

1. **BMad todavía no está configurado.** No existe la carpeta `_bmad/`. Hay que ejecutar `bmad setup`, que necesita `uv`, porque las skills llaman a scripts compartidos.
2. **Nada de BMad está en GitHub.** `.agents/`, `.claude/` y `skills-lock.json` no están versionados.
3. **Los enlaces de `.claude/skills/*` usan rutas absolutas** del tipo `/d/Hackathon-LagTeam/.agents/...`. En otra máquina, o en Windows sin `core.symlinks`, van a fallar.
4. **`active_initiative` es una configuración personal** (`_bmad/custom/config.user.toml`). Las 5 personas tienen que activar la misma iniciativa, o los artefactos quedarán repartidos en carpetas distintas.
5. **No está verificado que cada herramienta vea las skills.** Claude Code lee `.claude/skills`; que Codex y OpenCode lean `.agents/skills` hay que comprobarlo en el clon de cada miembro.

Como los organizadores autorizan preparar skills y scripts, los cinco problemas se resuelven antes del evento (sección 10).

---

## 3. Comportamiento verificado en la versión instalada [BMad]

### `bmad-correct-course`

- **Necesita una PRD o una spec, y se detiene si no encuentra ninguna.** La arquitectura y la UX son opcionales. Fuente: `.agents/skills/bmad-correct-course/SKILL.md:101` ("A PRD or a spec is essential… HALT if neither a PRD nor a spec can be found") y `:120`.
- **No cambia las demás documentaciones.** Escribe una propuesta de cambio (`:234`) y una lista de cambios de épicas e historias para aplicar con `bmad-ticket` (`:229`). Que no aplica las ediciones lo dice `.agents/skills/bmod-method/help/implementation-skills.md` ("drafts the edits… and does not apply them").

### `bmad-build`

- **Hace un commit local y nunca hace push.** Fuente: `.agents/skills/bmad-build/step-05-present.md:19` ("create a local commit") y `:9` ("NEVER auto-push"); `step-03-implement.md:9` ("No push. No remote ops."); `step-oneshot.md:13` y `:106`.
- **Se detiene si hay cambios sin commitear o si la rama no encaja con la tarea.** Fuente: `step-01-clarify-and-route.md:70`. Por eso hay que **crear la rama del ticket antes** de invocarlo.
- **Sin argumento, toma el primer ticket listo del árbol.** Fuente: `step-01-clarify-and-route.md:28-32`. Con 5 personas en paralelo hay que **nombrar siempre el ticket**, por ejemplo "build story 1.3".
- **Necesita el script `_bmad/method/scripts/tickets.py`** (`step-01-clarify-and-route.md:19`), así que `bmad setup` es obligatorio antes de usarlo.
- **La revisión por defecto es `quick`.** Fuente: `customize.toml:97`.
- **Tamaño de una tarea:** un único objetivo y un plan de 900 a 1600 tokens, y "Neither limit is a gate" (`workflow.md:25-31`). La cifra de unas 500 líneas viene de `bmod-method/help/implementation-skills.md`. El límite de **≤400 líneas por PR es [Eq]**.

---

## 4. Documentos: para qué sirve cada uno y quién lo lleva

| Documento | Qué decisión permite o qué riesgo reduce | Responsable | Quién lo lee | ¿Se hace? |
|---|---|---|---|---|
| `reto.md` | Une cada criterio de la rúbrica con una demostración concreta. Evita construir algo que no puntúa | P1 | Todos, y el pitch | Siempre |
| `evidencia.md` | Separa hecho, interpretación y supuesto. Permite elegir el problema con evidencia y defenderlo ante el jurado | P1 | Brainstorming, forge, spec, pitch | Siempre |
| `research-<tema>.md` | Responde preguntas de dominio que bloquean la decisión | P3 | P1, P2 | Solo si hay preguntas de dominio abiertas |
| `brainstorm-<tema>.md` | Reduce las opciones a ≤3 | P1 | Equipo | Solo si no hay una propuesta obvia |
| `forge-<slug>.md` | Es la base del GO o NO-GO de las 13:30 | P1 | Spec | Siempre (abreviado en B) |
| `spec-<slug>.md` | Fija el contrato del MVP y lo que queda fuera. Los tickets citan sus `CAP-N` | P1 | Tickets, builds | Siempre |
| `architecture-<slug>.md` | Evita que tres personas construyan piezas incompatibles. **Registra el modo de presentación** | P2 | Builds | En A. En B se sustituye por `contratos.md` |
| `contratos.md` | Acuerdo técnico mínimo de la ruta B, incluido el modo de presentación | P2 | Builds | Solo en B |
| `ux-<slug>/` | Define el flujo de la demo pantalla por pantalla. Su mock HTML puede servir para la validación de las 19:00 | P3 | Builds de frontend | Solo si la interfaz es central para la demo |
| `AGENTS.md` (bloque) | Da las mismas reglas a Claude Code, Codex y OpenCode | P2 | Los agentes | Siempre |
| `tickets.toml` | Permite el reparto en paralelo y las dependencias | P2 | Todos | Siempre |
| Plan de cada ticket | Lo genera `bmad-build`; guarda el estado y la revisión | Quien lo construye | P2 | Automático |
| `demo-estado.md` | Declara qué es real, qué es grabado y qué es simulado. Protege la credibilidad ante el jurado | P1 (redacta), P2 (valida) | Jurado, pitch | Siempre |
| `README.md` | Cómo acceder a la solución: la URL si hay despliegue, o los pasos exactos para ejecutarla en local. Enlaza a `demo-estado.md` | P2 | Jurado | Siempre, listo a las 08:30 |

**Señal de exceso de metodología:** cualquier documento que no tenga una decisión que permita, o un lector concreto, sobra.

### Formato de `evidencia.md`

| # | Fuente (quién, rol) | Hecho (lo que dijo o mostró) | Interpretación (lo que creemos que significa) | Supuesto (lo que falta comprobar) | Quién lo valida |
|---|---|---|---|---|---|

### Preguntas para mentores, empresas y usuarios

- ¿Quién sufre exactamente el problema, y cuándo fue la última vez que le pasó?
- ¿Cómo lo resuelven hoy y cuánto les cuesta (tiempo, dinero, errores)?
- ¿Qué intentaron que no funcionó, y por qué?
- ¿Qué datos o APIs reales podemos usar?
- ¿Qué haría que el jurado o la empresa dijeran "esto lo usaría mañana"?
- ¿Qué está fuera de los límites (regulación, privacidad, seguridad)?
- ¿Cómo medirían el éxito?
- **¿Cómo esperan ver la solución: desplegada, en local, en otro formato?** Ayuda a decidir el modo de presentación.

Meta [Eq]: unas 5 entrevistas, o al menos 3 fuentes que coincidan en el mismo dolor. La mayoría deberían hacerse en el coffee break de las 11:00, cuando los mentores están disponibles [Confirmado].

### Matriz para comparar propuestas

| Propuesta | Peso de la rúbrica cubierto | Evidencia del dolor | Factibilidad en 24 h | Riesgo de integración | Total |
|---|---|---|---|---|---|

---

## 5. Ruta A: la recomendada (cronograma por persona)

Los horarios internos son **[Eq]**; las comidas y los breaks son **[Confirmado]**. A = activo, C = consulta puntual (≤10 min), Ap = aprobación.

Personas [Confirmado]: **P1 Jostin · P2 Jean Pierre · P3 Manuel Alexis · P4 Sandro David · P5 Luis Armando**. Detalle en `EQUIPO.md`.

| Hora | P1 Producto (Jostin) | P2 Tech lead (Jean Pierre) | P3 Frontend/UX (Manuel Alexis) | P4 Backend/IA (Sandro David) | P5 DevOps/QA (Luis Armando) |
|---|---|---|---|---|---|
| 08:30–09:30 | Apertura y sorteo, esperando el reto. **No es tiempo de trabajo** [Confirmado] | | | | |
| **09:30–10:00 (H0)** | A: dirige la lectura del reto y la rúbrica → `reto.md` (desde la plantilla); `bmad` (crea la iniciativa); prepara las preguntas | A: lectura; activa la iniciativa | A: lectura; activa | A: lectura; activa | A: lectura; activa |
| 10:00–11:00 | A: entrevistas → `evidencia.md` | A: inventario técnico del reto (APIs, datos, créditos). C para P3 y P5 en la sincronización de las 10:45 | A: `bmad-deep-recon` en modo de investigación en la sesión (si aplica) | A: coentrevista; pregunta por datos, APIs y restricciones | A: spike desechable de la integración más arriesgada |
| 11:00–11:30 (coffee) | A: entrevista a mentores | A: preguntas técnicas a mentores (APIs, datos, formato de la demo) | A: escucha las entrevistas con mentores | A: coentrevista; preguntas de datos e IA | A: termina el spike |
| 11:30–12:00 | A: consolida `evidencia.md` | A: cierra el inventario técnico | A: cierra el research y lee `evidencia.md` | A: consolida la evidencia con P1 | A: nota del spike |
| 12:00–12:45 | A: dirige `bmad-brainstorming` | A | A | A | A |
| 12:45–13:30 | A: `bmad-forge-idea` | A | A | A | C en forge; A: viabilidad de los entornos candidatos (despliegue o local) |
| **13:30** | **Ap: GO** | **Ap: GO** | — | — | — |
| 13:30–14:00 | A: `bmad-spec` | A: `bmad-architecture` | A: `bmad-ux` (si aplica) | A: con P2 en contratos de datos e IA | C: entornos (10 min); A: revisa la protección de `main` y las plantillas de CI preparadas |
| 14:00–15:00 | Almuerzo | Almuerzo | Almuerzo | Almuerzo | Almuerzo |
| 15:00–15:45 | A: `bmad-spec` | A: `bmad-architecture`, incluida la **decisión del modo de presentación**; Ap: P1 | A: `bmad-ux` | A: con P2 | A: con P2 en el modo de presentación; luego activa la plantilla de CI del stack elegido |
| 15:45–16:15 | A: `bmad-spec` (actualizar para incorporar la arquitectura y la UX) | A: `bmad-project-context`; Ap: spec (16:05–16:15) | A: termina la UX; luego componentes base | A: stubs de contratos y datos de prueba | A: `bmad-build` del esqueleto (texto libre) en el modo elegido |
| 16:15–17:00 | Ap: prioridades de los tickets | A: `bmad-ticket` ("incept the epic", sin el esqueleto) | C: estimación | C: estimación | A: esqueleto |
| **17:00** | **Tope de planificación: tickets aprobados** | | | | |
| 17:00–20:00 | Ap: acepta cada PR. A: guion y datos de la demo. A: **19:00 prototipo o mock ante un mentor o usuario** | A: integración y Ap de PRs (ventanas de 18:30 y 19:45). Solo tickets cortos que no bloqueen a nadie | A: tickets de interfaz; 19:00 con P1 | A: tickets de backend o IA. Graba respuestas reales (17:00–19:45) | A: **esqueleto ejecutable con CI a las 17:45**; luego tickets |
| 20:00–21:00 | Cena | Cena | Cena | Cena | Cena |
| 21:00–22:30 | Ap: aceptación | A: integración (ventana de 22:30) | A: tickets | A: tickets | A: tickets; si hay despliegue, prueba de acceso externo |
| **22:30** | **Ap: flujo completo demostrable** en el entorno elegido | A | A | A | A: **prueba la demo en el portátil principal y en el de respaldo** |
| 22:30–00:00 | A: borrador del pitch con evidencia | A: integración (ventana de 00:00) | A hasta 23:00; **duerme 23:00–01:30** | A: tickets | A: `bmad-qa-generate-e2e-tests` (23:30–01:30) |
| 00:00–02:45 | A: pitch; Ap: aceptación | **Duerme 00:00–02:30** | Duerme hasta 01:30; luego A: tickets | A hasta 01:30; **duerme 01:30–04:00** | A: E2E hasta 01:30; integración (cubre a P2) hasta 02:30; **duerme 02:30–05:00** |
| 02:45–03:15 (break) | Break | Break | Break | Duerme | Duerme |
| **03:15** | **Ap** | **Ap: tag `freeze`** | — | — | — |
| 03:15–06:00 | A: `demo-estado.md` hasta 04:00; **duerme 04:00–06:30** | Ap: correcciones `fix/` | A: correcciones | Duerme hasta 04:00; luego A: verifica los modos grabado y simulado | Duerme hasta 05:00; luego A: correcciones y E2E en la CI |
| **06:00** | Duerme | **A: versión final** (tag `demo-v1`) con P5 | A: graba el video de respaldo (06:00–06:30) | A: prueba el respaldo de IA (cambio de proveedor) y el modo grabado | A: despliegue final o versión local, **probada en el portátil principal y en el de respaldo** |
| 06:30–08:30 | A: entregables y `bmad-review` del guion; `bmad-party-mode` como jurado simulado; dirige los ensayos | A: `README.md`; maneja la demo en los ensayos | A: ensayos | A: ensayos | A: vigila la versión final |
| **08:30** | **Ap: versión final y entregables listos** | Ap | — | — | — |
| 08:30–09:00 | A: comprueba y envía los entregables (si la plataforma lo permite) | A: verifica `main` y el acceso a la solución | — | — | A: verifica el despliegue o el arranque local |
| 09:00–09:30 | Margen para incidencias de entrega | | | | |
| **09:30 (H24)** | **Stop de desarrollo y bloqueo de repositorios** | | | | |
| 09:30–10:30 | A: último ensayo, sin desarrollo | A | A | A | A: vigila que la solución siga accesible si el jurado la necesita [Pendiente] |
| **10:30** | **Pitch** (presentador por definir; P1 aporta el guion y la evidencia) | **Maneja la demo** en su portátil | Apoyo en preguntas | Apoyo en preguntas | Guardia técnica; portátil de respaldo listo |

### Turnos de sueño [Eq]

| Persona | Turno | Motivo |
|---|---|---|
| P3 · Manuel Alexis | 23:00–01:30 | Después del flujo completo |
| P2 · Jean Pierre | 00:00–02:30 | P5 cubre la integración; P2 vuelve para el congelamiento |
| P4 · Sandro David | 01:30–04:00 | Vuelve para verificar los modos grabado y simulado |
| P5 · Luis Armando | 02:30–05:00 | Después de las E2E; vuelve para la versión final |
| P1 · Jostin | 04:00–06:30 | Acepta el congelamiento y llega descansado a los entregables y al pitch |

Nunca duermen más de dos personas a la vez, P2 y P5 nunca coinciden, y quien lleva el congelamiento (P2) está despierto a las 03:15.

### Hitos y presupuesto de tiempo

| Hora | Hora del hackathon | Hito | Tipo |
|---|---|---|---|
| 09:30 | H0 | Inicio del desarrollo | [Confirmado] |
| 09:30–10:00 | H0 | Reto, rúbrica, iniciativa y preguntas listas | [Eq] |
| 11:00–11:30 | H1:30 | Entrevistas con mentores | [Confirmado] (horario); [Eq] (uso) |
| **13:30** | H4 | **GO o NO-GO** | [Eq] |
| **15:45** | H6:15 | **Modo de presentación decidido** | [Eq] |
| **17:00** | H7:30 | **Tope de planificación: tickets aprobados** | [Eq] |
| **17:45** | H8:15 | **Esqueleto ejecutable con CI en el modo elegido** | [Eq] |
| 18:15 | H8:45 | Señal de alarma si no hay esqueleto ejecutable | [Eq] |
| **19:00** | H9:30 | **Prototipo o mock ante un mentor o usuario** | [Eq]; la disponibilidad de mentores a esa hora es [Pendiente] |
| **22:30** | H13 | **Flujo completo funcionando y demostrable** (hito obligatorio), probado en el portátil principal y en el de respaldo | [Eq] |
| 23:30–01:30 | H14–16 | Pruebas E2E del flujo crítico | [Eq] |
| **03:15** | H17:45 | **Congelamiento de funcionalidades** | [Eq] |
| 03:15–06:00 | H17:45–20:30 | Correcciones y estabilización | [Eq] |
| **06:00** | H20:30 | **Versión final** (tag `demo-v1`), probada en ambos portátiles, y video de respaldo | [Eq] |
| **08:30** | H23 | **Versión final y entregables listos** | [Eq] |
| 08:30–09:00 | H23–23:30 | Comprobar y enviar | [Eq] |
| 09:00–09:30 | H23:30–24 | Margen para incidencias de entrega | [Eq] |
| 09:30 | H24 | Stop de desarrollo y bloqueo de repositorios | [Confirmado] |
| 10:30 | — | Pitch (sin tiempo de desarrollo) | [Confirmado] |

### Equipo

| Rol | Persona [Confirmado] | Responsabilidades | Por qué así |
|---|---|---|---|
| P1 | Jostin | Producto, investigación, alcance, guion del pitch, entregables y **aceptación funcional** | No programa. Así alguien mira el producto con los ojos del jurado. **Quién presenta el pitch está por definir** |
| P2 | Jean Pierre | Liderazgo técnico, arquitectura, integración, dueño de los tickets, revisor del flujo de la demo, manejo de la demo en su portátil (principal) y **responsable de BMad** | Instaló BMad y la demo corre en su portátil. Solo tickets cortos que no bloqueen a nadie, para que la revisión no se atasque |
| P3 | Manuel Alexis | Frontend y experiencia; investigación del dominio en la mañana | Escucha las entrevistas del coffee break y lee `evidencia.md`, porque quien diseña la experiencia tiene que conocer al usuario. Valida el prototipo con P1 a las 19:00 |
| P4 | Sandro David | Backend, datos o IA; coentrevista con P1 en la mañana | Escuchar de primera mano qué datos, APIs y restricciones hay le ayuda a diseñar su parte. Graba las respuestas reales que alimentan el modo grabado |
| P5 | Luis Armando | CI, entorno de demostración (despliegue o local), QA, apoyo en integración, **respaldo de BMad** y portátil de respaldo | **Comprueba la viabilidad del entorno desde las 12:45**, no al final. Cubre integración, PRs y dudas de BMad mientras P2 descansa |

---

## 6. Criterios para empezar a programar

Se puede escribir código del producto para un ticket cuando se cumplen las cuatro condiciones:

1. **Problema entendido:** usuario y dolor respaldados por al menos una fuente directa de `evidencia.md`.
2. **Alcance acordado:** la spec contiene la `CAP-N` que cubre el ticket y la lista de lo que queda fuera, aprobadas por P1 y P2.
3. **Contratos suficientes:** las interfaces y los datos que el ticket consume o expone están fijados, en la arquitectura o en `contratos.md`, y tienen un stub.
4. **Ticket verificable:** tiene `Verify:` y sus dependencias están listas o sustituidas por un stub.

**Excepciones:**

- Los **spikes** (código desechable para responder una pregunta concreta) se permiten a partir de las 09:30. No se integran en `main`.
- El **esqueleto** se permite en cuanto están decididos el stack y el modo de presentación.

**Señales de haber empezado demasiado pronto:**

- Hay código para un ticket que no cumple alguno de los cuatro criterios.
- Un spike se integra en `main`.
- Los tickets se reescriben cada hora.
- La propuesta se defiende con la tecnología y no con el problema.

**Señales de exceso de metodología:**

- A las 18:15 no hay esqueleto ejecutable ni tickets aprobados.
- Hay un documento sin una decisión que permita o sin lector concreto (sección 4).
- Se ejecuta una skill "porque toca".
- Se piden más de dos rondas de revisión del mismo cambio.
- Se debate el formato en lugar del contenido.

---

## 7. Cuándo omitir cada skill

| Skill | Se omite cuando |
|---|---|
| `bmad-deep-recon` | No hay preguntas de dominio que bloqueen la decisión |
| `bmad-brainstorming` | Hay una propuesta respaldada por la evidencia y por los mentores |
| `bmad-forge-idea` | Nunca en A. En B se limita a 30 min **[Eq]** |
| `bmad-ux` | La demo no depende de la interfaz (API, bot, CLI) |
| `bmad-architecture` | Ruta B; se sustituye por `contratos.md` |
| `bmad-spec` (actualizar) | No se ejecutaron ni la arquitectura ni la UX |
| `bmad-code-review` | El PR pasó la revisión de `bmad-build` y no toca el flujo de la demo |
| `bmad-correct-course` | El cambio solo afecta a la spec (en ese caso `bmad-spec` actualizar) o solo a los tickets (en ese caso `bmad-ticket`) |
| `bmad-qa-generate-e2e-tests` | En B, si a las 01:30 no hay tiempo: se sustituye por una lista de comprobación manual |

**No se usan en esta hackathon:**

| Skill | Motivo |
|---|---|
| `bmad-prd`, `bmad-prfaq` | Demasiado pesadas para 24 h |
| `bmad-product-brief` | Solo si después de forge el producto no cabe en dos frases |
| `bmad-build-auto` | No hace preguntas y se detiene ante cualquier duda |
| `bmad-retrospective`, `bmad-walkthrough` | Cuestan tiempo y no aportan aquí |
| `bmad-customize`, `bmad-toolsmith`, `bmad-eval` | Sirven para mantener BMad, no para el producto |
| `bmad-agent-*` | Son otra entrada a las mismas skills |
| `bmad-advanced-elicitation` | Opcional, solo para un pre-mortem del pitch |

### Decisiones condicionales

| Situación | Qué hacer |
|---|---|
| El reto está poco claro | `bmad-forge-idea` sobre el propio reto, y preguntas a los mentores en el coffee break de las 11:00 |
| Hay que investigar el dominio | `bmad-deep-recon` en modo de investigación dentro de la sesión (búsquedas web en paralelo), en una pasada rápida centrada en la decisión. Si alguien tiene una herramienta de deep research, puede usar el modo que genera el prompt y luego procesar el informe, pero no es necesario |
| Ya hay suficiente evidencia | Omitan `bmad-deep-recon` y `bmad-brainstorming`; vayan directo a `bmad-forge-idea` |
| Hay demasiadas propuestas | Que `bmad-brainstorming` converja a ≤3 y las puntúen en la matriz. Con un empate, `bmad-party-mode` 15 min y luego `bmad-forge-idea` sobre la ganadora |
| La interfaz es importante | `bmad-ux`, en paralelo con la arquitectura |
| No hay interfaz | Omitan `bmad-ux`; el flujo de la demo se describe en la spec |
| El alcance cabe en una épica | Es lo esperable: spec, `bmad-ticket` "incept the epic" y `bmad-build` por ticket |
| Hacen falta varias épicas | Primero se recorta el alcance. Si se mantiene, `bmad-ticket` "split this initiative into epics", una persona dueña por épica y la arquitectura como documento obligatorio para todas |
| Cambia un requisito durante la implementación | Si solo afecta a la spec: `bmad-spec` (actualizar), que indica qué tickets dejan de coincidir. Si también afecta a la arquitectura o a la UX: `bmad-correct-course` (necesita la spec; propone cambios que luego se aplican con `bmad-ticket`) |
| Solo hay spec y cambia el alcance | `bmad-spec` (actualizar); no se edita a mano. Luego `bmad-ticket` para reordenar |
| Un ticket bloquea a otros | Su dueño publica un stub del contrato, y `bmad-ticket` ("what's blocked") reordena el trabajo. Si hace falta, se divide el ticket |
| El despliegue resulta inviable a las 17:45 | Cambiar a ejecución local (sección 8) en la ventana de integración de las 18:30; P2 lo registra en la arquitectura |

---

## 8. Modo de presentación y modos de integración

### Decisión del modo de presentación [Eq]

Se decide a las **15:45**, durante `bmad-architecture` (o en `contratos.md` en la ruta B). La toma P2 con P5 y la aprueba P1.

**Criterios:**

1. Lo que exijan los organizadores [Pendiente].
2. El tipo de producto: web, móvil, API, datos, IA o dispositivo.
3. Si el jurado necesita usar la solución por su cuenta, o le basta con verla en el pitch.
4. El costo y el riesgo de configurar un despliegue en el tiempo disponible.
5. La dependencia de servicios externos y de la red del evento.

| | **Despliegue** | **Ejecución local** |
|---|---|---|
| Cuándo conviene | El jurado tiene que acceder por su cuenta, o el producto es web por naturaleza | La demo es en vivo desde nuestro equipo, o la red y el hosting son un riesgo |
| Comprobación temprana | P5 prueba la viabilidad del hosting entre 12:45 y 13:30, sin código del producto, y el esqueleto desplegado a las 17:45 | P5 comprueba a las 17:45 que el esqueleto arranca desde cero en una máquina limpia |
| Tiempo reservado | Configuración (15:45–17:45), prueba de acceso externo (21:00–22:30), prueba en ambos portátiles (22:30 y 06:00) y acceso del jurado (08:30–09:00) | Prueba en el portátil principal y en el de respaldo a las 22:30 y a las 06:00 |
| Documentación | `README.md` con la URL, las credenciales de prueba si hacen falta y `demo-estado.md` | `README.md` con los requisitos y los comandos exactos de arranque, probados por alguien que no los escribió |
| Respaldo | Ejecución local con un solo comando en el portátil de respaldo, video y modo grabado | Portátil de respaldo con la misma versión, video y modo grabado |
| Confirmar con los organizadores | Si el servicio debe seguir activo tras el bloqueo [Pendiente] | Cómo evaluará el jurado la solución [Pendiente] |

### Integración real, grabada y simulada

| Modo | Qué es | Cuándo se usa |
|---|---|---|
| **Real** | Llama al servicio en vivo | Modo por defecto en la demo si el servicio responde |
| **Grabado** | Respuestas reales capturadas entre 17:00 y 19:45 y reproducidas tal cual | Si el servicio falla o es lento durante la demo |
| **Simulado (mock)** | Datos inventados por nosotros, con la forma del contrato | Desarrollo antes de que exista la integración, y piezas que no llegamos a construir |

**Cómo se aplica:**

- La arquitectura o `contratos.md` define un adaptador por servicio con `MODE=live|recorded|mock`.
- `AGENTS.md` incluye la regla: "toda llamada externa pasa por su adaptador".

**Cómo se declara:**

- `demo-estado.md`, listo a las 08:30, y **una diapositiva** con la tabla Componente / Modo / Por qué / Qué faltaría para que sea real.
- Un indicador discreto en la app con el modo activo.
- Si durante la demo salta el modo de respaldo, se dice en voz alta.

**Regla:** nunca se presenta como real algo grabado o simulado.

### Plan B ante fallos externos

- Para la IA: respuestas en caché para el flujo de la demo y límites de llamadas. **OpenAI y Claude como respaldo mutuo** detrás del mismo adaptador, con el cambio de proveedor probado a las 06:00. Solo con modelos cuyo saldo y límites se comprobaron antes del evento.
- Si falla el despliegue: ejecución local con un solo comando.
- Si falla la red: hotspot del móvil.
- Último recurso: video de la demo grabado a las 06:00.

---

## 9. Ruta B: la comprimida

**Cuándo se activa:**

- Si en el punto de decisión de las 13:30 no hay GO: se fuerza la decisión a las 14:00 con `bmad-forge-idea` (máximo 30 min) sobre la mejor candidata.
- Si a las 18:15 no hay esqueleto ejecutable: se recorta con `bmad-spec` (actualizar), lo no crítico pasa a modo simulado y, si el despliegue es la causa, se cambia a ejecución local.

| Hora [Eq] | Paso | Responsable (A) | Participan |
|---|---|---|---|
| 13:30–14:00 | `bmad-forge-idea` (máximo 30 min) → decisión forzada a las 14:00 | P1 | Todos |
| 14:00–15:00 | Almuerzo | — | — |
| 15:00–15:30 | `bmad-spec`, con una lista agresiva de lo que queda fuera | P1 | Ap: P2 |
| 15:00–15:30 | **`contratos.md`** (sin skill, 1 página): interfaces y forma de los datos, modelo de datos, servicios externos con su modo, **modo de presentación**, módulo que es responsabilidad de cada persona | P2 | A: P4 y P5; C: P3 |
| 15:30–15:45 | `bmad-project-context` | P2 | — |
| 15:30– | `bmad-build` del esqueleto | P5 | — |
| 15:45–16:15 | `bmad-ticket`, 5–8 tickets | P2 | Ap: P1 |
| 16:15–04:00 | `bmad-build` con revisión `quick`; `bmad-code-review` solo en el flujo de la demo | Devs | Ap: P2 |

Se omiten `bmad-brainstorming`, `bmad-party-mode`, `bmad-ux` y `bmad-architecture`. `contratos.md` es el acuerdo técnico mínimo: evita que tres personas construyan piezas que no encajan, que es el riesgo que cubría la arquitectura.

**Hitos de B [Eq]:**

- Flujo completo demostrable a las 00:30.
- Congelamiento a las 04:00.
- Versión final a las 06:30.
- **Los entregables siguen listos a las 08:30**, y la ruta B no recorta los ensayos.

---

## 10. Preparación previa al evento

**Qué se permite [Confirmado]:** preparar previamente skills, scripts, plantillas y configuración de CI. **Qué no:** módulos funcionales del producto, una aplicación base o código trasladado de ensayos.

**Límite práctico [Eq]:** lo que se prepare tiene que servir para cualquier reto. Si un archivo solo tiene sentido para un producto concreto, es código del producto y no se lleva.

### Repositorio del evento (versionado antes del evento)

| # | Tarea | Riesgo que reduce | Responsable [Eq] |
|---|---|---|---|
| 1 | Versionar `.agents/`, `skills-lock.json` y las skills; corregir los enlaces absolutos de `.claude/skills` (relativos o copias) | Que los compañeros clonen el repo sin skills | P2 · **Hecho** (copias en `.claude/skills`) |
| 2 | `bmad setup` y commit de `_bmad/`, **sin** la configuración personal (`_bmad/custom/config.user.toml` en `.gitignore`) | Que `bmad-build` y `bmad-ticket` no encuentren sus scripts | P2 · **Hecho** (BMad 6.13.0-next, `current: true`) |
| 3 | `AGENTS.md` con un bloque mínimo de reglas que no dependen del reto (ramas, PRs, adaptadores para servicios externos, nada de secretos en el repo), y `CLAUDE.md` con `@AGENTS.md` | Que Claude Code, OpenCode y Codex sigan reglas distintas | P2 |
| 4 | Plantillas de `reto.md`, `evidencia.md`, `demo-estado.md`, `README.md` y del guion del pitch | Formato improvisado bajo presión | P1 |
| 5 | Configuración de CI genérica: plantillas de flujo de trabajo para los 2 o 3 stacks de referencia (instalar, lint, pruebas, build), sin código de aplicación. Se activa la que corresponda cuando se elija el stack | Perder tiempo configurando CI durante el evento | P5 |
| 6 | Plantilla de PR (ticket, cómo verificar, modo real, grabado o simulado) y protección de `main` | PRs sin contexto y cambios directos en `main` | P5 |
| 7 | Script de comprobación de las APIs de IA: verifica las claves y los modelos disponibles **sin guardar secretos en el repo** | Descubrir a las 15:00 que una clave o un modelo no funciona | P4 (Sandro David) |

### Equipos y cuentas de cada persona

| # | Tarea | Riesgo que reduce | Responsable [Eq] |
|---|---|---|---|
| 8 | `uv`, Git, `gh` y la herramienta de IA de cada persona instalados y con sesión iniciada | Bloqueos de entorno a las 09:30 | Cada persona |
| 9 | **Decidir qué herramienta (Claude Code, OpenCode o Codex) usa cada persona** y comprobar en su clon que ve las skills e invoca `bmad` | Confirmar el supuesto de que las tres ven las skills | P2 coordina · **En curso:** asignación hecha (ver `EQUIPO.md`); Claude Code y Codex comprobados; falta la herramienta de Jostin y las pruebas de cada integrante |
| 10 | **Comprobar saldo, límites de uso y modelos disponibles en OpenAI y en Claude**, y anotar cuáles se pueden usar en el producto y cuáles en los agentes | Quedarse sin saldo o con límites de uso en mitad del evento | P4 |
| 11 | Claves y créditos en un gestor de secretos compartido, nunca en el repo | Filtración de claves o bloqueo de acceso | P4 |
| 12 | Cuentas en GitHub y en 1–2 servicios de hosting candidatos (por si se elige despliegue) | Bloqueo de accesos el día del evento | P5 |
| 13 | **Elegir el portátil principal y el de respaldo** y dejar ambos con navegador, runtimes de los stacks de referencia, adaptador de vídeo y cargador | Fallos en la ejecución local o en la conexión al proyector | Principal: el de Jean Pierre (P2) [Confirmado]. Respaldo: el de Luis Armando (P5) [Confirmado] |

### Práctica y coordinación

| # | Tarea | Riesgo que reduce | Responsable [Eq] |
|---|---|---|---|
| 14 | Ensayo de 1 h con un reto de juguete en un **repositorio de práctica aparte**: spec → ticket → build → PR, con las tres herramientas. **Nada de ese repositorio pasa al del evento** [Confirmado] | Fricción la primera vez y tiempos desconocidos | P2 |
| 15 | Evaluar sobre el papel 2 o 3 stacks de referencia con sus opciones de despliegue y ejecución local | Ahorra tiempo en la arquitectura; la elección final depende del reto [Confirmado] | P2 |
| 16 | Acordar los turnos de sueño de la sección 5 | Un integrador agotado a las 03:15 | P1 |

---

## 11. GitHub [Eq]

### Una sola rama `main`

- **`main` siempre ejecutable** en el modo de presentación elegido.
- **Si hay despliegue:** `main` se despliega automáticamente a una URL de pruebas, y producción solo se actualiza al crear un tag `demo-*` (P5, después de que P1 valide el recorrido). Si el hosting ofrece vistas previas por PR, se usan.
- **Si hay ejecución local:** el tag `demo-*` marca la versión probada en el portátil principal y en el de respaldo.
- **Si algo se rompe:** se vuelve al tag `demo-stable` anterior.

**Por qué no usar `develop` como entorno local y `main` como producción:**

- "Local" es la máquina de cada persona, no una rama. `develop` sería un segundo punto de integración compartido.
- Cada funcionalidad se integraría dos veces, y la integración de `develop` a `main` acabaría de madrugada.
- Si alguien olvida integrar `develop` en `main` antes del bloqueo de las 09:30, el jurado evalúa código viejo.
- Los estados de los tickets y los planes de `bmad-build` vivirían en dos versiones distintas de `tickets.toml` y de la spec.

Si al final se usa `develop`, la regla es integrarla en `main` en cada ventana de integración y por última vez a las 08:30.

### Reglas

- **Ramas:** `t/<ref>-<slug>`, `fix/…`, `spike/…` (nunca se integra) y `plan/…`.
- **Antes de `bmad-build`:** crear la rama desde `main` y dejar el árbol de trabajo limpio [BMad].
- **Al terminar `bmad-build`:** hace un commit local; push y `gh pr create` los hace la persona [BMad].
- **PRs:** de ≤400 líneas, con merge por squash.
- **`main` protegida:** PR obligatorio, CI en verde y una aprobación.
- **Revisión:** P2 en el flujo de la demo; P3 y P4 se revisan entre sí el resto. Mientras P2 duerme (00:00–02:30), P5 aprueba.
- **Aceptación funcional:** P1.
- **Ventanas de integración:** 18:30, 19:45, 22:30, 00:00 y 03:00. Cada dev integra al menos cada 2 h, tras hacer rebase.
- **Estado de los tickets:** P2 marca "done" en `main` en cada ventana de integración, para que solo una persona escriba los estados.
- **Congelamiento:** a las 03:15, con el tag `freeze`; después solo `fix/` aprobados por P2.
- **Versión final:** tag `demo-v1` a las 06:00; después, solo un nuevo tag si P1 valida el recorrido completo.
- **Entregables:** listos en `main` a las 08:30; después de las 09:00 no se integra nada salvo una incidencia de entrega.
- **Demo protegida:** la prueba E2E del flujo de la demo es obligatoria en la CI.
- **Propiedad de documentos:** cada documento de la sección 4 tiene un único responsable, que lo cambia mediante una rama `plan/` integrada de inmediato.

---

## 12. Errores comunes

- Contar con la franja de 08:30 a 09:30 para trabajar.
- Llegar al evento sin haber comprobado el saldo, los límites y los modelos de OpenAI y Claude.
- Probar la demo solo en un portátil, o en uno que no sea el que se usará para presentar.
- Llevar en las plantillas o en la CI algo que solo sirva para un producto concreto.
- Llevar código del producto preparado o copiar código del repositorio de práctica.
- Tomarse el coffee break de las 11:00 como descanso en lugar de entrevistar a los mentores.
- Programar la idea antes de haber entrevistado a nadie.
- Dejar la validación con el prototipo para después de la cena, cuando puede que ya no haya mentores.
- Que cada persona tenga activa una iniciativa distinta.
- Invocar `bmad-build` sin nombrar el ticket, o sin haber creado antes la rama.
- Editar la spec a mano en varias ramas a la vez.
- Decidir el modo de presentación tarde, o probar el despliegue o el arranque local por primera vez de madrugada.
- Confundir el bloqueo del repositorio con el apagado del servicio.
- Depender de una API en vivo durante la demo sin modo grabado o simulado.
- Presentar como real algo grabado o simulado.
- Tickets que no caben en una sesión.
- Revisión `thorough` en todos los PRs: cada una puede costar 30 min o más.
- Dejar los entregables para las 09:25.
- Que el pitch no muestre la evidencia de las entrevistas.

---

## 13. Secuencia final de comandos

```
PREPARACIÓN: skills, scripts, plantillas y CI en el repo; APIs comprobadas;
             herramienta por persona; portátiles principal y de respaldo;
             ensayo en un repositorio aparte (sección 10)

08:30  apertura y sorteo (no es tiempo de trabajo)
09:30  (P1)  lectura del reto y la rúbrica      → reto.md (desde la plantilla)
       (P1)  bmad                                → iniciativa (los 5 la activan)
10:00  (P1/P4) entrevistas  ∥ (P3) bmad-deep-recon  ∥ (P5) spike  → evidencia.md
11:00  coffee break = entrevistas con mentores
12:00  (P1)  bmad-brainstorming                  → ≤3 propuestas
12:45  (P1)  bmad-forge-idea                     → GO a las 13:30  (si no hay GO → ruta B)
13:30  (P1)  bmad-spec ∥ (P2) bmad-architecture ∥ (P3) bmad-ux*
14:00  almuerzo
15:00  continúan spec, arquitectura y UX         → 15:45 modo de presentación decidido
15:45  (P1)  bmad-spec (actualizar) ∥ (P2) bmad-project-context ∥ (P5) bmad-build del esqueleto
16:15  (P2)  bmad-ticket "incept the epic"       → tickets aprobados a las 17:00
17:00  (devs) git switch -c t/1.N-…  →  bmad-build "build story 1.N"  →  push + PR
       (P2)  bmad-code-review (flujo de la demo) → merge → (P2) bmad-ticket "mark 1.N done"
17:45  esqueleto ejecutable con CI   ·   19:00 prototipo o mock ante un mentor
20:00  cena
22:30  FLUJO COMPLETO DEMOSTRABLE (hito obligatorio), probado en ambos portátiles
23:30  (P5)  bmad-qa-generate-e2e-tests
03:15  FREEZE → solo fix/ con bmad-build
06:00  versión final (tag demo-v1) probada en ambos portátiles + cambio de proveedor de IA + video
06:30  (P1)  entregables + bmad-review del guion → bmad-party-mode como jurado → ensayos
08:30  versión final y entregables listos
09:00  entregables comprobados y enviados
09:30  STOP DE DESARROLLO Y BLOQUEO DE REPOSITORIOS
10:30  PITCH (sin desarrollo)
* solo si la interfaz es central para la demo
```
