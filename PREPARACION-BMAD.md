# Preparación de BMad para la hackathon

**BMad ya está instalado y configurado en este repositorio.** Cada integrante solo tiene que preparar su máquina, clonar el repositorio y comprobar que su herramienta de IA ve las skills. El día del evento, el equipo empieza directamente con la metodología.

Los organizadores permiten preparar previamente skills, scripts, plantillas y configuración de CI. **No permiten llevar módulos funcionales del producto**: en este repositorio no hay, ni debe haber, código de la solución antes de las 09:30.

## Cómo leer esta guía

| Etiqueta | Significa |
|---|---|
| **[Verificado]** | Comprobado al instalar o en los archivos de BMad de este repositorio |
| **[No verificado]** | Comportamiento de herramientas externas que hay que comprobar en el ensayo |
| **[Recomendación]** | Decisión del equipo, no un requisito de BMad |

| Tipo de instrucción | Cómo aparece |
|---|---|
| **Terminal** | Bloques `powershell` (Windows) o `bash` (macOS, Linux o Git Bash). Se ejecutan en una terminal, en la raíz del repositorio |
| **Chat** | Bloques `text` marcados como "Chat de Claude Code", "Chat de Codex" o "Chat de OpenCode". Se escriben dentro de la herramienta de IA, no en la terminal |

**Responsable de BMad [Recomendación]:** P5. Respaldo: P2. Son los únicos que tocan la instalación.

---

## 1. Qué hay instalado [Verificado]

| Dato | Valor |
|---|---|
| Versión de BMad | `6.13.0-next` en los tres módulos: `core-tools`, `method` y `toolsmith` |
| Estado frente a la versión publicada | Al instalar, `bmad status` indicó `current: true`, sin actualizaciones pendientes, problemas ni preguntas de configuración |
| Skills | 30 que se pueden invocar y 3 registros internos (`bmod-core-tools`, `bmod-method`, `bmod-toolsmith`) |
| Skills para Codex y OpenCode | `.agents/skills/` |
| Skills para Claude Code | `.claude/skills/`: **copias reales** de `.agents/skills/` (antes eran enlaces con rutas absolutas de una sola máquina) |
| Configuración del equipo | `_bmad/config.toml`: `project_name = "Hackathon-LagTeam"`, `output_folder = "{project-root}/_bmad-output"` |
| Scripts | `_bmad/scripts/` (compartidos) y `_bmad/method/scripts/tickets.py` (tickets y builds) |
| Artefactos | `_bmad-output/`, vacía por ahora, con `.gitkeep` |
| Protección de datos personales | `_bmad/custom/.gitignore` (`*.user.toml`) y `.gitignore` en la raíz |

**Las 30 skills:**

| Módulo | Skills |
|---|---|
| core-tools | `bmad`, `bmad-brainstorming`, `bmad-forge-idea`, `bmad-deep-recon`, `bmad-advanced-elicitation`, `bmad-review`, `bmad-party-mode`, `bmad-customize` |
| method | `bmad-spec`, `bmad-product-brief`, `bmad-prfaq`, `bmad-prd`, `bmad-ux`, `bmad-architecture`, `bmad-ticket`, `bmad-build`, `bmad-build-auto`, `bmad-correct-course`, `bmad-code-review`, `bmad-walkthrough`, `bmad-qa-generate-e2e-tests`, `bmad-retrospective`, `bmad-project-context`, `bmad-agent-analyst`, `bmad-agent-pm`, `bmad-agent-ux-designer`, `bmad-agent-architect`, `bmad-agent-dev` |
| toolsmith | `bmad-toolsmith`, `bmad-eval` |

---

## 2. Preparación individual (cada integrante, antes del evento)

### 2.1 Software

