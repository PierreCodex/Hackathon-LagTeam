"use client";

import { LIMITES_MAPA, MapaSedeSchema, type MapaSede } from "@reto18/shared";
import { usePathname, useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";
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

/** Lado de una butaca en px, por paso del control de tamaño: el último cumple el mínimo táctil de 48 px. */
const TAMANOS_BUTACA = [28, 36, 48] as const;

const MENSAJE_SIN_SESION = "Tu sesión se cerró. Recarga la página para ingresar de nuevo.";

function evitarEnvioEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") e.preventDefault();
}

/**
 * Pizarra visual del mapa de la sede (historia 2.9): un lienzo oscuro con forma de sala (escenario arriba,
 * secciones en tarjetas, filas centradas) donde se edita sobre el mapa: tocar una butaca la quita, "+" al
 * final de cada bloque añade una y el hueco entre bloques es el pasillo.
 */
export function PizarraMapa({ modo, sedeId, mapaInicial, apiUrl }: PizarraMapaProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<EstadoPizarra>(() => (mapaInicial ? aMapaInicial(mapaInicial) : estadoInicialPizarra()));
  const [modoActual, setModoActual] = useState(modo);
  const [paso, setPaso] = useState(0);
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
  const lienzo = useRef<HTMLDivElement>(null);

  // El lienzo abre centrado (escenario y pasillo central a la vista) y se vuelve a centrar al cambiar el tamaño.
  useEffect(() => {
    const el = lienzo.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [paso]);

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

  const totalButacas = estado.secciones.reduce(
    (suma, s) => suma + s.filas.reduce((sf, f) => sf + f.bloques.reduce((sb, b) => sb + b.asientos.length, 0), 0),
    0,
  );
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

        <section
          aria-label="Pizarra del mapa"
          className="superficie-inversa flex flex-col overflow-hidden rounded-md bg-surface-inverse text-ink-on-inverse"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-inverse px-4 py-3">
            <p className="text-meta text-ink-on-inverse-secondary">
              <span className="text-body text-ink-on-inverse">{totalButacas}</span> {totalButacas === 1 ? "butaca" : "butacas"}
              {" · "}
              Toca una butaca para quitarla
            </p>
            <div className="flex items-center gap-2" role="group" aria-label="Tamaño de las butacas">
              <BotonLienzo
                aria-label="Butacas más pequeñas"
                disabled={paso === 0}
                onClick={() => setPaso((p) => Math.max(0, p - 1))}
              >
                −
              </BotonLienzo>
              <BotonLienzo
                aria-label="Butacas más grandes"
                disabled={paso === TAMANOS_BUTACA.length - 1}
                onClick={() => setPaso((p) => Math.min(TAMANOS_BUTACA.length - 1, p + 1))}
              >
                +
              </BotonLienzo>
            </div>
          </div>

          <div ref={lienzo} className="overflow-x-auto">
            <div
              className="flex min-w-max flex-col items-center gap-6 px-4 py-6"
              style={{ "--butaca": `${TAMANOS_BUTACA[paso]}px` } as CSSProperties}
            >
              <p className="w-full border-y border-border-inverse py-2 text-center text-meta tracking-[0.4em] text-ink-on-inverse-secondary">
                ESCENARIO
              </p>

              {estado.secciones.map((seccion, i) => (
                <div
                  key={seccion.id}
                  role="group"
                  aria-labelledby={idCampoSeccionNombre(i)}
                  className="flex w-full flex-col items-center gap-2 rounded-md border border-border-inverse bg-surface-inverse-raised px-4 py-4"
                >
                  <div className="flex w-full items-start justify-center gap-2">
                    <NombreEnLienzo
                      id={idCampoSeccionNombre(i)}
                      etiqueta={`Nombre de la sección ${i + 1}`}
                      placeholder="Nombre de la sección"
                      maxLength={60}
                      value={seccion.nombre}
                      onChange={(valor) => cambiarNombreSeccion(seccion.id, valor)}
                      error={camposConError[idCampoSeccionNombre(i)]}
                      className="w-64 text-center text-body"
                    />
                    <BotonLienzo
                      aria-label={`Quitar sección ${seccion.nombre || i + 1}`}
                      title="Quitar sección"
                      onClick={() => {
                        setEstado((a) => quitarSeccion(a, seccion.id));
                        limpiarErrores();
                      }}
                    >
                      ✕
                    </BotonLienzo>
                  </div>

                  <div className="flex flex-col items-center gap-1">
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

                  <BotonLienzo
                    punteado
                    className="mt-2 px-4"
                    disabled={seccion.filas.length >= LIMITES_MAPA.filasPorSeccion}
                    onClick={() => {
                      setEstado((a) => crearFila(a, seccion.id));
                      limpiarErrores();
                    }}
                  >
                    + Agregar fila
                  </BotonLienzo>
                </div>
              ))}

              <Boton
                variante="inverso"
                disabled={topeSecciones}
                onClick={() => {
                  setEstado((a) => crearSeccion(a));
                  limpiarErrores();
                }}
              >
                + Agregar sección
              </Boton>
            </div>
          </div>
        </section>

        <Boton type="submit" disabled={guardando} anchoCompleto className="sm:w-auto">
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>
      </form>
    </div>
  );
}

