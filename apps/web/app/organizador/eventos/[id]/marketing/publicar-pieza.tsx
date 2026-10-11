"use client";

import {
  CODIGOS_MARKETING,
  MAX_TEXTO_PUBLICACION,
  PublicacionPiezaSchema,
  type ErrorApi,
  type Pieza,
  type PublicacionPieza,
  type RedPublicacion,
} from "@reto18/shared";
import { useState } from "react";
import { AreaTexto, Aviso, Boton, Campo, Chip, Tarjeta } from "@/components/ui";
import { CODIGO_RESPUESTA_INVALIDA, CODIGO_SIN_CONEXION, pedirApi } from "@/lib/api";
import { fechaPieza, nombreRed, textoPrecio, urlPng } from "@/lib/pieza";
import { tokenDelNavegador } from "@/lib/supabase/navegador";

export type PublicarPiezaProps = {
  apiUrl: string;
  pieza: Pieza;
};

const REDES: readonly RedPublicacion[] = ["instagram", "facebook"];
/** Hasta 2 min para Upload-Post más lectura de pieza, permisos y enlace en la BD. */
const TIEMPO_LIMITE_PUBLICAR_MS = 180_000;

/** Texto propuesto del post: los textos de la IA, fecha, sede y precio del evento, y hashtags locales. */
export function textoPublicacion(pieza: Pieza): string {
  const { textos, datos } = pieza;
  const precio = textoPrecio(datos.precio_minimo_centimos);
  const lineas = [
    textos.titular,
    "",
    textos.descripcion,
    "",
    `📅 ${fechaPieza(datos.inicio)}`,
    `📍 ${datos.sede}, ${datos.distrito}`,
    ...(precio ? [`🎟️ ${precio}`] : []),
    "",
    textos.llamado,
    "",
    "#PiuraCultural #QueHacerEnPiura",
  ];
  return lineas.join("\n").slice(0, MAX_TEXTO_PUBLICACION);
}

/** `datetime-local` ("2026-10-14T19:00") en hora de Lima (UTC−5, sin cambio de hora) → ISO con zona. */
export function aIsoLima(valor: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor) ? `${valor}:00-05:00` : undefined;
}

/**
 * "Publicar en redes" (3.4): publica o programa el flyer 4:5 en Instagram y Facebook con Upload-Post.
 * El post lleva un enlace rastreable de la pieza. Si falla, ofrece descargar la imagen y copiar el texto.
 */
export function PublicarPieza({ apiUrl, pieza }: PublicarPiezaProps) {
  const [redes, setRedes] = useState<RedPublicacion[]>([...REDES]);
  const [texto, setTexto] = useState(() => textoPublicacion(pieza));
  const [programar, setProgramar] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<PublicacionPieza | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);

  function alternar(red: RedPublicacion) {
    setRedes((actuales) => (actuales.includes(red) ? actuales.filter((r) => r !== red) : [...actuales, red]));
  }

  async function publicar() {
    if (publicando || redes.length === 0) return;
    setPublicando(true);
    setError(null);
    setResultado(null);

    const token = await tokenDelNavegador();
    if (!token) {
      setPublicando(false);
      setError({ codigo: "SIN_SESION", mensaje: "Tu sesión se cerró. Ingresa de nuevo para publicar." });
      return;
    }
    const r = await pedirApi(`marketing/piezas/${encodeURIComponent(pieza.id)}/publicaciones`, PublicacionPiezaSchema, {
      apiUrl,
      metodo: "POST",
      cabeceras: { Authorization: `Bearer ${token}` },
      cuerpo: {
        redes,
        texto: texto.trim() || undefined,
        programar_para: aIsoLima(programar),
      },
      tiempoLimiteMs: TIEMPO_LIMITE_PUBLICAR_MS,
    });
    setPublicando(false);
    if (r.ok) setResultado(r.datos);
    else setError(r.error);
  }

  return (
    <Tarjeta como="section" aria-labelledby="titulo-publicar" className="flex flex-col gap-4">
      <h3 id="titulo-publicar" className="text-title">
        Publicar en redes
      </h3>
      <p className="text-meta text-ink-secondary">
        Publica el flyer en Instagram y Facebook. El post lleva un enlace de la pieza: sus clics y ventas cuentan aquí.
      </p>

      <div role="group" aria-label="Redes" className="flex flex-wrap gap-2">
        {REDES.map((red) => (
          <Chip key={red} activo={redes.includes(red)} onClick={() => alternar(red)} disabled={publicando}>
            {nombreRed(red)}
          </Chip>
        ))}
      </div>

      <AreaTexto
        id="texto-publicacion"
        etiqueta="Texto del post"
        ayuda="Al final se añade el enlace de compra."
        rows={8}
        maxLength={MAX_TEXTO_PUBLICACION}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        disabled={publicando}
      />

      <Campo
        id="programar-publicacion"
        etiqueta="Programar (opcional)"
        ayuda="Hora de Lima. Déjalo vacío para publicar ahora."
        type="datetime-local"
        value={programar}
        onChange={(e) => setProgramar(e.target.value)}
        disabled={publicando}
      />

      <Boton onClick={() => void publicar()} disabled={publicando || redes.length === 0} className="max-sm:w-full sm:self-start">
        {publicando ? "Publicando…" : programar ? "Programar" : "Publicar ahora"}
      </Boton>

      {resultado && <AvisoResultado resultado={resultado} />}
      {resultado?.redes.some((red) => !red.ok) && (
        <AvisoErrorPublicar
          error={{ codigo: CODIGOS_MARKETING.PUBLICACION_SIN_CONFIRMAR, mensaje: "Revisa el resultado de cada red antes de repetir el envío. También puedes descargar el flyer y copiar el texto." }}
          pieza={pieza}
          texto={resultado.texto}
        />
      )}
      {error && <AvisoErrorPublicar error={error} pieza={pieza} texto={texto} />}
    </Tarjeta>
  );
}

