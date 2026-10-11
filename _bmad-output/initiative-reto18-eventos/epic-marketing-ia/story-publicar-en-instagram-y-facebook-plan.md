---
title: 'Completar el flujo Ollama, flyer y Upload-Post'
type: 'bugfix'
ticket: 4
created: '2026-10-11'
status: 'built'
baseline_revision: 'b2209ee3b830a8198ab551a2c87fa2b7aa17ed35'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** El usuario pide completar la integración de marketing para generar con Ollama, construir el flyer y enviarlo a Facebook/Instagram por Upload-Post. Las conexiones básicas existen, pero falta configuración local de Ollama y Upload-Post puede producir falsos éxitos cuando devuelve respuestas vacías o trabajos aún en proceso.

**Approach:** Reutilizar la generación, almacenamiento y plantilla PNG existentes. Configurar un modelo instalado después de probarlo, endurecer la confirmación de publicación y verificar el recorrido con Supabase local y proveedores simulados. La publicación real queda a cargo del usuario, según su instrucción previa. Su petición de implementar y continuar autoriza el trabajo local; commits, push, PR y cambios de esquema remotos siguen fuera de esta autorización.

## Boundaries & Constraints

**Always:** AD-1/2/8/11/12: credenciales solo en API; acceso por dueño; textos/paleta/campaña de IA, datos del evento de BD; PNG 4:5 de la plantilla web; enlace rastreable. Mantener contratos de respuesta y degradación de IA. Pruebas de BD exclusivamente en Supabase local. Una sola petición de publicación por acción; consultar estado no vuelve a publicar. Conservar archivos personales sin seguimiento.

**Never:** Publicar en cuentas reales durante las pruebas, modificar Supabase remoto, copiar datos de demo a nube, generar imágenes con IA, implementar otros formatos ni compra de butacas, imprimir secretos o cerrar la historia como aceptada por el equipo.

## I/O & Edge-Case Matrix

| Escenario | Entrada | Comportamiento esperado |
|---|---|---|
| Generación | Evento aprobado y respuesta válida de Ollama | Pieza con textos/paleta y origen IA; PNG sigue datos del evento |
| Envío | Pieza del dueño, PNG y redes seleccionadas | Multipart con PNG, texto y enlace; resultado confirmado por red |
| Asíncrono | request_id y estado en proceso | Consultar hasta estado terminal; no declarar éxito por aceptación |
| Respuesta incompleta | Vacía, JSON inválido, red ausente o skipped | No marcar esa red como publicada |
| Programación | success verdadero y job_id | Confirmar programación; sin job_id no confirmarla |
| Fallo parcial/total | Una o todas las redes fallan | Mensaje distingue resultado parcial, fallo y falta de confirmación |
| Tiempo agotado | No se puede confirmar después del envío | Error explícito: revisar redes antes de repetir; sin reenvío automático |
| Permisos | Anónimo, otro rol u otro dueño | Rechazo sin contactar Upload-Post |

</frozen-after-approval>

## Code Map

- `apps/api/src/ia/adaptador-ollama.ts` y `funciones/textos-y-campana.ts`: generación estructurada validada. qwen2.5:latest y qwen2.5:14b están instalados. Una prueba real del primero devolvió 170 soles y activó respaldo; conservar la validación y reforzar instrucciones antes de configurar.
- `apps/api/src/marketing/marketing.service.ts`: obtiene pieza, comprueba dueño creando enlace y llama al adaptador con la URL del PNG.
- `apps/api/src/marketing/publicador-upload-post.ts`: envía archivo con FormData. Falta seguimiento async y confirmación estricta; API oficial fija, sin URL configurable nueva.
- `apps/web/app/organizador/eventos/[id]/marketing/publicar-pieza.tsx`: texto editable, botón y avisos; hoy todo fallo se titula publicación parcial y la programación se anuncia sin revisar fallos.
- `apps/web/app/piezas/[pieza]/[formato]/route.tsx`: renderer existente; sus pruebas comprueban PNG y dimensiones.
- `apps/api/test/integracion/marketing.int.spec.ts` y ayudas: patrón para app Nest real, usuarios efímeros y limpieza de BD local.
- Documentación oficial: https://docs.upload-post.com/api/upload-photo/ y https://docs.upload-post.com/api/upload-status/. async_upload devuelve request_id; resultados de status son array por platform; solo completed/failed son terminales. Programadas devuelven job_id.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/marketing/publicador-upload-post.ts` y pruebas: envío async, consultas acotadas al presupuesto total, normalización estricta de resultados inmediatos/asíncronos/programados, respuestas inesperadas y timeout.
- [x] `apps/api/src/marketing/marketing.service.ts` y `apps/web/app/organizador/eventos/[id]/marketing/publicar-pieza.tsx` con pruebas: mensajes correctos ante falta de confirmación y resultados fallidos, conservando descargar/copiar.
- [x] `apps/api/test/integracion/marketing-publicaciones.int.spec.ts`: generar pieza y enviarla mediante adaptador real con fetch de proveedor interceptado; verificar contenido, enlace, acceso y errores sin publicar en redes.
- [x] `.env` privado: configurar Ollama disponible tras generación válida; reforzar prompt en `funciones/textos-y-campana.ts` si hace falta. No cambiar límites para aceptar respuesta inválida.
- [x] `README.md`: documentar configuración, flujo de prueba y diferencia entre publicación aceptada, programada y confirmada.

