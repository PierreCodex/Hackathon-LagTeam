# Verificación personal con Supabase remoto

Comprobado el 11/10/2026 contra `origin/main` en `b2209ee`. La prueba de Upload-Post se ejecutó en `feat/3-4-publicar-upload-post` (`324e29d`); no incluye el bloque C, que sí está en main. Tras la corrección del usuario, se ejecutó `git pull --ff-only origin main`: main ya estaba actualizado. El PR #42 está fusionado, pero en `feat/4-c-comision-tablero` (`968a0aa`), y sus cambios todavía no están en main.

## Situación comprobada

- La API ya configura un Supabase remoto. La web usa esa misma URL mediante el respaldo de `next.config.ts`, y su clave pública responde HTTP 200 contra ese proyecto.
- El esquema REST muestra salud e identidad. No muestra las tablas de eventos, marketing o ventas; las consultas de eventos y ventas responden `404 PGRST205`.
- No aparecen los buckets `eventos-fotos` y `eventos-constancias`.
- La clave de Upload-Post se trasladó de `.env.example` a `.env`, ignorado por Git. La comprobación posterior de perfiles devolvió HTTP 200 y un perfil; no se publicó contenido.
- La clave apareció en la salida de diagnóstico al leer la plantilla: revócala y reemplázala solo en `.env` antes de usarla de nuevo.
- `QR_SECRET` falta: no impide probar el flyer, pero bloquea cobros y validación de entradas.
- La compilación, lint, 630 pruebas unitarias y 174 de integración pasaron en la rama 3.4. Son pruebas locales; no certifican el despliegue remoto ni el bloque C.
- Verificación posterior de `feat/3-4-integracion-marketing`, basada en main e incluyendo el bloque C: compilación, lint, 666 pruebas unitarias y 182 de integración aprobadas. La base local se actualizó con la migración de comisión y la semilla del tablero pendientes, sin reset. La base remota no se modificó; `marketing_piezas` sigue devolviendo HTTP 404.

## Preparar las tablas

1. Abre **SQL Editor** en el proyecto de Supabase que corresponde a `SUPABASE_URL` de tu `.env`.
2. Revisa y ejecuta completo `01-migraciones-pendientes.sql`, en esta carpeta. Copia literalmente nueve migraciones de main, desde `20261010020000_eventos.sql` hasta `20261016000000_ventas_comision.sql`, dentro de una transacción. Crea 16 tablas, funciones, permisos y los dos buckets. Incluye la configuración inicial de comisión del proyecto.
3. El archivo comprueba que salud/identidad existen y que las tablas nuevas todavía no existen. Si falla una comprobación, detente y revisa el estado; no elimines tablas para forzar su ejecución.
4. No ejecutes `seed.sql` ni `seed-tablero.sql` si quieres comenzar con tus propios datos. Este paquete no copia registros ni archivos desde Docker.

El SQL todavía **no se ha ejecutado en la nube**. Está cotejado con los originales; no se comprobó el historial de migraciones remoto por conexión PostgreSQL. El paquete está destinado al SQL Editor y no registra el historial de la CLI. Si después se adopta `supabase db push`, habrá que conciliar ese historial con el esquema existente. La CLI permite revisar migraciones pendientes con `db push --dry-run`: https://supabase.com/docs/guides/deployment/database-migrations.

## Tu prueba del flyer