/** Resultado por red, con el enlace al post si Upload-Post lo devuelve. */
export function AvisoResultado({ resultado }: { resultado: PublicacionPieza }) {
  const fallidas = resultado.redes.filter((r) => !r.ok);
  const titulo = fallidas.length === resultado.redes.length ? "No se confirmó la publicación."
    : fallidas.length > 0 ? "Publicado a medias."
      : resultado.programada ? "Publicación programada." : "¡Publicado!";
  return (
    <Aviso
      tipo={fallidas.length === 0 ? "exito" : fallidas.length === resultado.redes.length ? "error" : "advertencia"}
      titulo={titulo}
    >
      <ul className="flex flex-col gap-1">
        {resultado.redes.map((r) => (
          <li key={r.red}>
            {nombreRed(r.red)}:{" "}
            {r.ok ? (
              r.url ? (
                <a href={r.url} target="_blank" rel="noopener" className="text-ink-primary underline">
                  ver el post
                </a>
              ) : (
                "listo"
              )
            ) : (
              r.error
            )}
          </li>
        ))}
        <li>
          Enlace de compra: <span className="[overflow-wrap:anywhere]">{resultado.url_enlace}</span>
        </li>
      </ul>
    </Aviso>
  );
}

/** Error al publicar: el mensaje de la API y, como respaldo, descargar la imagen y copiar el texto. */
export function AvisoErrorPublicar({ error, pieza, texto }: { error: ErrorApi; pieza: Pieza; texto: string }) {
  const [copiado, setCopiado] = useState(false);
  const noConfigurada = error.codigo === CODIGOS_MARKETING.PUBLICACION_NO_CONFIGURADA;
  const respuestaPerdida = error.codigo === CODIGO_SIN_CONEXION || error.codigo === CODIGO_RESPUESTA_INVALIDA;
  const sinConfirmar = respuestaPerdida || error.codigo === CODIGOS_MARKETING.PUBLICACION_SIN_CONFIRMAR;
  return (
    <Aviso
      tipo={noConfigurada ? "advertencia" : "error"}
      titulo={sinConfirmar ? "Publicación sin confirmar." : "No pudimos publicar en redes."}
      accion={
        <div className="flex flex-wrap gap-2">
          <a
            href={urlPng(pieza.id, "4x5")}
            download={`pieza-${pieza.id}.png`}
            className="inline-flex h-12 items-center rounded-sm border border-ink-primary px-4 font-bold text-ink-primary"
          >
            Descargar imagen
          </a>
          <Boton
            variante="secundario"
            onClick={() =>
              void navigator.clipboard?.writeText(texto).then(
                () => setCopiado(true),
                () => setCopiado(false),
              )
            }
          >
            {copiado ? "Texto copiado" : "Copiar texto"}
          </Boton>
        </div>
      }
    >
      {respuestaPerdida
        ? "No recibimos la confirmación del envío. Revisa Upload-Post y tus redes antes de volver a publicar para evitar duplicados."
        : error.mensaje}
    </Aviso>
  );
}
