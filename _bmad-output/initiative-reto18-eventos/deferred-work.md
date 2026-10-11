# Trabajo aplazado

- source_plan: `_bmad-output/initiative-reto18-eventos/epic-base-roles-eventos/story-esqueleto-desplegado-plan.md`
  summary: Desplegar la API en Railway Hobby y la web en Vercel y comprobar desde un móvil que la URL de Vercel muestra "API ok · BD ok" (condición de la historia 1.1).
  evidence: Jean Pierre aún no tiene cuenta de Railway y decidió (10/10/2026) desarrollar todo en local y desplegar al final. Ya verificado en local: la imagen Docker de `apps/api/Dockerfile` responde 200 `bd: "ok"` contra el Supabase real y la web local muestra la hora de la BD; la CI pasa. Pendiente solo lo de producción: pasos en el README, sección "Despliegue". Reservar uno o dos días de margen antes de la demo.

- source_plan: none
  summary: Historia 1.3, parte del esquema: migraciones de sede > sección > fila > bloque > asiento, eventos y categorías de precio, esquemas zod en packages/shared y seed.sql con la sede de los croquis y los eventos de la demo.
  evidence: Se separó de la 1.3 (10/10/2026) porque las pruebas de integración son un entregable independiente que la 1.2 de Luis necesita antes; se construye justo después de ellas.

- source_plan: `_bmad-output/initiative-reto18-eventos/epic-base-roles-eventos/story-esquema-de-sedes-mapa-y-eventos-plan.md`
  summary: Actualizar la sección "Entornos" de la arquitectura para recoger Supabase local (CLI + Docker) como BD de prueba en cada máquina y en la CI.
  evidence: La línea 274 de `architecture-reto18-plataforma-eventos.md` dice "No hay entorno de pruebas intermedio", y desde la parte 1 de la 1.3 `pnpm test:int` usa Supabase local.

- source_plan: `_bmad-output/initiative-reto18-eventos/epic-base-roles-eventos/story-esquema-de-sedes-mapa-y-eventos-plan.md`
  summary: Igualar `[db] major_version` de `supabase/config.toml` (hoy 17, valor por defecto de `supabase init`) con la versión de Postgres del proyecto en la nube. Sin verificar; severidad estimada media.
  evidence: Se resuelve mirando la versión en el panel de Supabase (Settings > Infrastructure); si no es 17, las pruebas corren en otra versión mayor que desarrollo y producción.

- source_plan: `_bmad-output/initiative-reto18-eventos/epic-base-roles-eventos/story-api-registro-inicio-de-sesion-y-roles-plan.md`
  summary: Comprobar la historia 1.2 contra el Supabase real: aplicar la migración de identidad, registrar por la API, iniciar sesión con `signInWithPassword` y llamar a `GET /identidad/perfil`, y ejecutar `sembrar:admin` dos veces.
  evidence: Los criterios de aceptación 2 y 3 solo están probados con Supabase simulado (revisión quick, pasada 1). Se resuelve cuando la prueba real devuelva el rol y el WhatsApp en E.164 y deje un solo admin que puede iniciar sesión.

- source_plan: `_bmad-output/initiative-reto18-eventos/change-layout-escritorio-estilo-joinnus/change-layout-escritorio-estilo-joinnus.md`
  summary: "¿Olvidaste tu contraseña?" en la pantalla de acceso (Supabase `resetPasswordForEmail` y una pantalla para la contraseña nueva).
  evidence: Joinnus lo tiene; no está en la spec y no sirve al flujo de la demo. El prototipo `mockups/escritorio.html` lo muestra tachado.

- source_plan: `_bmad-output/initiative-reto18-eventos/change-layout-escritorio-estilo-joinnus/change-layout-escritorio-estilo-joinnus.md`
  summary: Favoritos y fila "Lo más vendido" con ranking en la portada.
  evidence: Requieren datos que la API del catálogo (1.6) no expone, como las ventas por evento. Se retoma si sobra tiempo tras el epic 4.
- source_plan: `_bmad-output/initiative-reto18-eventos/epic-marketing-ia/story-api-modulo-ia-y-primera-campana-plan.md`
  summary: Evitar que `campana.resumen` del modelo contradiga `presupuesto_total_soles` (historia 3.1; el rango de 30 a 150 soles ya se valida en `completar`).
  evidence: Sin verificar (severidad estimada media). `completar` recalcula el total pero deja el resumen libre del modelo. Se resuelve generando piezas con el modelo de Ollama real y comparando el resumen con el reparto.
- source_plan: `_bmad-output/initiative-reto18-eventos/epic-marketing-ia/story-api-modulo-ia-y-primera-campana-plan.md`
  summary: Proteger Ollama: limitar generaciones por organizador o evento y las llamadas concurrentes, y enviar una credencial opcional (`OLLAMA_TOKEN` o Cloudflare Access) al túnel.
  evidence: Revisión completa de la 3.1: el POST no tiene límite y cada llamada ocupa hasta 30 s del único Ollama; el túnel queda público sin autenticación.
- source_plan: `_bmad-output/initiative-reto18-eventos/epic-marketing-ia/story-api-modulo-ia-y-primera-campana-plan.md`
  summary: Endurecer la entrada y salida de la IA: delimitar título y descripción en el prompt (inyección), recortar textos largos en vez de descartar la respuesta, e incluir el cuerpo del error HTTP de Ollama en el log.
  evidence: Revisión completa de la 3.1. Depende de cómo se comporte el modelo real con `format` (pattern y maxLength); probar con el modelo de Jean Pierre.
- source_plan: `_bmad-output/initiative-reto18-eventos/epic-marketing-ia/story-api-modulo-ia-y-primera-campana-plan.md`
  summary: Robustez de `marketing`: validar los datos de la pieza antes de llamar a la IA e insertar (hoy un fallo de `PiezaSchema.parse` da 500 con la fila ya guardada), sacar `EntradaTextosYCampanaSchema.parse` del camino que lanza, y releer el estado del evento antes del insert.
  evidence: Revisión completa de la 3.1: casos poco frecuentes (foto_url relativa, sede vacía, evento rechazado durante la llamada a la IA).
- source_plan: `_bmad-output/initiative-reto18-eventos/epic-marketing-ia/story-api-modulo-ia-y-primera-campana-plan.md`
  summary: Calendario de la campaña: descartar publicaciones de hoy con la hora pasada y las del día del evento posteriores a su inicio; ajustar `horaMismoDia` para eventos antes de las 10:00.
  evidence: Revisión de la 3.1: casos poco frecuentes; la generación de eventos ya pasados queda bloqueada con 409 EVENTO_FINALIZADO.
- source_plan: `_bmad-output/initiative-reto18-eventos/epic-marketing-ia/story-api-modulo-ia-y-primera-campana-plan.md`
  summary: Limpieza y pruebas de la 3.1: `organizador_id` de `marketing_piezas` sin `on delete` ni vínculo con el dueño del evento; UUID, tiempo límite y `bdNoDisponible` duplicados entre módulos; pruebas que verifiquen que el GET lee los datos actuales del evento y las líneas de días del prompt; márgenes de tiempo de las pruebas.
  evidence: Revisión completa de la 3.1 (verification-gap y adversarial); sin impacto en la demo.
