# Hackathon-LagTeam
# Hackathon-LagTeam

Plataforma de eventos culturales de Piura (Reto 18). Monorepo pnpm:

| Carpeta | Qué es |
|---|---|
| `apps/web` | Next.js (App Router). Se despliega en Vercel |
| `apps/api` | NestJS 12, rutas bajo `/api/v1`. Se despliega en Railway |
| `packages/shared` | `@reto18/shared`: esquemas zod compartidos por la API y la web |
| `supabase/migrations` | SQL de la base de datos, una migración por historia |

## Arranque local

Requisitos: Node 22 (`.nvmrc`) y pnpm 9 a través de corepack.

```bash
corepack enable          # una vez por máquina; activa la versión de pnpm de package.json
pnpm install
cp .env.example .env     # y rellena SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
pnpm build               # compila packages/shared (la API y la web lo necesitan compilado)
pnpm dev:api             # API en http://localhost:3001
pnpm dev:web             # web en http://localhost:3000 (en otra terminal)
```

La web debe mostrar **"API ok · BD ok"** con la hora de Postgres. Comprobación directa de la API:

```bash
curl localhost:3001/api/v1/salud
# 200 {"api":"ok","bd":"ok","hora_bd":"…"}; si la BD falla: 503 {"api":"ok","bd":"error","error":{…}}
```

Antes de abrir un PR, lo mismo que corre la CI (`.github/workflows/ci.yml`):

```bash
pnpm build && pnpm lint && pnpm test
```

## Despliegue (pasos de Jean Pierre)

Las variables están explicadas en `.env.example`. Las claves reales nunca se suben al repo.

### 1. Supabase

1. Crear el proyecto (plan gratuito).
2. Aplicar la migración `supabase/migrations/20261010000000_salud.sql`: pegarla en **SQL Editor** y ejecutarla, o con la CLI `supabase link` + `supabase db push`.
3. Copiar de **Project Settings > API** la *Project URL* (`SUPABASE_URL`) y la clave *service_role* (`SUPABASE_SERVICE_ROLE_KEY`). La clave *service_role* va solo a Railway, nunca a Vercel (AD-1).

### 2. Railway (API)

1. Nuevo servicio desde el repo de GitHub. **Root directory:** la raíz del repo (no `apps/api`), para que la imagen incluya `packages/shared`.
2. **Settings > Config-as-code:** ruta `apps/api/railway.json` (construye con `apps/api/Dockerfile`).
3. Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `WEB_URL` (la URL de Vercel; se puede rellenar después del paso 3). `PORT` lo pone Railway.
4. **Networking > Generate domain** y comprobar `https://<dominio-railway>/api/v1/salud`.

### 3. Vercel (web)

1. Nuevo proyecto desde el repo. **Root directory:** `apps/web` (Vercel detecta Next.js y pnpm; `apps/web/vercel.json` compila antes `packages/shared`).
2. Variable `API_URL` = URL de Railway, sin `/api/v1` y sin barra final.
3. Desplegar y abrir la URL en el móvil: debe verse "API ok · BD ok".
4. Volver a Railway y poner `WEB_URL` con la URL de Vercel.
