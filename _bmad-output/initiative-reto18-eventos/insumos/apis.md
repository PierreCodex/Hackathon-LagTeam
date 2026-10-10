# APIs y servicios

**Sin claves aquí.** Las claves van en `.env`, que Git ignora.

Cada fila indica su estado. Lo que está "por comprobar" lo confirma P2 (Jean Pierre) con la prueba técnica. Lo decidido está en `../architecture-reto18-plataforma-eventos/`.

| Necesidad (criterio del reto) | Opción candidata | Estado |
|---|---|---|
| Pago con tarjeta, Yape o Plin (3) | **Pago simulado** dentro de la plataforma, sin API de pasarela (AD-6 de la arquitectura) | Decidido. Preguntar a los mentores si el jurado lo acepta |
| Textos, campaña, Weekend y alerta de APDAYC con IA (3, 5) | **Ollama** en el PC de Jean Pierre, accesible desde Railway por un túnel | Decidido. Falta elegir el modelo |
| Leer el croquis con IA (CAP-16) | **API de Claude** (`claude-sonnet-5-5`) | Decidido. Hace falta una clave con saldo |
| Piezas gráficas: publicación, historia y afiche (5) | Plantillas JSX convertidas en PNG con `next/og`, usando la foto del evento (AD-12) | Decidido |
| Código QR y escaneo en la puerta (4) | Librería de generación y lectura de QR en el navegador, con caché para el modo sin conexión | Por elegir |
| Publicar o exportar a Facebook e Instagram (6) | Exportar las piezas y los textos más un enlace rastreable propio. La API de Meta queda fuera por el tiempo de aprobación | Propuesta |
| Publicar en Instagram y Facebook desde la plataforma (6) | API unificada con plan gratis: **Upload-Post** (10 publicaciones al mes, 2 perfiles; TikTok solo de pago) o **Late, ahora Zernio** (2 cuentas gratis). TikTok y X, por exportación | Por comprobar: si el plan gratis permite programar y cuánto tarda conectar Instagram |
| Entregar el QR de la entrada por WhatsApp (3, 8) | **Evolution API** autoalojada (Docker), con un número de prueba del equipo, nunca el del Club. Respaldo: QR en pantalla en "Mis entradas" | Por comprobar |
| Programar campañas en redes (6) | ~~Metricool~~: descartado por coste (la API está en el plan de pago) | Descartado |
| Publicar en X (6) | Sin API gratuita: pago por publicación desde febrero de 2026. Solo exportar | Descartado para la demo |

## Enlaces

- Upload-Post: https://www.upload-post.com/
- Late / Zernio (comparativa): https://getlate.dev/metricool-vs-late
- Comparativa de APIs gratuitas de redes: https://social-api.ai/blog/free-social-media-api-2026
- Evolution API: _(añadir la documentación cuando se pruebe)_
