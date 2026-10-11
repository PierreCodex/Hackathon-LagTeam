"use client";

import { LIMITES_MAPA, MapaSedeSchema, type MapaSede } from "@reto18/shared";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { Aviso, Boton, BotonEnlace, Campo, Tarjeta } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import { clases } from "@/lib/clases";
import {
  agregarAsiento,
  agregarBloque,
  aMapaInicial,
  crearFila,
  crearSeccion,
  estadoDeErrorGuardado,
  estadoInicialPizarra,
  idCampoFilaNombre,
  idCampoSeccionNombre,
  numerosDeFila,
  quitarAsiento,
  quitarBloque,
  quitarFila,
  quitarSeccion,
  validarMapa,
  type EstadoBloque,
  type EstadoFila,
  type EstadoPizarra,
} from "@/lib/pizarra-mapa";
import { tokenDelNavegador } from "@/lib/supabase/navegador";

export type PizarraMapaProps = {
  /** "crear": pizarra vacía para una sede nueva. "editar": sede existente, con su mapa cargado. */
  modo: "crear" | "editar";
  /** Id de la sede que se edita (solo en modo "editar"). */
  sedeId?: string;
  /** Mapa ya leído de `GET .../mapa` (solo en modo "editar"). */
  mapaInicial?: MapaSede;
  /** Base de la API (`API_URL`). */
  apiUrl: string;
};

const MENSAJE_SIN_SESION = "Tu sesión se cerró. Recarga la página para ingresar de nuevo.";

function evitarEnvioEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") e.preventDefault();
}

