import { CODIGOS_MARKETING, PiezaSchema, type Pieza } from "@reto18/shared";
import { ImageResponse } from "next/og";
import { pedirApi } from "@/lib/api";
import { esFormatoPieza, fechaPieza, TAMANO_FORMATO, textoPrecio } from "@/lib/pieza";

/** Tiempo límite para leer la pieza y para traer la foto del evento. */
const TIEMPO_LIMITE_MS = 8000;
/** Formatos de foto que el renderizador sabe pintar. */
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];

/**
 * Foto del evento como `data:` URI, para que un fallo al traerla no rompa el PNG:
 * sin foto, foto que no carga o en un formato que no se puede pintar → `null` (fondo de la paleta).
 */
async function fotoComoDatos(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIEMPO_LIMITE_MS), cache: "no-store" });
    const tipo = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!res.ok || !TIPOS_FOTO.includes(tipo)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return `data:${tipo};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Tamaño del titular según su largo (hasta 90 caracteres), para que la fecha, la sede y el precio siempre quepan. */
function tamanoTitular(largo: number, conFoto: boolean): number {
  if (largo <= 30) return conFoto ? 72 : 104;
  if (largo <= 60) return conFoto ? 60 : 84;
  return conFoto ? 52 : 68;
}

/** Flyer 4:5 (1080 × 1350). Fecha, sede, dirección, precio y foto salen de `pieza.datos` (AD-11). */
function Flyer4x5({ pieza, foto }: { pieza: Pieza; foto: string | null }) {
  const { textos, paleta, datos } = pieza;
  const precio = textoPrecio(datos.precio_minimo_centimos);
  const { ancho, alto } = TAMANO_FORMATO["4x5"];
  const altoFoto = 620;

  return (
    <div
      style={{
        width: ancho,
        height: alto,
        display: "flex",
        flexDirection: "column",
        backgroundColor: paleta.fondo,
        color: paleta.texto,
        fontFamily: "sans-serif",
      }}
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element -- `next/og` pinta `<img>`, no `next/image`.
        <img src={foto} alt="" width={ancho} height={altoFoto} style={{ width: ancho, height: altoFoto, flexShrink: 0, objectFit: "cover" }} />
      ) : (
        <div style={{ display: "flex", width: ancho, height: 28, flexShrink: 0, backgroundColor: paleta.acento }} />
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minHeight: 0,
          padding: "56px 72px 64px",
          justifyContent: foto ? "space-between" : "center",
        }}
      >
        {/* Los textos de la IA ceden espacio; el bloque de datos (AD-11) nunca se recorta. */}
        <div style={{ display: "flex", flexDirection: "column", flexShrink: 1, minHeight: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              fontSize: tamanoTitular(textos.titular.length, foto !== null),
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            {textos.titular}
          </div>
          <div style={{ display: "flex", marginTop: 20, fontSize: foto ? (textos.subtitulo.length > 100 ? 28 : 32) : 40, lineHeight: 1.3, opacity: 0.85 }}>
            {textos.subtitulo}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, marginTop: foto ? 24 : 72 }}>
          <div style={{ display: "flex", width: 96, height: 8, backgroundColor: paleta.acento, marginBottom: 28 }} />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: paleta.acento }}>{fechaPieza(datos.inicio)}</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 36, fontWeight: 700 }}>{datos.sede}</div>
          <div style={{ display: "flex", marginTop: 6, fontSize: 28, opacity: 0.85 }}>
            {`${datos.direccion} · ${datos.distrito}`}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 32 }}>
            {precio && (
              <div
                style={{
                  display: "flex",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                  padding: "14px 28px",
                  borderRadius: 12,
                  backgroundColor: paleta.acento,
                  color: paleta.fondo,
                  fontSize: 34,
                  fontWeight: 800,
                  marginRight: 28,
                }}
              >
                {precio}
              </div>
            )}
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>{textos.llamado}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const noEncontrada = () => new Response("Pieza no encontrada", { status: 404 });

/** `GET /piezas/<id>/4x5`: el PNG de la pieza (AD-12). Pieza inexistente o formato distinto de 4x5 → 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ pieza: string; formato: string }> }) {
  const { pieza: piezaId, formato } = await params;
  if (!esFormatoPieza(formato)) return noEncontrada();

  const resultado = await pedirApi(`marketing/piezas/${encodeURIComponent(piezaId)}`, PiezaSchema, {
    tiempoLimiteMs: TIEMPO_LIMITE_MS,
  });
  if (!resultado.ok) {
    if (resultado.error.codigo === CODIGOS_MARKETING.PIEZA_NO_ENCONTRADA) return noEncontrada();
    return new Response("No pudimos leer la pieza", { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const pieza = resultado.datos;
  const foto = await fotoComoDatos(pieza.datos.foto_url);
  const { ancho, alto } = TAMANO_FORMATO[formato];
  return new ImageResponse(<Flyer4x5 pieza={pieza} foto={foto} />, {
    width: ancho,
    height: alto,
    // Caché corta: la pieza no cambia, pero sus datos salen del evento y este sí puede cambiar.
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
  });
}
