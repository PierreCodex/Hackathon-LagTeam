"use client";

import {
  type CategoriaEvento,
  type Comision,
  ComisionSchema,
  type FilaTablero,
  type ModeloComision,
  type Tablero,
} from "@reto18/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Aviso, Boton, Campo, Selector, Tarjeta } from "@/components/ui";
import { pedirApi, urlApi } from "@/lib/api";
import { etiquetaCategoria, soles } from "@/lib/catalogo";
import { tokenDelNavegador } from "@/lib/supabase/navegador";
import { anchoBarra, ETIQUETA_MODELO, leerComision, textoComision, valorEnFormulario } from "@/lib/tablero";

export type PanelTableroProps = {
  /** Base de la API: el cambio de comisión y el Excel van del navegador a la API con el token. */
  apiUrl: string;
  tablero: Tablero;
};

const OPCIONES_MODELO = (Object.keys(ETIQUETA_MODELO) as ModeloComision[]).map((valor) => ({
  valor,
  etiqueta: ETIQUETA_MODELO[valor],
}));

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <Tarjeta>
      <p className="text-sm text-ink-secondary">{etiqueta}</p>
      <p className="mt-1 text-2xl font-bold text-ink-primary">{valor}</p>
      {detalle ? <p className="mt-1 text-sm text-ink-secondary">{detalle}</p> : null}
    </Tarjeta>
  );
}

