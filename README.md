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

### Identidad y roles

- `POST /api/v1/identidad/registro` (público): crea la cuenta de Supabase Auth ya confirmada y su perfil. Cuerpo: `correo`, `contrasena` (≥ 8), `rol` (`organizador` o `publico`), `whatsapp` (`987 654 321` se guarda como `+51987654321`), `ciudad` opcional y `acepta_avisos`. El admin no se registra por API: lo crea `sembrar:admin`.
- La web inicia sesión directamente con Supabase (`signInWithPassword`) y envía el JWT como `Authorization: Bearer <token>`.
- `GET /api/v1/identidad/perfil`: perfil de quien llama (id, correo, rol, WhatsApp, ciudad, consentimiento).
- Para proteger un endpoint: `@Roles("admin")` (o varios roles) y `@UsuarioActual()` para leer la cuenta. El rol siempre sale de `identidad_perfiles`. Sin `@Roles()` la ruta es pública. Errores: 401 `NO_AUTENTICADO`, 403 `SIN_PERMISO` / `SIN_PERFIL`, 503 `AUTH_NO_DISPONIBLE`.

```bash
curl -X POST localhost:3001/api/v1/identidad/registro -H 'content-type: application/json'   -d '{"correo":"ana@ejemplo.pe","contrasena":"una-clave-8","rol":"organizador","whatsapp":"987 654 321","acepta_avisos":true}'
curl localhost:3001/api/v1/identidad/perfil -H "Authorization: Bearer $TOKEN"
```

Antes de abrir un PR, lo mismo que corre la CI (`.github/workflows/ci.yml`):

```bash
pnpm build && pnpm lint && pnpm test
pnpm test:int            # con la BD de prueba levantada (ver abajo)
```

## Pruebas de integración

`pnpm test:int` levanta la app NestJS real (la misma configuración que `main.ts`) contra una
**BD de prueba local**: Supabase en Docker con la CLI (devDependency de la raíz). Nunca usa la BD
de desarrollo del `.env`: lee la URL y las claves de `supabase status` y se niega a ejecutar si la
URL no es `localhost`/`127.0.0.1`. `pnpm test` (unitarias) sigue sin necesitar ninguna BD.

```bash
# Requisito: Docker Desktop en marcha
pnpm db:start            # la primera vez descarga las imágenes (varios minutos); aplica supabase/migrations
pnpm test:int            # pruebas de integración (en serie)
pnpm db:stop             # apaga la BD de prueba cuando acabes
```

Si la BD no está levantada, `pnpm test:int` falla al inicio, sin ejecutar ninguna prueba, y dice
que ejecutes `pnpm db:start`. Tras añadir una migración nueva, aplícala con `pnpm exec supabase db reset`.

### Escribir una prueba de integración

Crea `apps/api/test/integracion/<algo>.int.spec.ts` y usa las ayudas de `test/integracion/ayudas/`:

| Ayuda | Qué hace |
|---|---|
| `crearAppDePrueba()` | La app real en memoria, conectada a la BD de prueba. Ciérrala con `app.close()` |
| `tokenPorRol(rol)` | Crea un usuario de Supabase Auth con `app_metadata.rol` (`admin`, `organizador` o `publico`) y devuelve `{ id, token }`. Los usuarios se borran solos al terminar cada archivo |
| `api(app, token?)` | `get`, `post`, `put`, `patch`, `delete` con `supertest` y `Authorization: Bearer <token>` |

```ts
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, expect, it } from "vitest";
import { crearAppDePrueba } from "./ayudas/app.js";
import { api } from "./ayudas/http.js";
import { tokenPorRol } from "./ayudas/tokens.js";

let app: INestApplication;
beforeAll(async () => {
  app = await crearAppDePrueba();
});
afterAll(async () => {
  await app.close();
});

it("un organizador puede consultar la salud", async () => {
  const { token } = await tokenPorRol("organizador");
  const respuesta = await api(app, token).get("/api/v1/salud");
  expect(respuesta.status).toBe(200);
});
```

La CI ejecuta también `pnpm db:start` y `pnpm test:int` en cada PR.

## Despliegue (pasos de Jean Pierre)

Las variables están explicadas en `.env.example`. Las claves reales nunca se suben al repo.

### 1. Supabase

1. Crear el proyecto (plan gratuito).
2. Aplicar las migraciones de `supabase/migrations`, en orden (`20261010000000_salud.sql`, `20261010010000_identidad.sql`): pegarlas en **SQL Editor** y ejecutarlas, o con la CLI `supabase link` + `supabase db push`.
3. Copiar de **Project Settings > API** la *Project URL* (`SUPABASE_URL`) y la clave *service_role* (`SUPABASE_SERVICE_ROLE_KEY`). La clave *service_role* va solo a Railway, nunca a Vercel (AD-1).
4. Crear el administrador: rellenar `ADMIN_CORREO`, `ADMIN_CONTRASENA` y `ADMIN_WHATSAPP` en el `.env` local y ejecutar `pnpm --filter @reto18/api sembrar:admin`. Se puede repetir: actualiza la contraseña sin duplicar la cuenta. No hace falta tocar la confirmación por correo de Supabase: la API crea las cuentas ya confirmadas.

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
