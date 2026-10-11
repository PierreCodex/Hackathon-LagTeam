import { MisEntradasSchema, type ErrorApi, type MiEntrada } from "@reto18/shared";
import type { Metadata } from "next";
import { GuardaCuenta } from "@/components/layout/guarda-cuenta";
import { QrEntrada } from "@/components/entradas/qr-entrada";
import { Aviso, BotonEnlace, Tarjeta } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { fechaPieza } from "@/lib/pieza";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Mis entradas · Reto 18" };

const RUTA = "/mis-entradas";

/** Entradas propias (`GET ventas/mis-entradas`) con el token de la sesión, o el error para "Reintentar". */
async function cargarMisEntradas(): Promise<{ entradas: MiEntrada[]; error?: ErrorApi }> {
  const supabase = await crearClienteServidor();
  let token: string | undefined;
  try {
    token = (await supabase?.auth.getSession())?.data.session?.access_token;
  } catch {
    token = undefined;
  }
  if (!token) {
    return {
      entradas: [],
      error: { codigo: "SIN_SESION", mensaje: "Tu sesión se cerró. Recarga la página para ingresar de nuevo." },
    };
  }
  const resultado = await pedirApi("ventas/mis-entradas", MisEntradasSchema, {
    cabeceras: { Authorization: `Bearer ${token}` },
  });
  return resultado.ok ? { entradas: resultado.datos } : { entradas: [], error: resultado.error };
}

async function ContenidoMisEntradas() {
  const { entradas, error } = await cargarMisEntradas();

  if (error) {
    return (
      <Aviso
        tipo="error"
        titulo="No pudimos cargar tus entradas."
        accion={
          <BotonEnlace href={RUTA} variante="secundario" prefetch={false}>
            Reintentar
          </BotonEnlace>
        }
      >
        {error.mensaje}
      </Aviso>
    );
  }

  if (entradas.length === 0) {
    return (
      <Tarjeta como="section" aria-labelledby="titulo-sin-entradas" className="flex flex-col gap-3">
        <h2 id="titulo-sin-entradas" className="text-title">
          Todavía no tienes entradas
        </h2>
        <p className="text-ink-secondary">Cuando compres una entrada, aparecerá aquí con su código QR.</p>
        <BotonEnlace href="/" anchoCompleto className="sm:w-auto">
          Explorar eventos
        </BotonEnlace>
      </Tarjeta>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {entradas.map((entrada) => (
        <li key={entrada.id}>
          <Tarjeta
            como="article"
            aria-labelledby={`titulo-entrada-${entrada.id}`}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-1">
              <h2 id={`titulo-entrada-${entrada.id}`} className="text-title [overflow-wrap:anywhere]">
                {entrada.evento.titulo}
              </h2>
              <p className="text-ink-secondary">{fechaPieza(entrada.evento.inicio)}</p>
              <p className="text-ink-secondary">
                {entrada.evento.sede.nombre} · {entrada.evento.sede.direccion}
              </p>
              <p className="text-meta text-ink-secondary">{entrada.categoria}</p>
              {entrada.asiento && (
                <p className="text-meta text-ink-secondary">
                  Sección {entrada.asiento.seccion} · Fila {entrada.asiento.fila} · Asiento {entrada.asiento.numero}
                </p>
              )}
              {entrada.usada_en && (
                <p className="text-meta text-state-warning">Usada el {fechaPieza(entrada.usada_en)}</p>
              )}
            </div>
            <QrEntrada valor={entrada.qr} etiqueta={entrada.evento.titulo} />
          </Tarjeta>
        </li>
      ))}
    </ul>
  );
}

/** Mis entradas (historia 8, Flow 2): cualquier cuenta autenticada, con el QR de cada entrada propia. */
export default function MisEntradas() {
  return (
    <GuardaCuenta ruta={RUTA} titulo="Mis entradas" destinoActivo="entradas">
      {() => <ContenidoMisEntradas />}
    </GuardaCuenta>
  );
}