function Barras({ titulo, filas, etiqueta }: { titulo: string; filas: FilaTablero[]; etiqueta?: (clave: string) => string }) {
  const maximo = Math.max(0, ...filas.map((f) => f.importe_centimos));
  return (
    <Tarjeta como="section">
      <h2 className="text-lg font-bold text-ink-primary">{titulo}</h2>
      {filas.length === 0 ? <p className="mt-2 text-ink-secondary">Aún no hay ventas.</p> : null}
      <ul className="mt-3 space-y-3">
        {filas.map((f) => (
          <li key={f.clave}>
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-ink-primary">{etiqueta ? etiqueta(f.clave) : f.clave}</span>
              <span className="text-ink-secondary">
                {soles(f.importe_centimos)} · {f.entradas} entradas
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-border-hairline">
              <div className="h-2 rounded-full bg-accent" style={{ width: `${anchoBarra(f.importe_centimos, maximo)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

function FormularioComision({ apiUrl, comision }: { apiUrl: string; comision: Comision }) {
  const router = useRouter();
  const [modelo, setModelo] = useState<ModeloComision>(comision.modelo);
  const [valor, setValor] = useState(valorEnFormulario(comision));
  const [error, setError] = useState<string | null>(null);
  const [guardada, setGuardada] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardada(false);
    const leida = leerComision(modelo, valor);
    if (!leida.ok) {
      setError(leida.error);
      return;
    }
    setError(null);
    setEnviando(true);
    const token = await tokenDelNavegador();
    if (!token) {
      setEnviando(false);
      setError("Tu sesión terminó. Vuelve a ingresar.");
      return;
    }
    const resultado = await pedirApi("negocio/comision", ComisionSchema, {
      apiUrl,
      metodo: "PUT",
      cuerpo: leida.comision,
      cabeceras: { Authorization: `Bearer ${token}` },
    });
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error.mensaje);
      return;
    }
    setGuardada(true);
    router.refresh();
  }

  return (
    <Tarjeta como="section">
      <h2 className="text-lg font-bold text-ink-primary">Modelo de ingresos</h2>
      <p className="mt-1 text-sm text-ink-secondary">
        Vigente: <strong className="text-ink-primary">{textoComision(comision)}</strong>. Las ventas ya pagadas
        conservan la comisión con la que se pagaron.
      </p>
      <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={guardar} noValidate>
        <Selector
          id="modelo-comision"
          etiqueta="Modelo"
          opciones={OPCIONES_MODELO}
          value={modelo}
          onChange={(e) => setModelo(e.target.value as ModeloComision)}
        />
        <Campo
          id="valor-comision"
          etiqueta={modelo === "porcentaje" ? "Porcentaje (%)" : "Monto (S/)"}
          inputMode="decimal"
          value={valor}
          error={error ?? undefined}
          onChange={(e) => setValor(e.target.value)}
        />
        <Boton type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar comisión"}
        </Boton>
      </form>
      {guardada ? (
        <p className="mt-2 text-sm text-state-success" role="status">
          Comisión actualizada. Se aplica a las ventas nuevas.
        </p>
      ) : null}
    </Tarjeta>
  );
}

function BotonExcel({ apiUrl }: { apiUrl: string }) {
  const [estado, setEstado] = useState<"listo" | "bajando" | "error">("listo");

  async function descargar() {
    setEstado("bajando");
    const token = await tokenDelNavegador();
    try {
      if (!token) throw new Error("sin sesión");
      const respuesta = await fetch(urlApi(apiUrl, "negocio/tablero/excel"), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const url = URL.createObjectURL(await respuesta.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "tablero-piura-cultural.xlsx";
      enlace.click();
      URL.revokeObjectURL(url);
      setEstado("listo");
    } catch {
      setEstado("error");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Boton type="button" variante="secundario" onClick={descargar} disabled={estado === "bajando"}>
        {estado === "bajando" ? "Preparando Excel…" : "Descargar Excel"}
      </Boton>
      {estado === "error" ? (
        <p className="text-sm text-state-error" role="alert">
          No se pudo descargar. Inténtalo de nuevo.
        </p>
      ) : null}
    </div>
  );
}

/** Tablero del administrador: indicadores, desgloses, público, comisión, liquidación y Excel. */
export function PanelTablero({ apiUrl, tablero }: PanelTableroProps) {
  const r = tablero.resumen;
  // Asistencia solo de los eventos ya realizados: los futuros aún no pueden tener QR validados.
  const realizados = tablero.eventos.filter((e) => Date.parse(e.inicio) < Date.parse(tablero.generado_en));
  const vendidasRealizados = realizados.reduce((t, e) => t + e.entradas, 0);
  const asistentesRealizados = realizados.reduce((t, e) => t + e.asistentes, 0);
  const asistencia = vendidasRealizados > 0 ? Math.round((asistentesRealizados / vendidasRealizados) * 100) : 0;
  const maximoCiudad = Math.max(0, ...tablero.publico_por_ciudad.map((p) => p.compradores));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-ink-secondary">Ventas pagadas, asistencia y liquidación de toda la plataforma.</p>
        <BotonExcel apiUrl={apiUrl} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Ventas" valor={soles(r.ventas_centimos)} detalle={`${r.eventos} eventos con ventas`} />
        <Indicador etiqueta="Comisión de la plataforma" valor={soles(r.comision_centimos)} />
        <Indicador etiqueta="Entradas vendidas" valor={String(r.entradas)} detalle={`${r.compradores} compradores`} />
        <Indicador etiqueta="Asistencia" valor={`${asistencia} %`} detalle={`${asistentesRealizados} de ${vendidasRealizados} en eventos ya realizados`} />
      </div>

      <FormularioComision key={`${tablero.comision.modelo}-${tablero.comision.valor}`} apiUrl={apiUrl} comision={tablero.comision} />

      <Tarjeta como="section" sinRelleno>
        <h2 className="p-4 pb-0 text-lg font-bold text-ink-primary">Liquidación por organizador</h2>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-ink-secondary">
              <tr>
                <th className="py-2 pr-3 font-medium">Organizador</th>
                <th className="py-2 pr-3 text-right font-medium">Eventos</th>
                <th className="py-2 pr-3 text-right font-medium">Entradas</th>
                <th className="py-2 pr-3 text-right font-medium">Ventas brutas</th>
                <th className="py-2 pr-3 text-right font-medium">Comisión</th>
                <th className="py-2 text-right font-medium">A pagar</th>
              </tr>
            </thead>
            <tbody>
              {tablero.liquidacion.map((l) => (
                <tr key={l.organizador_id} className="border-t border-border-hairline">
                  <td className="py-2 pr-3 text-ink-primary">{l.correo || l.organizador_id}</td>
                  <td className="py-2 pr-3 text-right">{l.eventos}</td>
                  <td className="py-2 pr-3 text-right">{l.entradas}</td>
                  <td className="py-2 pr-3 text-right">{soles(l.bruto_centimos)}</td>
                  <td className="py-2 pr-3 text-right">− {soles(l.comision_centimos)}</td>
                  <td className="py-2 text-right font-bold text-ink-primary">{soles(l.neto_centimos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tablero.liquidacion.length === 0 ? <p className="text-ink-secondary">Aún no hay ventas que liquidar.</p> : null}
        </div>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Barras
          titulo="Ventas por categoría"
          filas={tablero.por_categoria}
          etiqueta={(c) => etiquetaCategoria(c as CategoriaEvento)}
        />
        <Barras titulo="Ventas por distrito" filas={tablero.por_distrito} />
        <Barras titulo="Ventas por día" filas={tablero.por_dia} />
        <Tarjeta como="section">
          <h2 className="text-lg font-bold text-ink-primary">Perfil del público</h2>
          <p className="mt-1 text-sm text-ink-secondary">Compradores por ciudad declarada al registrarse.</p>
          <ul className="mt-3 space-y-3">
            {tablero.publico_por_ciudad.map((p) => (
              <li key={p.ciudad}>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-primary">{p.ciudad}</span>
                  <span className="text-ink-secondary">{p.compradores}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-border-hairline">
                  <div className="h-2 rounded-full bg-price-3" style={{ width: `${anchoBarra(p.compradores, maximoCiudad)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>

      <Tarjeta como="section" sinRelleno>
        <h2 className="p-4 pb-0 text-lg font-bold text-ink-primary">Eventos</h2>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-ink-secondary">
              <tr>
                <th className="py-2 pr-3 font-medium">Evento</th>
                <th className="py-2 pr-3 font-medium">Distrito</th>
                <th className="py-2 pr-3 text-right font-medium">Entradas / aforo</th>
                <th className="py-2 pr-3 text-right font-medium">Asistentes</th>
                <th className="py-2 text-right font-medium">Ventas</th>
              </tr>
            </thead>
            <tbody>
              {tablero.eventos.map((e) => (
                <tr key={e.evento_id} className="border-t border-border-hairline">
                  <td className="py-2 pr-3 text-ink-primary">{e.titulo}</td>
                  <td className="py-2 pr-3">{e.distrito}</td>
                  <td className="py-2 pr-3 text-right">
                    {e.entradas} / {e.aforo}
                  </td>
                  <td className="py-2 pr-3 text-right">{e.asistentes}</td>
                  <td className="py-2 text-right">{soles(e.importe_centimos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {r.entradas === 0 ? (
        <Aviso tipo="info" titulo="Sin ventas todavía">
          Cuando el público compre entradas, el tablero se llenará solo.
        </Aviso>
      ) : null}
    </div>
  );
}
