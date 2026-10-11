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

### Alta de eventos (organizador)

- `POST /api/v1/eventos` (rol `organizador`), `multipart/form-data`: campo `datos` con el JSON de `AltaEventoSchema` (`packages/shared`), archivo `foto` (JPG, PNG o WebP) y, si `hay_musica` es `true`, archivo `constancia` de APDAYC (PDF o imagen). Máximo 5 MB por archivo; el tipo se comprueba por el contenido, no por la extensión. `sede` es `{ "tipo": "existente", "sede_id" }` o `{ "tipo": "nueva", "nombre", "direccion", "distrito", "capacidad" }` (una sede nueva es de zona general, queda a nombre del organizador y disponible para todos). Una sede existente solo se puede usar si es propia o si su mapa está cerrado (publicada o sembrada); una sede abierta de otro organizador da 403 `SEDE_AJENA` (crea tu propio local o duplícalo). El `aforo` no puede superar la capacidad de la sede. Precios en céntimos con IGV; `color` de cada categoría es opcional. Responde 201 con `{ evento, categorias }` y el evento en `pendiente`.
- `GET /api/v1/eventos/sedes` (rol `organizador`): sedes con su distrito, su `capacidad` (asientos numerados más zonas generales), para elegir la sede y mostrar el aforo máximo, y `propia` ("la puedes editar": `true` si la creó quien llama y su mapa sigue abierto).
- Errores: 400 `DATOS_INVALIDOS` (el mensaje nombra el campo), `ARCHIVO_NO_VALIDO`, `MUSICA_SIN_CONSTANCIA`, `AFORO_SUPERA_SEDE`; 403 `SEDE_AJENA`; 404 `SEDE_NO_EXISTE`; 503 `STORAGE_NO_DISPONIBLE` o `BD_NO_DISPONIBLE`. Si el alta falla después de subir los archivos, se borran. Excepción: si se pierde la conexión con la base de datos a mitad del alta (503 `BD_NO_DISPONIBLE`), los archivos se conservan y sus rutas quedan en el log, porque el evento puede haberse creado.
- Los archivos van a los buckets `eventos-fotos` (público) y `eventos-constancias` (privado: se guarda la URL del objeto, que no se abre sin firma). Los crea la migración `20261011000000_eventos_alta.sql`; no hace falta crearlos a mano.

```bash
curl -X POST localhost:3001/api/v1/eventos -H "Authorization: Bearer $TOKEN"   -F 'datos={"titulo":"Noche de marinera","categoria":"danza","descripcion":"Marinera norteña con parejas de Piura.","inicio":"2026-12-05T20:00:00-05:00","aforo":100,"hay_musica":false,"sede":{"tipo":"existente","sede_id":"13100000-0000-4000-8000-000000000001"},"categorias":[{"nombre":"General","precio_centimos":2000}]}'   -F foto=@foto.jpg
```

### Revisión de eventos (historia 1.5; contratos para la UI 1.10)

Todas las rutas llevan el prefijo `/api/v1` y requieren `Authorization: Bearer <token>`.

| Ruta | Rol | Entrada y respuesta 200 |
|---|---|---|
| `GET /eventos/pendientes` | admin | Array de `EventoRevisionSchema`, solo pendientes |
| `GET /eventos/mis-eventos` | organizador | Array del mismo contrato, solo del usuario del token |
| `GET /eventos/:id/constancia` | admin | `{ "url": "…" }` con firma de 300 segundos, o `{ "url": null }` si no tiene archivo |
| `PATCH /eventos/:id/aprobar` | admin | Sin cuerpo; devuelve evento aprobado, con `motivo_rechazo: null` |
| `PATCH /eventos/:id/rechazar` | admin | `{ "motivo_rechazo": "Completar el programa" }`; devuelve evento rechazado y `destacado: false` |
| `PATCH /eventos/:id/destacado` | admin | `{ "destacado": true }` o `false`; devuelve el evento actualizado |

Las listas se ordenan por `inicio` y luego `id` ascendente. Incluyen los datos del evento,
`motivo_rechazo`, la URL privada almacenada y `alerta_apdayc` (texto o `null`). El motivo del
rechazo se recorta y debe tener entre 1 y 600 caracteres. Aprobar/rechazar solo admite
`pendiente`; destacar/quitar destacado solo admite `aprobado`. Las decisiones anteriores no
se cambian y dos decisiones concurrentes no pueden sobrescribirse.

