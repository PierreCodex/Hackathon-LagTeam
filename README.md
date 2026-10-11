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

- `POST /api/v1/identidad/registro` (público): crea la cuenta de Supabase Auth ya confirmada y su perfil. Cuerpo: `correo`, `contrasena` (8 caracteres a 72 bytes), `rol` (`organizador` o `publico`), `whatsapp` (`987 654 321`, `51987654321` o `0051…` se guardan como `+51987654321`), `ciudad` opcional (`""` o `null` = sin ciudad) y `acepta_avisos`. El admin no se registra por API: lo crea `sembrar:admin`.
- Si un registro falla a medias y deja una cuenta sin perfil, el siguiente registro con ese correo la borra y vuelve a crearla. Si hay que arreglarla a mano: borrar la cuenta en Supabase (**Authentication > Users**) y registrarse de nuevo.
- La web inicia sesión directamente con Supabase (`signInWithPassword`) y envía el JWT como `Authorization: Bearer <token>`.
- `GET /api/v1/identidad/perfil`: perfil de quien llama (id, correo, rol, WhatsApp, ciudad, consentimiento).
- Para proteger un endpoint: `@Roles("admin")` (o varios roles) y `@UsuarioActual()` para leer la cuenta. `@Roles()` sin argumentos admite cualquier cuenta con perfil. El rol siempre sale de `identidad_perfiles`. Sin `@Roles()` la ruta es pública, y usar ahí `@UsuarioActual()` da un error 500 explícito. Errores: 401 `NO_AUTENTICADO`, 403 `SIN_PERMISO` / `SIN_PERFIL`, 503 `AUTH_NO_DISPONIBLE`.

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

### Datos de demo de eventos

`supabase/seed.sql` se carga automáticamente al iniciar una BD nueva o ejecutar `pnpm exec supabase db reset`
(este último borra los datos locales). Incluye una sede ficticia de 643 butacas: Platea baja (190),
Platea media (204) y Mezanine (249), otra sede en Castilla con zona general de 120 personas, y ocho
eventos de octubre–noviembre de 2026. El 16, 17 y 18 de octubre tienen eventos aprobados para probar
Weekend. Hay precios en céntimos de PEN con IGV, una muestra de arte gratuita y eventos pendiente y rechazado.

En la nube, aplica primero todas las migraciones de `supabase/migrations` en orden, incluida
`20261010020000_eventos.sql`. Después abre **Supabase > SQL Editor**, pega el contenido completo de
`supabase/seed.sql` y ejecútalo. Puedes ejecutarlo otra vez: conserva los identificadores de la demo
y no duplica filas. No requiere variables ni herramientas de la CLI dentro del SQL Editor.

La semilla crea únicamente una cuenta de referencia en `auth.users`, con UUID fijo y correo
`organizador.eventos@example.invalid`, sin contraseña utilizable ni perfil de identidad.
Sirve como propietario de los eventos de muestra; no es una cuenta para iniciar sesión.
Las categorías de las zonas numeradas llevan el nombre de su sección, pero la asignación de precios
a rangos de butacas corresponde a la historia 2.4. No se siembran inventario ni ventas.

Cada categoría de precio incluye el `sede_id` de su evento. Si tiene `seccion_id`, esa sección
debe ser general y pertenecer a la misma sede; las categorías numeradas usan `seccion_id = null`.
Las claves foráneas compuestas también rechazan cambiar la sede del evento o de una sección
mientras ese cambio deje categorías con referencias incompatibles.

### Escribir una prueba de integración

Crea `apps/api/test/integracion/<algo>.int.spec.ts` y usa las ayudas de `test/integracion/ayudas/`:

| Ayuda | Qué hace |
|---|---|
| `crearAppDePrueba(controladores?)` | La app real en memoria, conectada a la BD de prueba. `controladores` añade controladores solo de prueba, protegidos por el guard real. Ciérrala con `app.close()` |
| `tokenPorRol(rol)` | Crea un usuario de Supabase Auth con `app_metadata.rol` (`admin`, `organizador` o `publico`) y su perfil en `identidad_perfiles` (de ahí saca el rol el guard), y devuelve `{ id, token }`. Los usuarios se borran solos al terminar cada archivo |
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
2. Aplicar las migraciones de `supabase/migrations`, en orden (`20261010000000_salud.sql`, `20261010010000_identidad.sql`, `20261010020000_eventos.sql`): pegarlas en **SQL Editor** y ejecutarlas, o con la CLI `supabase link` + `supabase db push`. Para la demo, ejecutar después `supabase/seed.sql` en el SQL Editor (ver Datos de demo de eventos).
3. Copiar de **Project Settings > API** la *Project URL* (`SUPABASE_URL`) y la clave *service_role* (`SUPABASE_SERVICE_ROLE_KEY`). La clave *service_role* va solo a Railway, nunca a Vercel (AD-1).
4. Crear el administrador: rellenar `ADMIN_CORREO`, `ADMIN_CONTRASENA` y `ADMIN_WHATSAPP` en el `.env` local y ejecutar `pnpm --filter @reto18/api sembrar:admin`. Se puede repetir: actualiza la contraseña sin duplicar la cuenta. Si `ADMIN_CORREO` ya es de una cuenta con otro rol, se niega; para ascenderla igualmente: `pnpm --filter @reto18/api sembrar:admin -- --forzar`. No hace falta tocar la confirmación por correo de Supabase: la API crea las cuentas ya confirmadas.

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