| # | Qué | Para qué | Comprobación (terminal) |
|---|---|---|---|
| 1 | Git | Clonar y trabajar con ramas | `git --version` |
| 2 | GitHub CLI (`gh`), con sesión iniciada | Abrir PRs (`bmad-build` hace commit, pero no push) | `gh auth status` |
| 3 | `uv` [Verificado: obligatorio para los scripts de BMad] | Ejecutar los scripts de BMad | `uv --version` |
| 4 | Python ≥ 3.11 gestionado por `uv` [Verificado: ≥ 3.11] | Requisito de los scripts. Instalarlo antes evita descargas en la red del evento | `uv python find` |
| 5 | Su herramienta de IA, con sesión iniciada | Trabajar con las skills | Ver 2.2 |

**Instalar `uv`** (comandos oficiales de Astral):

```powershell
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
uv python install 3.12
```

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
uv python install 3.12
```

### 2.2 Herramienta de IA

Comandos habituales de instalación. **[No verificado]**: confirmen con la documentación oficial de cada herramienta.

```bash
npm install -g @anthropic-ai/claude-code   # Claude Code → se inicia con: claude
npm install -g @openai/codex               # Codex       → se inicia con: codex
npm install -g opencode-ai                 # OpenCode    → se inicia con: opencode
```

### 2.3 Instalaciones globales de BMad

Si alguien tiene BMad instalado de forma global, su herramienta podría cargar otra versión. Comprobar:

```powershell
# Windows (PowerShell)
Get-ChildItem "$HOME\.agents\skills", "$HOME\.claude\skills" -Directory -Filter "bmad*" -ErrorAction SilentlyContinue
```

```bash
# macOS / Linux
ls -d ~/.agents/skills/bmad* ~/.claude/skills/bmad* 2>/dev/null
```

Si aparece algo, avisen a P5. No lo borren sin decidirlo juntos.

### 2.4 Claves de API

Las claves de OpenAI y Claude van en variables de entorno personales o en el gestor de secretos, **nunca en el repositorio**. Comprueben antes del evento el saldo, los límites de uso y los modelos disponibles.

---

## 3. Clonar y comprobar (cada integrante, antes del evento)

### 3.1 Comunes a todos

```bash
# Terminal
git clone https://github.com/PierreCodex/Hackathon-LagTeam.git
cd Hackathon-LagTeam
uv run --no-cache .agents/skills/bmad/scripts/setup.py --project-root . --skill .agents/skills/bmad --root .agents/skills --status
```

El último comando **no cambia nada** [Verificado]. En su salida JSON tiene que aparecer `"current": true` y `"problems": []`.

**No hay que ejecutar `bmad setup`.** `_bmad/` ya viene en el repositorio.

### 3.2 Según la herramienta

| | Claude Code | Codex | OpenCode |
|---|---|---|---|
| Iniciar (terminal, en la raíz) | `claude` | `codex` | `opencode` |
| Dónde busca las skills | `.claude/skills/` [Verificado] | `.agents/skills/` **[No verificado]** | `.agents/skills/` y/o `.claude/skills/` **[No verificado]** |
| Cómo se invoca una skill | `/nombre-skill` | Nombrándola en el mensaje (puede existir la sintaxis `$nombre-skill`, **[No verificado]**) | Nombrándola en el mensaje |
| Archivo de instrucciones que lee | `CLAUDE.md`, que importará `AGENTS.md` (se crean en el evento) | `AGENTS.md` | `AGENTS.md` |
| Comprobación extra | La primera vez puede pedir que confíe en la carpeta: aceptar | — | Comprobar que cada skill `bmad*` aparece **una sola vez** |

**Comprobación en el chat:**

```text
Chat de Claude Code:
/bmad status
```

```text
Chat de Codex u OpenCode:
Usa la skill bmad y muéstrame el estado de la instalación (bmad status). No cambies nada.
```

**Resultado esperado:** los módulos `core-tools`, `method` y `toolsmith` en la versión `6.13.0-next`, sin setup pendiente. Si ofrece actualizar, se responde que no.

**Avisen a P5 del resultado**, sobre todo quienes usen Codex u OpenCode: es la única parte que no se ha podido verificar.

### 3.3 Lista de comprobación

| # | Comprobación | Dónde | Resultado esperado |
|---|---|---|---|
| 1 | `uv --version` y `uv python find` | Terminal | Una versión de `uv` y una ruta de Python ≥ 3.11 |
| 2 | Versión de los módulos (sección 5) | Terminal | `6.13.0-next` las tres veces |
| 3 | `setup.py --status` (sección 3.1) | Terminal | `"current": true` |
| 4 | `bmad status` | Chat | Módulos instalados, sin setup pendiente |
| 5 | La herramienta lista las skills `bmad-*` | Chat | Aparecen, una vez cada una |
| 6 | `git status` | Terminal | Sin cambios |

---

## 4. El día del evento

### 4.1 Todos, a las 09:30

```bash
# Terminal
git pull
```

### 4.2 P1 crea la iniciativa en cuanto se conoce el reto

```text
Chat de Claude Code:
/bmad crea una iniciativa nueva llamada <nombre-del-reto> y actívala
```

Después, P1 hace commit y push de la carpeta `_bmad-output/initiative-<nombre>/`.

### 4.3 Los demás activan la misma iniciativa

```bash
# Terminal
git pull
```

```text
Chat de Claude Code:
/bmad activa la iniciativa initiative-<nombre-que-indique-P1>
```

```text
Chat de Codex u OpenCode:
Usa la skill bmad para activar la iniciativa initiative-<nombre-que-indique-P1>.
```

Esto crea o actualiza tu `_bmad/custom/config.user.toml`, que es personal y Git lo ignora [Verificado]. **Los cinco deben tener activa la misma iniciativa.**

A partir de aquí se sigue el plan del evento (`plan-hackathon-bmad-version-corregida.md`).

---

## 5. Mantener la misma versión entre todos

| Regla | Qué evita |
|---|---|
| Las skills y `_bmad/` están versionados en Git; nadie los descarga por su cuenta | Versiones distintas entre integrantes |
| **Nadie ejecuta** `npx skills add`, `npx skills update`, `bmad setup` ni acepta "actualizar BMad". Solo P5, y solo si el equipo lo decide antes del evento | Actualizaciones accidentales. El setup actualiza con `npx skills update -p -y` si se le pide [Verificado] |
| Nadie edita archivos dentro de `.agents/skills/`, `.claude/skills/` ni `_bmad/` | Que las dos copias de las skills diverjan |
| Para comprobar, solo `bmad status` o el comando `--status`, que no cambian nada | Cambios accidentales en `_bmad/` |
| [Recomendación] `CODEOWNERS` con P5 en `.agents/`, `.claude/skills/`, `_bmad/` y `skills-lock.json` | Que un PR cambie BMad sin que lo revise P5 |

**Comprobar la versión:**

```powershell
# Windows (PowerShell): tres líneas con 6.13.0-next
Select-String -Path .agents\skills\bmod-*\bmod.toml -Pattern '^version'
```

```bash
# macOS / Linux / Git Bash
grep -H '^version' .agents/skills/bmod-*/bmod.toml
```

**Comprobar que no hay cambios locales en BMad:**

```bash
git status -- .agents .claude _bmad skills-lock.json
```

Debe salir limpio.

**Si hay que actualizar BMad antes del evento** (decisión del equipo; lo hace P5):

1. En el chat de Claude Code: `/bmad update`.
2. Volver a copiar `.agents/skills/` dentro de `.claude/skills/`.
3. Comprobar la versión.
4. Commit y push.
5. Avisar a todos para que hagan `git pull` y repitan la sección 3.

---

## 6. Qué se comparte por Git y qué no

| Ruta | ¿Se comparte? | Motivo |
|---|---|---|
| `.agents/skills/**` | Sí | Skills para Codex y OpenCode |
| `.claude/skills/**` | Sí | Copias de las skills para Claude Code |
| `skills-lock.json` | Sí | Registro del origen y los hashes de las skills |
| `_bmad/config.toml`, `_bmad/scripts/**`, `_bmad/<módulo>/scripts/**` | Sí | Configuración y scripts del equipo |
| `_bmad/custom/.gitignore` | Sí | Protege las respuestas personales |
| `_bmad-output/**` | Sí | Spec, tickets, planes y demás artefactos del evento |
| `AGENTS.md`, `CLAUDE.md` (se crean en el evento) | Sí | Reglas comunes para los agentes |
| `_bmad/custom/*.user.toml` | **No** | Personal: iniciativa activa [Verificado] |
| `.env`, `.env.*`, claves | **No** | Secretos |
| `.claude/settings.local.json`, `CLAUDE.local.md` | **No** | Configuración personal de Claude Code |
| `node_modules/`, `.venv/`, `__pycache__/` | **No** | Dependencias y cachés locales |

Todo esto ya está cubierto en el `.gitignore` de la raíz.

---

## 7. Resolución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| La herramienta no muestra ninguna skill `bmad` | Se inició fuera de la raíz del repositorio, o la herramienta no lee esa carpeta | Abrir la herramienta en la raíz. Comprobar que existe `.claude/skills/bmad/SKILL.md` (Claude Code) o `.agents/skills/bmad/SKILL.md` (Codex y OpenCode). Si existe y no aparece, avisar a P5 |
| `.claude/skills/bmad` es un archivo pequeño con una ruta dentro | Se clonó una versión antigua con enlaces simbólicos | `git pull`. La versión actual usa copias |
| "BMad is not set up here" o no se encuentra `resolve_config.py` | El clon no tiene `_bmad/` | `git pull`. Si sigue faltando, avisar a P5. **No ejecutar `bmad setup` por cuenta propia** |
| `uv: command not found` o error de versión de Python | `uv` no instalado o no está en el PATH; Python < 3.11 | Instalar `uv` (sección 2.1), abrir una terminal nueva y ejecutar `uv python install 3.12` |
| El estado muestra `newer-available` | Hay una versión más nueva publicada | Ignorarlo. No se actualiza durante el evento |
| El estado avisa de copias duplicadas | Hay BMad instalado también de forma global | Avisar a P5 (sección 2.3). No aceptar "remove copies" sin revisarlo |
| Una skill aparece dos veces en OpenCode | Lee a la vez `.agents/skills` y `.claude/skills` **[No verificado]** | Avisar a P5 en el ensayo para decidir la solución antes del evento |
| `bmad-build` se detiene antes de empezar | Hay cambios sin commitear o la rama no encaja con la tarea [Verificado en `bmad-build/step-01-clarify-and-route.md:70`] | Crear la rama del ticket y dejar el árbol limpio antes de invocarlo |
| No aparecen los artefactos de un compañero | Iniciativas distintas, o falta `git pull` | `git pull` y activar la misma iniciativa (sección 4.3) |
| `git status` muestra `_bmad/custom/config.user.toml` | Algo anuló el `.gitignore` | No commitearlo. Comprobar que `_bmad/custom/.gitignore` contiene `*.user.toml` |

---

## 8. Pendiente de verificar en el ensayo

| # | Qué | Quién |
|---|---|---|
| 1 | Que Codex lee `.agents/skills/` y cómo se invoca una skill (en lenguaje natural o con `$nombre`) | Quien use Codex |
| 2 | Que OpenCode lee las skills y no las duplica | Quien use OpenCode |
| 3 | Los comandos de instalación de las herramientas de IA (sección 2.2) | Cada persona |
| 4 | Un flujo corto de práctica (spec → ticket → build → PR) en un **repositorio aparte**, sin traer nada a este | Todo el equipo, con P2 coordinando |