Errores con formato `{ "error": { "codigo", "mensaje" } }`: 400 `PETICION_INVALIDA` para UUID
o cuerpo inválido; 400 `ARCHIVO_NO_VALIDO` si la ruta almacenada de la constancia es ajena o
inválida; 401 `NO_AUTENTICADO`; 403 `SIN_PERMISO`; 404 `EVENTO_NO_EXISTE`; 409
`ESTADO_EVENTO_INCOMPATIBLE`; 503 `BD_NO_DISPONIBLE` o `STORAGE_NO_DISPONIBLE` (límite de
10 segundos por llamada). Tras 409 o un fallo de conexión, recargar el evento antes de repetir.

La constancia permanece privada. La firma se solicita solo al abrirla, no se guarda en la BD,
y únicamente permite objetos del bucket `eventos-constancias` bajo el propietario del evento.
Aplicar `20261012000000_eventos_aprobacion.sql` antes de desplegar esta API: añade
`alerta_apdayc` nullable y conserva los permisos. La semilla incluye una alerta de DJ en el
pendiente `13600000-0000-4000-8000-000000000007`; no se ejecuta IA.

### Mapa de la sede y publicación (organizador)

Flujo: alta (`pendiente`) → aprobación (1.5) → mapa del local → **publicar** → ventas. Solo los eventos aprobados **y** publicados salen al público.

- `POST /api/v1/eventos/sedes` (rol `organizador`), JSON de `MapaSedeEntradaSchema`: `nombre`, `direccion`, `distrito` y `secciones`. Una sección `numerada` lleva `filas` → `bloques` (`orden`, `desplazamiento`) → `asientos` (`numero`, único en la fila; puede haber huecos). Una `general` lleva `capacidad` y no tiene filas. Sin ids. Límites (`LIMITES_MAPA`): 20 secciones, 100 filas por sección, 200 asientos por fila y 5000 asientos por mapa. Responde 201 con el `MapaSede` (con ids). La sede queda a nombre del organizador.
- `GET /api/v1/eventos/sedes/:id/mapa` (roles `organizador` y `admin`): el `MapaSede`, ordenado por sección, fila, bloque y número.
- `PUT /api/v1/eventos/sedes/:id/mapa` (rol `organizador`, solo el dueño de la sede): reemplaza el mapa entero en una transacción; responde 200 con el mapa nuevo. Los ids de filas, bloques y asientos cambian. Una zona general se conserva (con sus categorías de precio) si se envía con su `id`. Si cambia el `distrito`, cambia también el de los eventos de la sede.
- `POST /api/v1/eventos/sedes/:id/duplicar` (rol `organizador`), `{ "nombre" }`: copia cualquier sede (propia, de otro organizador o sembrada) con ids nuevos, a nombre de quien la duplica y con el mapa abierto. Responde 201 con el `MapaSede` de la copia.
- `POST /api/v1/eventos/:id/publicar` (rol `organizador`, solo el del evento): exige el evento `aprobado` y que la capacidad de la sede alcance el `aforo`. Marca `publicado` y **cierra el mapa** de la sede: desde entonces nadie lo reemplaza; quien necesite otro mapa duplica la sede. Responde 200 con el evento; repetirlo no cambia nada.
- Errores: 400 `DATOS_INVALIDOS` (el mensaje nombra la ruta del campo, p. ej. `secciones.0.filas.2.bloques.0.asientos.3.numero`); 403 `SEDE_AJENA` (la sede es de otro organizador o de la semilla), `EVENTO_AJENO`; 404 `SEDE_NO_EXISTE`, `EVENTO_NO_EXISTE`; 409 `MAPA_CERRADO`, `SECCION_EN_USO` (el reemplazo quita una zona general con categorías de precio), `EVENTO_NO_APROBADO`, `AFORO_SUPERA_SEDE`, `ASIENTOS_SIN_PRECIO` (al publicar en una sede numerada, algún asiento no tiene categoría); 503 `BD_NO_DISPONIBLE`.
- `GET /api/v1/eventos` (público, sin sesión): catálogo de eventos `aprobado` y `publicado`. Acepta `q`, `desde`/`hasta` (`AAAA-MM-DD`), `categoria`, `distrito`, `precio_minimo_centimos` y `precio_maximo_centimos`; los filtros se combinan y los destacados aparecen primero.
- `GET /api/v1/eventos/calendario?mes=AAAA-MM` (público): devuelve los eventos publicados del mes calendario en Lima. `GET /api/v1/eventos/:id` devuelve la ficha pública y oculta eventos pendientes, rechazados o aprobados aún sin publicar.
- Las sedes sembradas no tienen dueño y tienen el mapa cerrado (sus eventos aprobados están publicados).

