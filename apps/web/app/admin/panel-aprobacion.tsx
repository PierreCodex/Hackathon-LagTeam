"use client";

import {
  ConstanciaEventoSchema,
  EventoRevisionSchema,
  type ErrorApi,
  type EventoRevision,
} from "@reto18/shared";
import { useState } from "react";
import type { ZodType } from "zod";
import { AreaTexto, Aviso, Boton, BotonEnlace, Tarjeta } from "@/components/ui";
import { ETIQUETA_CATEGORIA } from "@/lib/alta-evento";
import { pedirApi } from "@/lib/api";
import { clases } from "@/lib/clases";
import { fechaPieza } from "@/lib/pieza";
import {
  abrirConstancia,
  aplicarErrorAccion,
  ESTADO_EVENTO,
  MAXIMO_MOTIVO,
  validarMotivo,
  type AccionRevision,
  type AvisoDecidido,
} from "@/lib/revision";
import { rutaIngresar } from "@/lib/sesion";
import { tokenDelNavegador } from "@/lib/supabase/navegador";

export type { AccionRevision } from "@/lib/revision";

export type EstadoRechazo = { abierto: boolean; motivo: string; error?: string };

/** Lo que la pantalla sabe de cada tarjeta mientras sigue abierta. */
type EstadoTarjeta = {
  id: string;
  evento: EventoRevision;
  accion: AccionRevision | null;
  error: ErrorApi | null;
  rechazo: EstadoRechazo;
  /** La API respondió `url: null` al pedir la constancia. */
  sinConstancia: boolean;
};

export type PanelAprobacionProps = {
  /** Base de la API (`API_URL`): las acciones van del navegador a la API con el token de la sesión. */
  apiUrl: string;
  /** Pendientes leídos en el servidor (`GET /eventos/pendientes`). */
  pendientes: EventoRevision[];
  rutaActual: string;
};

const RECHAZO_CERRADO: EstadoRechazo = { abierto: false, motivo: "" };