1. Se detectaron servidores web ya iniciados en 3000 y 3002, y la API en 3001 con salud `api=ok, bd=ok`. La configuración actual usa `http://localhost:3000`. Reinicia tus procesos de API/web después de modificar `.env` para asegurar que cargan la configuración nueva; los comandos son `pnpm dev:api` y `pnpm dev:web`, en terminales separadas. Evita iniciar otra copia mientras sus puertos siguen ocupados.
2. Usa una cuenta de organizador del Supabase remoto, o regístrala desde la web. Las cuentas creadas en Docker no pasan automáticamente a la nube.
3. Crea tu evento con fecha futura, foto y sede nueva de zona general. Si declara música, adjunta su constancia.
4. Apruébalo con el administrador. Si no existe una cuenta administradora, revisa tus variables `ADMIN_*` y ejecuta personalmente `pnpm --filter @reto18/api sembrar:admin`.
5. Vuelve como organizador, completa el mapa y publica el evento para que también funcione su enlace de compra.
6. Entra a **Marketing**, genera el flyer y revisa su imagen y texto. Ollama quedó configurado localmente con `qwen2.5:latest` y una generación real válida. Ollama propone textos, paleta y campaña; la plantilla web construye el PNG usando la foto del evento. Si el modelo falla se indican textos de respaldo.
7. Selecciona Instagram y Facebook, deja vacía la programación y pulsa **Publicar ahora** una vez.
8. Comprueba directamente ambas redes: imagen, texto, cuenta/página correctas y enlace de compra. En `feat/3-4-integracion-marketing` se corrigió el falso éxito ante respuestas vacías y se añadió consulta del estado asíncrono. Si aparece «Publicación sin confirmar», revisa Upload-Post y las redes antes de repetir para evitar duplicados. Estos cambios siguen locales, pendientes de la validación del equipo.

La configuración actual de `WEB_URL` es local. Sirve para que tu API obtenga el PNG durante esta prueba en tu PC, pero el enlace de compra publicado apuntará a localhost. Para que otras personas puedan abrirlo, primero despliega la web y configura su URL pública en `WEB_URL`.

Si pruebas compra y escaneo, configura antes `QR_SECRET` en el entorno de la API y mantenlo estable. `pnpm test:int` debe continuar usando exclusivamente la BD local de pruebas.

## Historias pendientes y estado del equipo

El tablero BMad informa **44 historias: 9 done, 10 review y 25 planned**. Varias ya están implementadas; ese conteo no equivale a 25 historias sin código. No se modificaron sus estados.

| Trabajo | Responsable según recorte | Estado comprobado |
|---|---|---|
| 2.5, 2.6, 2.11 y 2.10 reducida: elegir y comprar butaca | Manuel Alexis | Pendiente en main; la compra actual admite zona general. Sin rama remota identificada para el bloque completo. |
| 3.3 y 3.9 reducidas: formatos y textos por red | Sandro David | Incompleto: solo formato 4:5; faltan historia/afiche y textos diferenciados. |
| 4.1 y 4.4: panel del organizador | Sandro David | [PR #42](https://github.com/PierreCodex/Hackathon-LagTeam/pull/42) fusionado en `feat/4-c-comision-tablero`, no en main. Pendiente llevar esos cambios a main. |
| 1.11: calendario público | Sin asignación oficial comprobada | Portada y ficha existen, pero el enlace `/calendario` no tiene página en main. |
| 3.4: Upload-Post | Validación personal pendiente | [PR #41](https://github.com/PierreCodex/Hackathon-LagTeam/pull/41) integrado; confirmación asíncrona y éxito falso corregidos localmente en `feat/3-4-integracion-marketing`. Falta tu publicación real y validación del equipo. |
| 4.2, 4.3, 4.5 y 4.6: comisión, liquidación, tablero y Excel | Luis Armando | [PR #40](https://github.com/PierreCodex/Hackathon-LagTeam/pull/40) integrado en main; tickets desactualizados y validación humana por confirmar. |
| 2.7 y 2.12: puerta sin conexión | Quien termine primero | Opcional, sin implementación identificada. |

Aplazadas por el recorte: 2.2 (WhatsApp), 2.13 (mapa automático), 2.14/2.15 (Google Places), 3.5 (WhatsApp de campaña), 3.6 (APDAYC automático), 3.7/3.10 (Weekend) y epic 5 (croquis con IA). La 3.4 dejó de estar cortada en la práctica al integrarse su PR.

Antes de dar por finalizada la demo faltan el despliegue de API/web, la aplicación de migraciones remotas y el ensayo completo con cuentas y eventos creados en la nube.
