import { ClicRegistradoSchema, PATRON_CODIGO_ENLACE } from "@reto18/shared";
import { pedirApi } from "@/lib/api";

// Cada visita cuenta un clic: nada se prerenderiza ni se guarda en caché.
export const dynamic = "force-dynamic";

/** Tiempo límite del registro del clic: el visitante no espera más que esto para llegar a la ficha. */
const TIEMPO_LIMITE_CLIC_MS = 3000;

/** 307 (no 301): el navegador no guarda la redirección y cada visita vuelve a contar (AD-8). */
function redirigir(destino: string, req: Request): Response {
  return new Response(null, {
    status: 307,
    headers: { Location: new URL(destino, req.url).toString(), "Cache-Control": "no-store" },
  });
}

/** Bots que abren el enlace para armar la vista previa: no son clics de nadie. */
const BOT_VISTA_PREVIA =
  /facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|skypeuripreview|pinterest|redditbot|embedly|vkshare|applebot/i;

/** `HEAD /r/:codigo`: no cuenta clic (Next ejecutaría `GET` si no existiera). */
export function HEAD(req: Request): Response {
  return redirigir("/", req);
}

/**
 * `GET /r/:codigo`: registra el clic del enlace rastreable y redirige a la ficha del evento con
 * `?ref=:codigo` (AD-8). Código inválido, desconocido, la API caída o un bot de vista previa → al
 * catálogo sin contar el clic, nunca a una página de error.
 */
export async function GET(req: Request, { params }: { params: Promise<{ codigo: string }> }): Promise<Response> {
  const { codigo } = await params;
  if (!PATRON_CODIGO_ENLACE.test(codigo)) return redirigir("/", req);
  if (BOT_VISTA_PREVIA.test(req.headers.get("user-agent") ?? "")) return redirigir("/", req);

  const clic = await pedirApi(`marketing/enlaces/${codigo}/clics`, ClicRegistradoSchema, {
    metodo: "POST",
    tiempoLimiteMs: TIEMPO_LIMITE_CLIC_MS,
  });
  if (!clic.ok) return redirigir("/", req);

  const { evento_id } = clic.datos;
  return redirigir(`/eventos/${evento_id}?ref=${encodeURIComponent(codigo)}`, req);
}