/** Pantalla Aprobar (1.10, Flow 4): pendientes con constancia, alerta, "Aprobar", "Rechazar" y "Destacar". */
export function PanelAprobacion({ apiUrl, pendientes, rutaActual }: PanelAprobacionProps) {
  // Tarjetas y aviso de "ya decidido" juntos: un 409 cambia los dos a la vez.
  const [{ tarjetas, decidido }, setLista] = useState<{ tarjetas: EstadoTarjeta[]; decidido: AvisoDecidido | null }>(
    () => ({
      tarjetas: pendientes.map((evento) => ({
        id: evento.id,
        evento,
        accion: null,
        error: null,
        rechazo: RECHAZO_CERRADO,
        sinConstancia: false,
      })),
      decidido: null,
    }),
  );
  const [sinSesion, setSinSesion] = useState(false);

  function actualizar(id: string, cambio: (tarjeta: EstadoTarjeta) => Partial<EstadoTarjeta>) {
    setLista((actual) => ({
      ...actual,
      tarjetas: actual.tarjetas.map((t) => (t.id === id ? { ...t, ...cambio(t) } : t)),
    }));
  }

  /** Llama a la API con el token del navegador; `null` si no hubo sesión o si el evento salió de la lista. */
  async function llamar<T>(
    evento: EventoRevision,
    accion: AccionRevision,
    ruta: string,
    esquema: ZodType<T>,
    opciones: { metodo?: string; cuerpo?: unknown } = {},
  ): Promise<T | null> {
    actualizar(evento.id, () => ({ accion, error: null }));
    setSinSesion(false);

    const token = await tokenDelNavegador();
    if (!token) {
      actualizar(evento.id, () => ({ accion: null }));
      setSinSesion(true);
      return null;
    }

    const resultado = await pedirApi(`eventos/${encodeURIComponent(evento.id)}/${ruta}`, esquema, {
      apiUrl,
      metodo: opciones.metodo,
      cuerpo: opciones.cuerpo,
      cabeceras: { Authorization: `Bearer ${token}` },
    });

    if (resultado.ok) {
      actualizar(evento.id, () => ({ accion: null }));
      return resultado.datos;
    }
    const error = resultado.error;
    setLista((actual) => {
      const siguiente = aplicarErrorAccion(actual.tarjetas, evento, accion, error);
      return { tarjetas: siguiente.tarjetas, decidido: siguiente.decidido ?? actual.decidido };
    });
    return null;
  }

  async function verConstancia(evento: EventoRevision) {
    // Se abre la pestaña al pulsar (si no, el navegador la bloquea) y luego se le da la URL firmada.
    const pestana = window.open("about:blank", "_blank");
    const constancia = await llamar(evento, "constancia", "constancia", ConstanciaEventoSchema);
    const resultado = abrirConstancia(constancia, pestana, (url) => window.open(url, "_blank", "noopener"));
    if (resultado === "sin-constancia") actualizar(evento.id, () => ({ sinConstancia: true }));
  }

  async function aprobar(evento: EventoRevision) {
    const actualizado = await llamar(evento, "aprobar", "aprobar", EventoRevisionSchema, { metodo: "PATCH" });
    if (actualizado) actualizar(evento.id, () => ({ evento: actualizado, rechazo: RECHAZO_CERRADO }));
  }

  async function confirmarRechazo(tarjeta: EstadoTarjeta) {
    const motivo = validarMotivo(tarjeta.rechazo.motivo);
    if (!motivo.ok) {
      actualizar(tarjeta.evento.id, (t) => ({ rechazo: { ...t.rechazo, error: motivo.error } }));
      return;
    }
    const actualizado = await llamar(tarjeta.evento, "rechazar", "rechazar", EventoRevisionSchema, {
      metodo: "PATCH",
      cuerpo: { motivo_rechazo: motivo.motivo },
    });
    if (actualizado) actualizar(tarjeta.evento.id, () => ({ evento: actualizado, rechazo: RECHAZO_CERRADO }));
  }

  async function destacar(evento: EventoRevision) {
    const actualizado = await llamar(evento, "destacar", "destacado", EventoRevisionSchema, {
      metodo: "PATCH",
      cuerpo: { destacado: !evento.destacado },
    });
    if (actualizado) actualizar(evento.id, () => ({ evento: actualizado }));
  }

  return (
    <div className="flex flex-col gap-4">
      {sinSesion && (
        <Aviso
          tipo="error"
          titulo="Tu sesión se cerró."
          accion={
            <BotonEnlace href={rutaIngresar(rutaActual)} variante="secundario">
              Ingresar
            </BotonEnlace>
          }
        >
          Ingresa de nuevo para revisar los eventos.
        </Aviso>
      )}

      {decidido && (
        <Aviso tipo="advertencia" titulo={decidido.titulo}>
          {decidido.mensaje} Ya no está en tu lista.
        </Aviso>
      )}

      {tarjetas.length === 0 ? (
        <ListaVacia />
      ) : (
        <ul className="flex flex-col gap-4">
          {tarjetas.map((t) => (
            <li key={t.id}>
              <TarjetaRevision
                evento={t.evento}
                accion={t.accion}
                error={t.error}
                rechazo={t.rechazo}
                sinConstancia={t.sinConstancia}
                onVerConstancia={() => void verConstancia(t.evento)}
                onAprobar={() => void aprobar(t.evento)}
                onAbrirRechazo={() => actualizar(t.evento.id, () => ({ rechazo: { abierto: true, motivo: "" }, error: null }))}
                onCambiarMotivo={(motivo) =>
                  actualizar(t.evento.id, (actual) => ({ rechazo: { ...actual.rechazo, motivo, error: undefined } }))
                }
                onConfirmarRechazo={() => void confirmarRechazo(t)}
                onCancelarRechazo={() => actualizar(t.evento.id, () => ({ rechazo: RECHAZO_CERRADO }))}
                onDestacar={() => void destacar(t.evento)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Sin pendientes: no hay nada que decidir. */
export function ListaVacia() {
  return (
    <Tarjeta como="section" aria-labelledby="titulo-sin-pendientes" className="flex flex-col gap-2">
      <h2 id="titulo-sin-pendientes" className="text-title">
        No hay eventos pendientes
      </h2>
      <p className="text-ink-secondary">Cuando un organizador envíe un evento, aparecerá aquí para que lo revises.</p>
    </Tarjeta>
  );
}

export type TarjetaRevisionProps = {
  evento: EventoRevision;
  accion: AccionRevision | null;
  error: ErrorApi | null;
  rechazo: EstadoRechazo;
  sinConstancia?: boolean;
  onVerConstancia: () => void;
  onAprobar: () => void;
  onAbrirRechazo: () => void;
  onCambiarMotivo: (motivo: string) => void;
  onConfirmarRechazo: () => void;
  onCancelarRechazo: () => void;
  onDestacar: () => void;
};

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-meta text-ink-secondary">{etiqueta}</dt>
      <dd className="[overflow-wrap:anywhere]">{valor}</dd>
    </div>
  );
}

/** Tarjeta de un evento en revisión. Sin estado propio: lo recibe todo de `PanelAprobacion`. */
export function TarjetaRevision({
  evento,
  accion,
  error,
  rechazo,
  sinConstancia = false,
  onVerConstancia,
  onAprobar,
  onAbrirRechazo,
  onCambiarMotivo,
  onConfirmarRechazo,
  onCancelarRechazo,
  onDestacar,
}: TarjetaRevisionProps) {
  const estado = ESTADO_EVENTO[evento.estado];
  const pendiente = evento.estado === "pendiente";
  const ocupado = accion !== null;
  const idTitulo = `titulo-evento-${evento.id}`;
  const tieneConstancia = evento.constancia_apdayc_url !== null && !sinConstancia;

  return (
    <Tarjeta como="article" aria-labelledby={idTitulo} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={idTitulo} className="text-title [overflow-wrap:anywhere]">
          {evento.titulo}
        </h2>
        <p className={clases("flex items-center gap-1 text-meta", estado.color)}>
          <span aria-hidden="true">{estado.simbolo}</span>
          <span>{estado.texto}</span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Dato etiqueta="Categoría" valor={ETIQUETA_CATEGORIA[evento.categoria]} />
        <Dato etiqueta="Fecha" valor={fechaPieza(evento.inicio)} />
        <Dato etiqueta="Distrito" valor={evento.distrito} />
        <Dato etiqueta="Aforo" valor={`${evento.aforo} personas`} />
        <Dato etiqueta="Música" valor={evento.hay_musica ? "Sí" : "No"} />
      </dl>

      <div className="flex flex-col gap-1">
        <h3 className="text-meta text-ink-secondary">Descripción</h3>
        <p className="whitespace-pre-line [overflow-wrap:anywhere]">{evento.descripcion}</p>
      </div>

      {evento.alerta_apdayc !== null && (
        <Aviso tipo="advertencia" titulo="Revisa la música y la constancia de APDAYC.">
          {evento.alerta_apdayc}
        </Aviso>
      )}

      {error && <AvisoErrorRevision error={error} />}

      {pendiente && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {tieneConstancia ? (
            <Boton variante="secundario" onClick={onVerConstancia} disabled={ocupado} className="max-sm:w-full">
              {accion === "constancia" ? "Abriendo…" : "Ver constancia"}
            </Boton>
          ) : (
            <p className="text-meta text-ink-secondary">Sin constancia</p>
          )}
        </div>
      )}

      {pendiente &&
        (rechazo.abierto ? (
          <FormularioMotivo
            id={`motivo-${evento.id}`}
            motivo={rechazo.motivo}
            error={rechazo.error}
            enviando={accion === "rechazar"}
            bloqueado={ocupado}
            onCambiar={onCambiarMotivo}
            onConfirmar={onConfirmarRechazo}
            onCancelar={onCancelarRechazo}
          />
        ) : (
          <div className="flex flex-col gap-2 border-t border-border-hairline pt-4 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={onAbrirRechazo} disabled={ocupado} className="max-sm:w-full">
              Rechazar
            </Boton>
            <Boton onClick={onAprobar} disabled={ocupado} className="max-sm:w-full sm:min-w-40">
              {accion === "aprobar" ? "Aprobando…" : "Aprobar"}
            </Boton>
          </div>
        ))}

      {evento.estado === "aprobado" && (
        <InterruptorDestacar destacado={evento.destacado} enCurso={accion === "destacar"} onCambiar={onDestacar} />
      )}

      {evento.estado === "rechazado" && evento.motivo_rechazo && (
        <div className="flex flex-col gap-1 border-t border-border-hairline pt-4">
          <h3 className="text-meta text-ink-secondary">Motivo del rechazo</h3>
          <p className="[overflow-wrap:anywhere]">{evento.motivo_rechazo}</p>
        </div>
      )}
    </Tarjeta>
  );
}

/** Error de una acción con el mensaje de la API tal cual. */
export function AvisoErrorRevision({ error }: { error: ErrorApi }) {
  return (
    <Aviso tipo="error" titulo="No pudimos completar la acción.">
      {error.mensaje}
    </Aviso>
  );
}

export type FormularioMotivoProps = {
  id: string;
  motivo: string;
  error?: string;
  enviando: boolean;
  /** Otra acción de la tarjeta en curso (p. ej. la constancia): todo desactivado, sin "Rechazando…". */
  bloqueado?: boolean;
  onCambiar: (motivo: string) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
};

/** Rechazo en línea: el motivo (1–600) y la confirmación, porque rechazar no se puede deshacer. */
export function FormularioMotivo({
  id,
  motivo,
  error,
  enviando,
  bloqueado = false,
  onCambiar,
  onConfirmar,
  onCancelar,
}: FormularioMotivoProps) {
  const desactivado = enviando || bloqueado;
  return (
    <form
      noValidate
      className="flex flex-col gap-3 border-t border-border-hairline pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!desactivado) onConfirmar();
      }}
    >
      <AreaTexto
        id={id}
        etiqueta="Motivo del rechazo"
        ayuda={`El organizador lo verá tal cual en Mis eventos. Hasta ${MAXIMO_MOTIVO} caracteres. Rechazar no se puede deshacer.`}
        error={error}
        value={motivo}
        onChange={(e) => onCambiar(e.target.value)}
        disabled={desactivado}
        rows={3}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Boton variante="secundario" onClick={onCancelar} disabled={desactivado} className="max-sm:w-full">
          Cancelar
        </Boton>
        <Boton type="submit" disabled={desactivado} className="max-sm:w-full sm:min-w-48">
          {enviando ? "Rechazando…" : "Confirmar rechazo"}
        </Boton>
      </div>
    </form>
  );
}

/** "Destacar" del evento recién aprobado: interruptor con texto, no solo color. */
export function InterruptorDestacar({
  destacado,
  enCurso,
  onCambiar,
}: {
  destacado: boolean;
  enCurso: boolean;
  onCambiar: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-meta text-ink-secondary">Los destacados aparecen primero en el catálogo.</p>
      <button
        type="button"
        role="switch"
        aria-checked={destacado}
        onClick={onCambiar}
        disabled={enCurso}
        className="inline-flex min-h-12 items-center gap-3 self-start rounded-md px-2 text-button disabled:cursor-not-allowed disabled:text-ink-muted sm:self-auto"
      >
        <span
          aria-hidden="true"
          className={clases(
            "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border",
            destacado ? "border-accent bg-accent" : "border-ink-muted bg-transparent",
          )}
        >
          <span
            className={clases(
              "absolute size-4 rounded-full",
              destacado ? "left-[calc(100%-1.25rem)] bg-on-accent" : "left-1 bg-ink-secondary",
            )}
          />
        </span>
        <span>Destacar</span>
        <span className="text-meta text-ink-secondary">{enCurso ? "Guardando…" : destacado ? "★ Destacado" : "No destacado"}</span>
      </button>
    </div>
  );
}