### Precios por rango de asientos (organizador)

En una sede numerada, cada asiento recibe su categoría de precio (de las del alta) por rangos: "sección, fila, desde–hasta → categoría". Los rangos se guardan por **nombre** de sección y fila y por número de asiento, así que sobreviven a un reemplazo del mapa antes de publicar; un asiento fuera de todo rango queda sin categoría. Migración `20261015000000_eventos_precios.sql`.

- `PUT /api/v1/eventos/:id/precios` (rol `organizador`, solo el del evento), JSON de `PreciosEntradaSchema`: `{ "rangos": [{ "categoria_id", "seccion", "fila", "desde", "hasta" }] }` (máx. 2000; `desde ≤ hasta`; sin solapes dentro de una fila; puede haber huecos de numeración). Reemplaza todos los rangos del evento en una transacción (`[]` los borra) y responde 200 con `PreciosEventoSchema`. Solo mientras el evento **no está publicado**.
- `GET /api/v1/eventos/:id/precios` (roles `organizador`, solo el del evento, y `admin`): `{ rangos, asientos, categorias }`; `rangos` en el orden del mapa, `asientos` con cada asiento numerado del mapa vigente (`asiento_id`, `seccion`, `fila`, `numero`, `categoria_id` o `null`), en el orden del mapa (sección y fila según su `orden`) y, dentro de la fila, por número, y `categorias` con las categorías de precio del evento (nombre, color y precio), para elegir y pintar en la pizarra de precios.
- Publicar exige que todos los asientos numerados de la sede tengan categoría (409 `ASIENTOS_SIN_PRECIO`); las sedes solo de zona general no cambian.
- Errores: 400 `DATOS_INVALIDOS` (con la ruta, p. ej. `rangos.1`), `RANGO_FUERA_DEL_MAPA` (sección numerada o fila que no está en el mapa, o una zona general), `CATEGORIA_NO_VALIDA` (de otro evento, inexistente o de zona general); 403 `EVENTO_AJENO`; 404 `EVENTO_NO_EXISTE`; 409 `EVENTO_PUBLICADO`; 503 `BD_NO_DISPONIBLE`.
- La semilla asigna a los eventos 1, 2, 5 y 7 del teatro cada sección entera con su categoría homónima: sus 643 asientos tienen precio.
- Pantalla del organizador `/organizador/eventos/:id/precios` (historia 2.10): reutiliza la estructura de la pizarra del mapa (secciones → filas → bloques → asientos) en modo solo lectura y deja seleccionar un rango dentro de una fila con dos clics (primero y último asiento) para asignarle una categoría del panel lateral, pintada con su color real. Un evento publicado abre la pantalla en solo lectura, sin controles ni "Guardar".

Antes de abrir un PR, lo mismo que corre la CI (`.github/workflows/ci.yml`):

```bash
pnpm build && pnpm lint && pnpm test
pnpm test:int            # con la BD de prueba levantada (ver abajo)
```

## Marketing: Ollama, flyer y publicación en redes

El organizador genera una pieza desde **Marketing** para un evento aprobado y futuro.
Ollama propone textos, colores y campaña; la web construye el PNG 4:5 con la foto y los
datos reales del evento. Al pulsar **Publicar ahora**, la API descarga ese mismo PNG y
envía el archivo, el texto revisado y el enlace rastreable a Upload-Post.

Configura en el `.env` privado de la raíz (nunca en `.env.example`):