/** Botón compacto del lienzo oscuro (tamaño de butaca, quitar, agregar fila). */
function BotonLienzo({
  punteado,
  className,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { punteado?: boolean }) {
  return (
    <button
      type="button"
      className={clases(
        "inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-sm border text-meta",
        punteado ? "border-dashed border-ink-on-inverse-secondary" : "border-border-inverse",
        "text-ink-on-inverse-secondary hover:border-ink-on-inverse hover:text-ink-on-inverse",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-inverse",
        className,
      )}
      {...resto}
    />
  );
}

/** Nombre editable dentro del lienzo (sección o fila), con su error debajo y el mismo id que señala la API. */
function NombreEnLienzo({
  id,
  etiqueta,
  placeholder,
  maxLength,
  value,
  onChange,
  error,
  className,
  errorFlotante,
}: {
  id: string;
  etiqueta: string;
  placeholder: string;
  maxLength: number;
  value: string;
  onChange: (valor: string) => void;
  error?: string;
  className?: string;
  /** El error flota bajo el campo, sin mover la fila (nombres de fila). */
  errorFlotante?: boolean;
}) {
  const idError = error ? `${id}-error` : undefined;
  return (
    <div className="relative flex flex-col items-center gap-1">
      <input
        id={id}
        aria-label={etiqueta}
        aria-invalid={error ? true : undefined}
        aria-describedby={idError}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={evitarEnvioEnter}
        className={clases(
          "h-8 rounded-sm border bg-transparent px-1 text-ink-on-inverse placeholder:text-ink-muted",
          "hover:border-border-inverse focus:border-ink-on-inverse",
          error ? "border-accent" : "border-transparent",
          className,
        )}
      />
      {error && (
        <p
          id={idError}
          className={clases(
            "text-meta text-ink-on-inverse",
            errorFlotante
              ? "absolute top-full left-0 z-10 mt-1 w-56 rounded-sm border border-border-inverse bg-surface-inverse p-2"
              : "max-w-64 text-center",
          )}
        >
          <span aria-hidden="true" className="text-accent">
            ✕{" "}
          </span>
          {error}
        </p>
      )}
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
  const nombre = fila.nombre || String(j + 1);

  return (
    <div className="group flex items-start gap-2">
      <NombreEnLienzo
        id={idCampo}
        etiqueta={`Nombre de la fila ${j + 1}`}
        placeholder="Fila"
        maxLength={20}
        value={fila.nombre}
        onChange={onCambiarNombre}
        error={camposConError[idCampo]}
        errorFlotante
        className="w-10 text-center text-meta"
      />

      <div className="flex items-center">
        {fila.bloques.map((bloque: EstadoBloque, k) => (
          <Fragment key={bloque.id}>
            {k > 0 && (
              <button
                type="button"
                aria-label={`Quitar pasillo ${k} de la fila ${nombre}`}
                title="Quitar pasillo (y sus butacas de la derecha)"
                onClick={() => onQuitarBloque(bloque.id)}
                className="mx-1 flex h-(--butaca) w-[calc(var(--butaca)*0.75)] items-center justify-center rounded-sm hover:bg-surface-inverse"
              >
                <span aria-hidden="true" className="h-full w-px bg-border-inverse" />
              </button>
            )}
            <div className="flex items-center gap-0.5">
              {bloque.asientos.map((asiento, a) => {
                const unico = bloque.asientos.length <= 1;
                return (
                  <button
                    key={asiento.id}
                    type="button"
                    aria-label={`Quitar asiento ${numeros[k]?.[a]} de la fila ${nombre}`}
                    disabled={unico}
                    onClick={() => onQuitarAsiento(bloque.id, asiento.id)}
                    className={clases(
                      "flex size-(--butaca) shrink-0 items-center justify-center rounded-sm bg-seat-held",
                      "text-[calc(var(--butaca)*0.4)] leading-none text-ink-on-inverse",
                      unico ? "cursor-not-allowed opacity-70" : "hover:bg-state-error",
                    )}
                  >
                    {numeros[k]?.[a]}
                  </button>
                );
              })}
              <button
                type="button"
                aria-label={`Añadir asiento al bloque ${k + 1} de la fila ${nombre}`}
                disabled={totalAsientos >= LIMITES_MAPA.asientosPorFila}
                onClick={() => onAgregarAsiento(bloque.id)}
                className={clases(
                  "ml-0.5 flex h-(--butaca) w-[calc(var(--butaca)*0.6)] shrink-0 items-center justify-center rounded-sm border border-dashed border-ink-on-inverse-secondary",
                  "text-[calc(var(--butaca)*0.5)] leading-none text-ink-on-inverse-secondary",
                  "hover:border-ink-on-inverse hover:text-ink-on-inverse disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                +
              </button>
            </div>
          </Fragment>
        ))}
      </div>

      <div className="flex items-center gap-1 opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
        <BotonLienzo
          className="gap-1 px-2"
          aria-label={`Añadir pasillo a la fila ${nombre}`}
          title="Añadir pasillo"
          disabled={fila.bloques.length >= LIMITES_MAPA.asientosPorFila}
          onClick={onAgregarBloque}
        >
          <span aria-hidden="true">+</span>
          <span aria-hidden="true" className="h-4 w-px bg-current" />
        </BotonLienzo>
        {puedeQuitarFila && (
          <BotonLienzo aria-label={`Quitar fila ${nombre}`} title="Quitar fila" onClick={onQuitarFila}>
            ✕
          </BotonLienzo>
        )}
      </div>
    </div>
  );
}