/** Pizarra visual del mapa de la sede (historia 2.9): secciones → filas → bloques → asientos. */
export function PizarraMapa({ modo, sedeId, mapaInicial, apiUrl }: PizarraMapaProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<EstadoPizarra>(() => (mapaInicial ? aMapaInicial(mapaInicial) : estadoInicialPizarra()));
  const [modoActual, setModoActual] = useState(modo);
  const [sedeIdActual, setSedeIdActual] = useState(sedeId);

  const [errorLocal, setErrorLocal] = useState<{ campo: string | null; mensaje: string } | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<{ codigo: string; mensaje: string } | null>(null);
  const [sinSesion, setSinSesion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const [duplicarNombre, setDuplicarNombre] = useState("");
  const [duplicarError, setDuplicarError] = useState<string | null>(null);
  const [duplicarEnviando, setDuplicarEnviando] = useState(false);

  const foco = useRef<string | null>(null);

  useEffect(() => {
    const id = foco.current;
    if (!id) return;
    foco.current = null;
    document.getElementById(id)?.focus();
  });

  function limpiarErrores() {
    setErrorLocal(null);
    setErrorGuardar(null);
    setSinSesion(false);
    setGuardadoOk(false);
  }

  const decision = errorGuardar ? estadoDeErrorGuardado(errorGuardar, estado.secciones.length) : null;
  const camposConError: Partial<Record<string, string>> = {};
  let avisoGenerico: string | null = null;
  if (errorLocal) {
    if (errorLocal.campo) camposConError[errorLocal.campo] = errorLocal.mensaje;
    else avisoGenerico = errorLocal.mensaje;
  } else if (errorGuardar && decision) {
    if (decision.tipo === "campo") camposConError[decision.campo] = errorGuardar.mensaje;
    else if (decision.tipo === "generico" || decision.tipo === "reintentar") avisoGenerico = errorGuardar.mensaje;
  }

  async function guardar() {
    if (guardando) return;
    limpiarErrores();
    const validacion = validarMapa(estado);
    if (!validacion.ok) {
      setErrorLocal({ campo: validacion.campo, mensaje: validacion.mensaje });
      foco.current = validacion.campo;
      return;
    }

    setGuardando(true);
    const token = await tokenDelNavegador();
    if (!token) {
      setGuardando(false);
      setSinSesion(true);
      return;
    }

    const resultado =
      modoActual === "crear"
        ? await pedirApi("eventos/sedes", MapaSedeSchema, {
            apiUrl,
            metodo: "POST",
            cuerpo: validacion.datos,
            cabeceras: { Authorization: `Bearer ${token}` },
          })
        : await pedirApi(`eventos/sedes/${sedeIdActual}/mapa`, MapaSedeSchema, {
            apiUrl,
            metodo: "PUT",
            cuerpo: validacion.datos,
            cabeceras: { Authorization: `Bearer ${token}` },
          });
    setGuardando(false);

    if (resultado.ok) {
      setEstado(aMapaInicial(resultado.datos));
      setSedeIdActual(resultado.datos.id);
      setModoActual("editar");
      setGuardadoOk(true);
      return;
    }

    setErrorGuardar(resultado.error);
    const decidido = estadoDeErrorGuardado(resultado.error, estado.secciones.length);
    if (decidido.tipo === "campo") foco.current = decidido.campo;
  }

  function alGuardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void guardar();
  }

  async function alDuplicar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (duplicarEnviando) return;
    const nombre = duplicarNombre.trim();
    if (!nombre) {
      setDuplicarError("Escribe un nombre para la copia.");
      return;
    }
    setDuplicarEnviando(true);
    setDuplicarError(null);
    const token = await tokenDelNavegador();
    if (!token) {
      setDuplicarEnviando(false);
      setDuplicarError(MENSAJE_SIN_SESION);
      return;
    }
    const resultado = await pedirApi(`eventos/sedes/${sedeIdActual}/duplicar`, MapaSedeSchema, {
      apiUrl,
      metodo: "POST",
      cuerpo: { nombre },
      cabeceras: { Authorization: `Bearer ${token}` },
    });
    setDuplicarEnviando(false);
    if (!resultado.ok) {
      setDuplicarError(resultado.error.mensaje);
      return;
    }
    router.push(`/organizador/sedes/${resultado.datos.id}/mapa`);
  }

  function actualizarRaiz(campo: "nombre" | "direccion" | "distrito") {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const valor = e.target.value;
      setEstado((anterior) => ({ ...anterior, [campo]: valor }));
      limpiarErrores();
    };
  }

  function cambiarNombreSeccion(seccionId: string, valor: string) {
    setEstado((anterior) => ({
      ...anterior,
      secciones: anterior.secciones.map((s) => (s.id === seccionId ? { ...s, nombre: valor } : s)),
    }));
    limpiarErrores();
  }

  function cambiarNombreFila(seccionId: string, filaId: string, valor: string) {
    setEstado((anterior) => ({
      ...anterior,
      secciones: anterior.secciones.map((s) =>
        s.id === seccionId ? { ...s, filas: s.filas.map((f) => (f.id === filaId ? { ...f, nombre: valor } : f)) } : s,
      ),
    }));
    limpiarErrores();
  }

  const topeSecciones = estado.secciones.length + estado.zonasGenerales.length >= LIMITES_MAPA.secciones;

  return (
    <div className="flex flex-col gap-6">
      {sinSesion && (
        <Aviso
          tipo="error"
          titulo="Tu sesión se cerró."
          accion={
            <BotonEnlace href={pathname} variante="secundario" prefetch={false}>
              Reintentar
            </BotonEnlace>
          }
        >
          {MENSAJE_SIN_SESION}
        </Aviso>
      )}

      {guardadoOk && !errorGuardar && !errorLocal && (
        <Aviso tipo="exito" titulo="El mapa se guardó.">
          {modoActual === "editar" ? "Los cambios ya están guardados." : "La sede quedó creada con este mapa."}
        </Aviso>
      )}

      {avisoGenerico && (
        <Aviso
          tipo="error"
          titulo="No pudimos guardar el mapa."
          accion={
            decision?.tipo === "reintentar" ? (
              <Boton variante="secundario" onClick={() => void guardar()} disabled={guardando}>
                Reintentar
              </Boton>
            ) : undefined
          }
        >
          {avisoGenerico}
        </Aviso>
      )}

      {decision?.tipo === "duplicar" && sedeIdActual && (
        <Aviso tipo="advertencia" titulo="No puedes editar este mapa.">
          <div className="flex flex-col gap-3">
            <p>{errorGuardar?.mensaje}</p>
            <form onSubmit={alDuplicar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Campo
                id="nombre-copia"
                etiqueta="Nombre de la copia"
                maxLength={150}
                value={duplicarNombre}
                onChange={(e) => {
                  setDuplicarNombre(e.target.value);
                  setDuplicarError(null);
                }}
                error={duplicarError ?? undefined}
                className="sm:flex-1"
              />
              <Boton type="submit" variante="secundario" disabled={duplicarEnviando}>
                {duplicarEnviando ? "Duplicando…" : "Duplicar esta sede"}
              </Boton>
            </form>
          </div>
        </Aviso>
      )}

      {estado.zonasGenerales.length > 0 && (
        <Aviso tipo="info" titulo="Esta sede también tiene zonas generales.">
          {estado.zonasGenerales.map((z) => z.nombre).join(", ")}; se conservan al guardar.
        </Aviso>
      )}

      <form onSubmit={alGuardar} className="flex flex-col gap-6">
        <Tarjeta como="section" aria-labelledby="titulo-datos-sede" className="flex flex-col gap-4">
          <h2 id="titulo-datos-sede" className="text-title">
            Datos de la sede
          </h2>
          <Campo
            id="nombre"
            etiqueta="Nombre de la sede"
            maxLength={150}
            value={estado.nombre}
            onChange={actualizarRaiz("nombre")}
            onKeyDown={evitarEnvioEnter}
            error={camposConError.nombre}
          />
          <Campo
            id="direccion"
            etiqueta="Dirección"
            maxLength={200}
            autoComplete="street-address"
            value={estado.direccion}
            onChange={actualizarRaiz("direccion")}
            onKeyDown={evitarEnvioEnter}
            error={camposConError.direccion}
          />
          <Campo
            id="distrito"
            etiqueta="Distrito"
            maxLength={100}
            value={estado.distrito}
            onChange={actualizarRaiz("distrito")}
            onKeyDown={evitarEnvioEnter}
            error={camposConError.distrito}
          />
        </Tarjeta>

        <div className="flex flex-col gap-4">
          {estado.secciones.map((seccion, i) => (
            <Tarjeta key={seccion.id} como="section" aria-labelledby={`titulo-seccion-${i}`} className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h3 id={`titulo-seccion-${i}`} className="sr-only">
                  Sección {i + 1}
                </h3>
                <Campo
                  id={idCampoSeccionNombre(i)}
                  etiqueta={`Nombre de la sección ${i + 1}`}
                  maxLength={60}
                  value={seccion.nombre}
                  onChange={(e) => cambiarNombreSeccion(seccion.id, e.target.value)}
                  onKeyDown={evitarEnvioEnter}
                  error={camposConError[idCampoSeccionNombre(i)]}
                  className="flex-1"
                />
                <Boton
                  variante="secundario"
                  onClick={() => {
                    setEstado((a) => quitarSeccion(a, seccion.id));
                    limpiarErrores();
                  }}
                >
                  Quitar sección
                </Boton>
              </div>

              <div className="flex flex-col gap-3">
                {seccion.filas.map((fila, j) => (
                  <FilaPizarra
                    key={fila.id}
                    fila={fila}
                    i={i}
                    j={j}
                    camposConError={camposConError}
                    puedeQuitarFila={seccion.filas.length > 1}
                    onCambiarNombre={(valor) => cambiarNombreFila(seccion.id, fila.id, valor)}
                    onQuitarFila={() => {
                      setEstado((a) => quitarFila(a, seccion.id, fila.id));
                      limpiarErrores();
                    }}
                    onAgregarBloque={() => {
                      setEstado((a) => agregarBloque(a, seccion.id, fila.id));
                      limpiarErrores();
                    }}
                    onQuitarBloque={(bloqueId) => {
                      setEstado((a) => quitarBloque(a, seccion.id, fila.id, bloqueId));
                      limpiarErrores();
                    }}
                    onAgregarAsiento={(bloqueId) => {
                      setEstado((a) => agregarAsiento(a, seccion.id, fila.id, bloqueId));
                      limpiarErrores();
                    }}
                    onQuitarAsiento={(bloqueId, asientoId) => {
                      setEstado((a) => quitarAsiento(a, seccion.id, fila.id, bloqueId, asientoId));
                      limpiarErrores();
                    }}
                  />
                ))}
              </div>

              <Boton
                variante="secundario"
                disabled={seccion.filas.length >= LIMITES_MAPA.filasPorSeccion}
                onClick={() => {
                  setEstado((a) => crearFila(a, seccion.id));
                  limpiarErrores();
                }}
              >
                Agregar fila
              </Boton>
            </Tarjeta>
          ))}
        </div>

        <Boton
          variante="secundario"
          disabled={topeSecciones}
          onClick={() => {
            setEstado((a) => crearSeccion(a));
            limpiarErrores();
          }}
        >
          Agregar sección
        </Boton>

        <Boton type="submit" disabled={guardando} anchoCompleto className="sm:w-auto">
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>
      </form>
    </div>
  );
}