```dotenv
OLLAMA_URL=http://localhost:11434
OLLAMA_MODELO=qwen2.5:latest
UPLOADPOST_API_KEY=tu-clave-privada
WEB_URL=http://localhost:3000
```

El nombre del modelo debe coincidir con uno instalado en `ollama list`.
Reinicia la API después de cambiar el entorno. Sin Ollama o si su respuesta no cumple el
contrato, se conserva la generación mediante respaldo y se indica en Marketing.
`UPLOADPOST_USER` y `UPLOADPOST_FACEBOOK_PAGE_ID` permiten fijar el perfil y la página;
si se omiten, se consultan los primeros disponibles en la cuenta.

Upload-Post puede procesar el envío en segundo plano. La API consulta su estado durante
un máximo total de dos minutos, sin repetir la subida. Solo anuncia éxito cuando recibe
confirmación por red; programar requiere confirmación con `job_id`. Si no puede confirmar,
la web pide revisar Upload-Post y las redes antes de repetir, para evitar duplicados, y
ofrece descargar el flyer y copiar el texto. Véanse las respuestas oficiales de
[fotos](https://docs.upload-post.com/api/upload-photo/) y
[estado del envío](https://docs.upload-post.com/api/upload-status/).

Para la prueba personal, crea y aprueba un evento, genera el flyer, revisa el texto y pulsa
**Publicar ahora** una vez. Comprueba directamente Facebook/Instagram. La campaña es una
propuesta: este botón publica contenido, no contrata anuncios. La primera URL de `WEB_URL`
debe apuntar a la web que sirve el PNG; para que otras personas abran el enlace de compra,
usa su URL pública. En Railway, Ollama debe ser accesible desde allí mediante la URL del túnel.

`marketing-publicaciones.int.spec.ts` verifica generación, bytes del PNG enviado, enlace,
permisos y falta de confirmación con Supabase local y proveedores simulados; no publica
en las cuentas reales. Las pruebas de la plantilla web verifican el PNG 1080 × 1350.

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
que ejecutes `pnpm db:start`. Tras añadir una migración nueva, aplícala con
`pnpm exec supabase migration up --local`. `supabase db reset` borra los datos locales:
úsalo únicamente si el equipo autoriza reiniciar esa BD.

### Datos de demo de eventos

`supabase/seed.sql` se carga automáticamente al iniciar una BD nueva o ejecutar `pnpm exec supabase db reset`
(este último borra los datos locales). Incluye una sede ficticia de 643 butacas: Platea baja (190),
Platea media (204) y Mezanine (249), otra sede en Castilla con zona general de 120 personas, y ocho
eventos de octubre–noviembre de 2026. El 16, 17 y 18 de octubre tienen eventos aprobados para probar
Weekend. Hay precios en céntimos de PEN con IGV, una muestra de arte gratuita y eventos pendiente y rechazado.

En la nube, aplica primero todas las migraciones de `supabase/migrations` en orden, incluidas
`20261010020000_eventos.sql`, `20261011000000_eventos_alta.sql`, `20261011010000_marketing.sql`, `20261011020000_eventos_mapa.sql`, `20261012000000_eventos_aprobacion.sql`, `20261013000000_ventas.sql`, `20261014000000_marketing_enlaces.sql` y `20261015000000_eventos_precios.sql`. Después abre **Supabase > SQL Editor**, pega el contenido completo de
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
2. Aplicar las migraciones de `supabase/migrations`, en orden (`20261010000000_salud.sql`, `20261010010000_identidad.sql`, `20261010020000_eventos.sql`, `20261011000000_eventos_alta.sql`, `20261011010000_marketing.sql`, `20261011020000_eventos_mapa.sql`, `20261012000000_eventos_aprobacion.sql`, `20261013000000_ventas.sql`, `20261014000000_marketing_enlaces.sql` y `20261015000000_eventos_precios.sql`; la de alta crea los buckets de Storage `eventos-fotos` y `eventos-constancias`): pegarlas en **SQL Editor** y ejecutarlas, o con la CLI `supabase link` + `supabase db push`. Para la demo, ejecutar después `supabase/seed.sql` en el SQL Editor (ver Datos de demo de eventos).
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