**Acceptance Criteria:**
- Dado el modelo instalado, cuando se ejecuta generación real ficticia, entonces pasa el esquema y reporta origen IA; si falla se informa sin esconder el respaldo.
- Dada una pieza del organizador, cuando publica, entonces el multipart lleva los bytes del PNG y texto de esa pieza con enlace rastreable.
- Dado un trabajo en proceso o una respuesta sin confirmación, cuando la UI recibe el resultado, entonces no anuncia publicación exitosa.
- Dada una cuenta ajena, cuando intenta publicar, entonces no se envía información al proveedor.

## Implementation Notes

- Plan derivado de la autorización del usuario para integrar y continuar; implementación local en `feat/3-4-integracion-marketing`.
- El agente de investigación se interrumpió por límite de uso. Continuar implementación local si la capacidad de subagentes sigue indisponible.
- Implementación continuada localmente tras interrupción de la sesión. Pruebas focalizadas: 26 de API, 13 de UI/PNG y 3 del recorrido integrado aprobadas.
- Ollama real `qwen2.5:latest`: origen IA válido en 15.682 s, presupuesto 130 soles. Configurado en `.env` privado tras reforzar el prompt sin relajar la validación.
- Upload-Post autenticado mediante GET de perfiles: HTTP 200, un perfil. No se publicó contenido. Supabase remoto aún devuelve HTTP 404 para marketing_piezas; aplicar migraciones sigue pendiente de la prueba personal.

## Plan Change Log

## Review Triage Log

Revisión independiente quick de `/root/revisar_integracion`: dos hallazgos aceptados y corregidos; ninguno aplazado.

| Hallazgo | Decisión y evidencia |
|---|---|
| El POST de subida heredaba el límite de consulta de 15 s | Corregido: usa el presupuesto total restante; prueba con subida de 20 s y señal de aborto verifica publicación confirmada con un solo POST. |
| Los errores de transporte del navegador recomendaban repetir un envío incierto | Corregido en el aviso de publicación: SIN_CONEXION y RESPUESTA_INVALIDA muestran falta de confirmación y piden revisar redes antes de repetir; pruebas para ambos códigos conservan descargar/copiar. |

## Verification

- Verificación final: `pnpm build` y `pnpm lint` aprobados; `pnpm test`: 666 pruebas (396 API, 270 web); `pnpm test:int`: 182 pruebas en 15 archivos, todas aprobadas.
- La primera ejecución completa detectó en la BD local una migración de comisión y la semilla del tablero pendientes. Se aplicó `supabase migration up --local` y `seed-tablero.sql` exclusivamente al contenedor `supabase_db_reto18`, sin reset; la ejecución completa posterior pasó.
- Prueba real de Ollama sin guardar datos ni publicar; comprobación de generación PNG y envío simulado.
- Publicación real y aceptación final: pendientes de la verificación personal del usuario.
- Tras presentar la verificación, el usuario autorizó explícitamente: «sube cambios y genera el pr». Se prepara commit, push y PR con los cambios verificados; no se cambiaron tickets a done y la publicación real sigue pendiente.
