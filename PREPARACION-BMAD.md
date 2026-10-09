# Preparación de BMad: qué hacer con el repo

BMad ya está instalado en el repositorio. **No tienes que instalar BMad ni configurar nada**: solo preparar tu máquina, clonar y comprobar.

Si te atascas en algún paso, escribe a **Jean Pierre** (responsable de BMad).

> **Terminal** = PowerShell, CMD, Git Bash o la terminal de macOS/Linux.
> **Chat** = lo que escribes dentro de tu herramienta de IA (Claude Code, Codex u OpenCode).

---

## Antes del evento (hazlo esta semana)

### Paso 1. Instala lo necesario

Necesitas cuatro cosas: **Git**, **uv**, **Python 3.11 o superior** (lo instala uv) y **tu herramienta de IA**.

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**macOS / Linux:**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Después **cierra y abre la terminal**, y ejecuta:

```bash
uv python install 3.12
```

**Tu herramienta de IA:** si ya la tienes, no instales nada. Compruébalo escribiendo en la terminal el comando de la tuya:

```bash
claude --version     # Claude Code
codex --version      # Codex
opencode --version   # OpenCode
```

- **Responde con un número de versión** → ya la tienes. Sigue.
- **Da error** → instálala desde su web oficial y vuelve a probar.

> Tener **Claude Pro** o **ChatGPT Plus** no significa tener la herramienta: eso es la cuenta. La **web o la app de chat** (claude.ai, ChatGPT) no sirven, porque no leen el repo. Necesitas Claude Code, Codex u OpenCode. Si los usas como extensión de VS Code, abre allí la carpeta del repo y compruébalo en el Paso 4.

Comprueba también el resto:

```bash
git --version
uv --version
uv python find
```

### Paso 2. Clona el repositorio

```bash
git clone https://github.com/PierreCodex/Hackathon-LagTeam.git
cd Hackathon-LagTeam
```

### Paso 3. Comprueba la instalación desde la terminal

Dentro de la carpeta `Hackathon-LagTeam`:

```bash
uv run --no-cache .agents/skills/bmad/scripts/setup.py --project-root . --skill .agents/skills/bmad --root .agents/skills --status
```

Este comando **no cambia nada**. Busca en la respuesta:

- `"current": true` → ✅ todo bien
- `"problems": []` → ✅ sin problemas

### Paso 4. Comprueba que tu herramienta ve las skills

Abre tu herramienta **desde la carpeta `Hackathon-LagTeam`** (no desde otra carpeta) y escribe en el chat:

| Tu herramienta | Cómo abrirla (terminal) | Qué escribir en el chat |
|---|---|---|
| **Claude Code** | `claude` | `/bmad status` |
| **Codex** | `codex` | `Usa la skill bmad y muéstrame el estado de la instalación. No cambies nada.` |
| **OpenCode** | `opencode` | `Usa la skill bmad y muéstrame el estado de la instalación. No cambies nada.` |

✅ **Correcto:** muestra los módulos `core-tools`, `method` y `toolsmith` en la versión `6.13.0-next`.

⚠️ **Si te ofrece actualizar o hacer setup: responde que NO.**

**Claude Code y Codex ya están comprobados** con este repo: ven las skills y ejecutan `bmad` sin instalar nada más.

**Si usas OpenCode:** fíjate además en que las skills `bmad-...` aparezcan **una sola vez** (no duplicadas). Es lo único que no hemos podido comprobar todavía.

### Paso 5. Avisa a Jean Pierre

Mándale un mensaje con:

1. Qué herramienta usarás (Claude Code, Codex u OpenCode).
2. Si el Paso 3 dio `"current": true`.
3. Si en el Paso 4 tu herramienta mostró las skills (y, con OpenCode, si salen duplicadas).

**Listo. No hagas nada más con el repo hasta el evento.**

---

## El día del evento

| Hora | Quién | Qué hace |
|---|---|---|
| 09:30 | Todos | En la terminal, dentro del repo: `git pull` |
| 09:30–10:00 | P1 | En el chat: `bmad: crea una iniciativa nueva llamada <nombre-del-reto> y actívala`. Luego hace commit y push |
| Después | Los demás | `git pull` y en el chat: `bmad: activa la iniciativa initiative-<nombre-que-diga-P1>` |

Los cinco deben tener **la misma iniciativa** activa. A partir de ahí se sigue el plan del evento.

---

## Reglas: lo que NO debes hacer

- ❌ No ejecutes `npx skills add` ni `npx skills update`.
- ❌ No pidas `bmad setup` ni aceptes "actualizar BMad".
- ❌ No edites nada dentro de `.agents/`, `.claude/skills/` ni `_bmad/`.
- ❌ No subas claves de API ni archivos `.env` al repositorio.

Solo Jean Pierre (o quien quede como su respaldo) toca la instalación de BMad.

---

## Si algo falla

| Problema | Solución |
|---|---|
| `uv: command not found` | Repite el Paso 1, **cierra y abre la terminal**, y prueba otra vez |
| Tu herramienta no muestra ninguna skill `bmad` | Ciérrala y ábrela **desde la carpeta `Hackathon-LagTeam`**. Si sigue sin verlas, avisa a Jean Pierre |
| "BMad is not set up here" | Haz `git pull`. Si sigue, avisa a Jean Pierre. **No ejecutes `bmad setup`** |
| La respuesta dice `newer-available` | Ignóralo. No se actualiza |
| Las skills salen duplicadas (OpenCode) | Avisa a Jean Pierre |
| Usas otra herramienta (Cursor, Windsurf…) | Avisa a Jean Pierre antes del evento |

---

## Para saber más (opcional)

- **Qué hay instalado:** BMad `6.13.0-next` (módulos `core-tools`, `method` y `toolsmith`), con 30 skills. Las skills están en `.agents/skills/` (para Codex y OpenCode) y en `.claude/skills/` (copia para Claude Code).
- **Qué modelo uses** (GPT, Claude u otro) no influye en que veas las skills; eso depende solo de la herramienta.
- **Tu configuración personal** (la iniciativa activa) se guarda en `_bmad/custom/config.user.toml`. Git la ignora: no se sube.
- **El plan completo del evento** está en `plan-hackathon-bmad-version-corregida.md`.