function FilaPizarra({
  fila,
  i,
  j,
  camposConError,
  puedeQuitarFila,
  onCambiarNombre,
  onQuitarFila,
  onAgregarBloque,
  onQuitarBloque,
  onAgregarAsiento,
  onQuitarAsiento,
}: {
  fila: EstadoFila;
  i: number;
  j: number;
  camposConError: Partial<Record<string, string>>;
  puedeQuitarFila: boolean;
  onCambiarNombre: (valor: string) => void;
  onQuitarFila: () => void;
  onAgregarBloque: () => void;
  onQuitarBloque: (bloqueId: string) => void;
  onAgregarAsiento: (bloqueId: string) => void;
  onQuitarAsiento: (bloqueId: string, asientoId: string) => void;
}) {
  const numeros = numerosDeFila(fila);
  const idCampo = idCampoFilaNombre(i, j);
  const totalAsientos = fila.bloques.reduce((suma, b) => suma + b.asientos.length, 0);

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-border-hairline p-3">
      <div className="flex items-center justify-between gap-3">
        <Campo
          id={idCampo}
          etiqueta={`Nombre de la fila ${j + 1}`}
          maxLength={20}
          value={fila.nombre}
          onChange={(e) => onCambiarNombre(e.target.value)}
          onKeyDown={evitarEnvioEnter}
          error={camposConError[idCampo]}
          className="max-w-xs flex-1"
        />
        {puedeQuitarFila && (
          <Boton variante="secundario" onClick={onQuitarFila}>
            Quitar fila
          </Boton>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {fila.bloques.map((bloque: EstadoBloque, k) => (
          <div key={bloque.id} className="flex flex-col gap-2 rounded-sm border border-border-hairline p-2">
            <div className="flex flex-wrap gap-1">
              {bloque.asientos.map((asiento, a) => (
                <button
                  key={asiento.id}
                  type="button"
                  aria-label={`Quitar asiento ${numeros[k]?.[a]}`}
                  disabled={bloque.asientos.length <= 1}
                  onClick={() => onQuitarAsiento(bloque.id, asiento.id)}
                  className={clases(
                    "flex size-8 shrink-0 items-center justify-center rounded-sm border border-ink-muted bg-seat-held text-meta text-ink-on-inverse",
                    bloque.asientos.length <= 1 ? "cursor-not-allowed opacity-70" : "hover:border-ink-primary",
                  )}
                >
                  {numeros[k]?.[a]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Boton
                variante="secundario"
                disabled={totalAsientos >= LIMITES_MAPA.asientosPorFila}
                onClick={() => onAgregarAsiento(bloque.id)}
              >
                + asiento
              </Boton>
              {fila.bloques.length > 1 && (
                <Boton variante="secundario" onClick={() => onQuitarBloque(bloque.id)}>
                  Quitar pasillo
                </Boton>
              )}
            </div>
          </div>
        ))}
        <Boton
          variante="secundario"
          disabled={fila.bloques.length >= LIMITES_MAPA.asientosPorFila}
          onClick={onAgregarBloque}
        >
          + pasillo
        </Boton>
      </div>
    </div>
  );
}
