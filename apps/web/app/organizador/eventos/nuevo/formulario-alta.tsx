"use client";

import {
  CategoriaEventoSchema,
  EventoCreadoSchema,
  TIPOS_CONSTANCIA_EVENTO,
  TIPOS_FOTO_EVENTO,
  type ErrorApi,
  type SedeResumen,
} from "@reto18/shared";
import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from "react";
import { BuscadorLugar } from "@/components/sede/buscador-lugar";
import {
  AreaTexto,
  Aviso,
  Boton,
  BotonEnlace,
  Campo,
  CampoArchivo,
  Esqueleto,
  EsqueletoGrupo,
  Selector,
  Tarjeta,
} from "@/components/ui";
import {
  capacidadSede,
  CLAVE_BORRADOR_ALTA,
  envioIncierto,
  MENSAJE_ENVIO_INCIERTO,
  ETIQUETA_CATEGORIA,
  idCategoriaNombre,
  idCategoriaPrecio,
  leerBorrador,
  MAXIMO_CATEGORIAS,
  MENSAJE_FALTA_CONSTANCIA,
  PASOS_ALTA,
  pasoDeErrorApi,
  primerCampoConError,
  serializarBorrador,
  TITULO_PASO,
  validarAlta,
  validarArchivo,
  validarPaso,
  type EstadoAlta,
  type ErroresAlta,
  type PasoAlta,
} from "@/lib/alta-evento";
import { CODIGO_SIN_CONEXION, pedirApi } from "@/lib/api";
import { clases } from "@/lib/clases";
import { rutaMarketingEvento } from "@/lib/pieza";
import { rutaIngresar } from "@/lib/sesion";
import { tokenDelNavegador } from "@/lib/supabase/navegador";

/** Estado del formulario con los archivos reales del navegador. */
type EstadoFormulario = Omit<EstadoAlta, "foto" | "constancia"> & { foto: File | null; constancia: File | null };

export type FormularioAltaProps = {
  /** Base de la API (`API_URL`): el navegador envía el alta directo, con el token de la sesión. */
  apiUrl: string;
  sedes: SedeResumen[];
  /** Error al cargar las sedes (p. ej. `SIN_CONEXION`): se muestra con "Reintentar". */
  errorSedes?: ErrorApi;
  rutaActual: string;
  /** Id de la cuenta: el borrador es de cada organizador, no del navegador. */
  idUsuario: string;
};

/** Tiempo límite del envío: sube la foto y la constancia (hasta 10 MB). */
const TIEMPO_LIMITE_ENVIO_MS = 60_000;

const OPCIONES_CATEGORIA = CategoriaEventoSchema.options.map((valor) => ({
  valor,
  etiqueta: ETIQUETA_CATEGORIA[valor],
}));

/** Elemento que recibe el foco para cada campo con error (los grupos de opciones, su primera opción). */
const ID_FOCO: Record<string, string> = {
  "tipo-sede": "tipo-sede-existente",
  "hay-musica": "hay-musica-si",
  categorias: "agregar-categoria",
};

const ID_TITULO_PASO = "titulo-paso";
const ID_TITULO_PENDIENTE = "titulo-pendiente";

const sinSuscripcion = () => () => {};

function leerAlmacen(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribirAlmacen(clave: string, valor: string | null) {
  try {
    if (valor === null) window.localStorage.removeItem(clave);
    else window.localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (ventana privada, bloqueado): el formulario funciona igual, sin borrador.
  }
}

/**
 * Alta de evento (1.9, Flow 1). Se pinta solo en el navegador, porque arranca del borrador de
 * `localStorage`; en el servidor se ve el esqueleto.
 */
export function FormularioAlta(props: FormularioAltaProps) {
  const enNavegador = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  if (!enNavegador) {
    return (
      <EsqueletoGrupo etiqueta="Cargando el formulario…">
        <Esqueleto className="h-4 w-1/3" />
        <Esqueleto className="h-2 w-full" />
        <Esqueleto className="h-12 w-full" />
        <Esqueleto className="h-12 w-full" />
        <Esqueleto className="h-12 w-full" />
      </EsqueletoGrupo>
    );
  }
  return <FormularioPasos {...props} />;
}

function GrupoOpciones({
  id,
  leyenda,
  opciones,
  valor,
  alCambiar,
  error,
}: {
  id: string;
  leyenda: string;
  opciones: { valor: string; etiqueta: string }[];
  valor: string | null;
  alCambiar: (valor: string) => void;
  error?: string;
}) {
  const idError = error ? `${id}-error` : undefined;
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={idError}>
      <legend className="mb-2 text-meta text-ink-primary">{leyenda}</legend>
      {opciones.map((opcion) => (
        <label
          key={opcion.valor}
          htmlFor={`${id}-${opcion.valor}`}
          className={clases(
            "flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border bg-surface-raised px-3",
            valor === opcion.valor ? "border-ink-primary" : "border-ink-muted",
          )}
        >
          <input
            id={`${id}-${opcion.valor}`}
            type="radio"
            name={id}
            value={opcion.valor}
            checked={valor === opcion.valor}
            onChange={() => alCambiar(opcion.valor)}
            aria-invalid={error ? true : undefined}
            aria-describedby={idError}
            className="size-5 shrink-0 accent-accent"
          />
          <span>{opcion.etiqueta}</span>
        </label>
      ))}
      {error && (
        <p id={idError} className="flex items-start gap-2 text-meta text-state-error">
          <span aria-hidden="true">✕</span>
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}

function FormularioPasos({ apiUrl, sedes, errorSedes, rutaActual, idUsuario }: FormularioAltaProps) {
  const claveBorrador = `${CLAVE_BORRADOR_ALTA}:${idUsuario}`;
  const [inicial] = useState(() => leerBorrador(leerAlmacen(claveBorrador)));
  const [estado, setEstado] = useState<EstadoFormulario>(() => ({
    ...inicial.estado,
    foto: null,
    constancia: null,
  }));
  const [paso, setPaso] = useState<PasoAlta>(inicial.paso);
  const [errores, setErrores] = useState<ErroresAlta>({});
  const [errorApi, setErrorApi] = useState<ErrorApi | null>(null);
  /** El último envío se cortó por tiempo: quizá el evento sí se creó, así que no se ofrece "Reintentar". */
  const [incierto, setIncierto] = useState(false);
  const [sinSesion, setSinSesion] = useState(false);
  const [enviando, setEnviando] = useState(false);
  /** Id del evento creado: la pantalla de pendiente enlaza a su Marketing. */
  const [creado, setCreado] = useState<string | null>(null);
  /** Id del elemento que recibe el foco tras el siguiente pintado. */
  const foco = useRef<string | null>(null);

  const indice = PASOS_ALTA.indexOf(paso);
  const esUltimo = indice === PASOS_ALTA.length - 1;
  const contexto = { sedes };

  // Borrador de los campos de texto en cada cambio (los archivos no). Se borra al enviar bien.
  useEffect(() => {
    if (!creado) escribirAlmacen(claveBorrador, serializarBorrador(estado, paso));
  }, [estado, paso, creado, claveBorrador]);

  // Foco al título del paso al cambiar de paso, o al primer campo con error.
  useEffect(() => {
    const id = foco.current;
    if (!id) return;
    foco.current = null;
    document.getElementById(id)?.focus();
  });

  function cambiar<K extends keyof EstadoFormulario>(campo: K, valor: EstadoFormulario[K]) {
    setEstado((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function quitarError(...campos: string[]) {
    setErrores((anterior) => {
      if (!campos.some((c) => anterior[c])) return anterior;
      const copia = { ...anterior };
      for (const c of campos) delete copia[c];
      return copia;
    });
  }

  function texto(campo: keyof EstadoFormulario & string, idCampo: string = campo) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      cambiar(campo, e.target.value as never);
      quitarError(idCampo);
    };
  }

  function irA(nuevo: PasoAlta, erroresPaso: ErroresAlta = {}) {
    setPaso(nuevo);
    setErrores(erroresPaso);
    const primero = primerCampoConError(nuevo, estado, erroresPaso);
    foco.current = primero ? (ID_FOCO[primero] ?? primero) : ID_TITULO_PASO;
  }

  function alElegirArchivo(campo: "foto" | "constancia", tipos: readonly string[]) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const archivo = e.target.files?.[0] ?? null;
      cambiar(campo, archivo);
      const error = archivo ? validarArchivo(archivo, tipos) : null;
      setErrores((anterior) => {
        const copia = { ...anterior };
        if (error) copia[campo] = error;
        else delete copia[campo];
        return copia;
      });
    };
  }

  function siguiente() {
    const erroresPaso = validarPaso(paso, estado, contexto);
    if (Object.keys(erroresPaso).length > 0) {
      irA(paso, erroresPaso);
      return;
    }
    // Al avanzar con el paso corregido, el aviso del último envío ya no aplica.
    setErrorApi(null);
    irA(PASOS_ALTA[indice + 1]!);
  }

  async function enviar() {
    const validacion = validarAlta(estado, contexto);
    if (!validacion.ok) {
      irA(validacion.paso, validacion.errores);
      return;
    }
    if (!estado.foto) return;
    setEnviando(true);
    setErrorApi(null);
    setIncierto(false);
    setSinSesion(false);

    const token = await tokenDelNavegador();
    if (!token) {
      setEnviando(false);
      setSinSesion(true);
      return;
    }

    const formulario = new FormData();
    formulario.append("datos", JSON.stringify(validacion.datos));
    formulario.append("foto", estado.foto, estado.foto.name);
    if (validacion.datos.hay_musica && estado.constancia) {
      formulario.append("constancia", estado.constancia, estado.constancia.name);
    }

    const inicioEnvio = Date.now();
    const resultado = await pedirApi("eventos", EventoCreadoSchema, {
      apiUrl,
      formulario,
      cabeceras: { Authorization: `Bearer ${token}` },
      tiempoLimiteMs: TIEMPO_LIMITE_ENVIO_MS,
    });
    setEnviando(false);

    if (resultado.ok) {
      escribirAlmacen(claveBorrador, null);
      setCreado(resultado.datos.evento.id);
      foco.current = ID_TITULO_PENDIENTE;
      return;
    }
    // Lo escrito se conserva; si el error es de un paso, se vuelve a él.
    setErrorApi(resultado.error);
    setIncierto(envioIncierto(resultado.error, Date.now() - inicioEnvio, TIEMPO_LIMITE_ENVIO_MS));
    const vuelta = pasoDeErrorApi(resultado.error);
    if (vuelta && vuelta !== paso) irA(vuelta);
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    if (esUltimo) void enviar();
    else siguiente();
  }

  if (creado) {
    return (
      <Tarjeta como="section" aria-labelledby={ID_TITULO_PENDIENTE} className="flex flex-col gap-4">
        <h2 id={ID_TITULO_PENDIENTE} tabIndex={-1} className="text-title outline-none">
          Tu evento está pendiente de aprobación
        </h2>
        <p className="text-ink-secondary">El Club lo revisará y te avisaremos cuando esté publicado.</p>
        <p className="font-bold">Mientras tanto, prepara tu campaña</p>
        <BotonEnlace href={rutaMarketingEvento(creado)} anchoCompleto>
          Marketing
        </BotonEnlace>
      </Tarjeta>
    );
  }

  const capacidad = capacidadSede(estado, sedes);
  const faltaConstancia = estado.hayMusica === true && !estado.constancia;
  const errorConstancia = errores.constancia ?? (faltaConstancia ? MENSAJE_FALTA_CONSTANCIA : undefined);
  const largoDescripcion = estado.descripcion.trim().length;

  return (
    <form noValidate onSubmit={alEnviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-meta text-ink-secondary">
          Paso {indice + 1} de {PASOS_ALTA.length}
        </p>
        <div
          role="progressbar"
          aria-label="Avance del formulario"
          aria-valuemin={1}
          aria-valuemax={PASOS_ALTA.length}
          aria-valuenow={indice + 1}
          aria-valuetext={`Paso ${indice + 1} de ${PASOS_ALTA.length}: ${TITULO_PASO[paso]}`}
          className="h-2 w-full overflow-hidden rounded-full bg-border-hairline"
        >
          <div className="h-full bg-accent" style={{ width: `${((indice + 1) / PASOS_ALTA.length) * 100}%` }} />
        </div>
        <h2 id={ID_TITULO_PASO} tabIndex={-1} className="text-title outline-none">
          {TITULO_PASO[paso]}
        </h2>
      </div>

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
          Ingresa de nuevo para enviar tu evento. Lo que escribiste se conserva, salvo los archivos.
        </Aviso>
      )}

      {errorApi && (
        <Aviso
          tipo="error"
          titulo="No pudimos enviar tu evento."
          accion={
            errorApi.codigo === CODIGO_SIN_CONEXION && !incierto ? (
              <Boton variante="secundario" onClick={() => void enviar()} disabled={enviando}>
                Reintentar
              </Boton>
            ) : undefined
          }
        >
          {incierto ? MENSAJE_ENVIO_INCIERTO : errorApi.mensaje}
        </Aviso>
      )}

      {/* Todos los pasos quedan montados (los archivos elegidos no se pierden); solo se ve el actual. */}
      <div hidden={paso !== "datos"} className="flex flex-col gap-4">
        <Campo
          id="titulo"
          etiqueta="Título"
          maxLength={150}
          value={estado.titulo}
          onChange={texto("titulo")}
          error={errores.titulo}
        />
        <Selector
          id="categoria"
          etiqueta="Tipo de evento"
          textoVacio="Elige una opción"
          opciones={OPCIONES_CATEGORIA}
          value={estado.categoria}
          onChange={texto("categoria")}
          error={errores.categoria}
        />
        <Campo
          id="fecha"
          etiqueta="Fecha y hora de inicio"
          type="datetime-local"
          ayuda="Hora de Lima."
          value={estado.fecha}
          onChange={texto("fecha")}
          error={errores.fecha}
        />
        <CampoArchivo
          id="foto"
          etiqueta="Foto del evento"
          accept={TIPOS_FOTO_EVENTO.join(",")}
          ayuda="JPG, PNG o WebP, hasta 5 MB."
          nombreArchivo={estado.foto?.name}
          onChange={alElegirArchivo("foto", TIPOS_FOTO_EVENTO)}
          error={errores.foto}
        />
      </div>

      <div hidden={paso !== "sede"} className="flex flex-col gap-4">
        <GrupoOpciones
          id="tipo-sede"
          leyenda="¿Dónde será?"
          opciones={[
            { valor: "existente", etiqueta: "En una sede de la lista" },
            { valor: "nueva", etiqueta: "En una sede nueva (zona general)" },
          ]}
          valor={estado.tipoSede}
          alCambiar={(valor) => {
            cambiar("tipoSede", valor as EstadoAlta["tipoSede"]);
            setErrores({});
          }}
          error={errores["tipo-sede"]}
        />
        {estado.tipoSede === "existente" ? (
          <>
            {errorSedes ? (
              <Aviso
                tipo="error"
                titulo="No pudimos cargar las sedes."
                accion={
                  <BotonEnlace href={rutaActual} variante="secundario" prefetch={false}>
                    Reintentar
                  </BotonEnlace>
                }
              >
                {errorSedes.mensaje} Lo que escribiste se conserva, salvo los archivos. También puedes crear una sede
                nueva.
              </Aviso>
            ) : sedes.length === 0 ? (
              <Aviso tipo="info" titulo="Aún no hay sedes.">
                Crea una sede nueva de zona general.
              </Aviso>
            ) : null}
            <Selector
              id="sede"
              etiqueta="Sede"
              textoVacio="Elige una sede"
              opciones={sedes.map((s) => ({
                valor: s.id,
                etiqueta: `${s.nombre} · ${s.distrito} (${s.capacidad} personas)`,
              }))}
              value={estado.sedeId}
              onChange={(e) => {
                cambiar("sedeId", e.target.value);
                quitarError("sede", "aforo");
              }}
              error={errores.sede}
            />
          </>
        ) : (
          <>
            <BuscadorLugar
              clave={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
              nombreActual={estado.sedeNombre}
              alElegir={(lugar) => {
                setEstado((anterior) => ({
                  ...anterior,
                  sedeNombre: lugar.nombre,
                  sedeDireccion: lugar.direccion || anterior.sedeDireccion,
                  sedeDistrito: lugar.distrito || anterior.sedeDistrito,
                }));
                quitarError("sede-nombre", "sede-direccion", "sede-distrito");
              }}
            />
            <Campo
              id="sede-nombre"
              etiqueta="Nombre de la sede"
              maxLength={150}
              value={estado.sedeNombre}
              onChange={texto("sedeNombre", "sede-nombre")}
              error={errores["sede-nombre"]}
            />
            <Campo
              id="sede-direccion"
              etiqueta="Dirección"
              maxLength={200}
              autoComplete="street-address"
              value={estado.sedeDireccion}
              onChange={texto("sedeDireccion", "sede-direccion")}
              error={errores["sede-direccion"]}
            />
            <Campo
              id="sede-distrito"
              etiqueta="Distrito"
              maxLength={100}
              ayuda="El evento aparecerá en este distrito."
              value={estado.sedeDistrito}
              onChange={texto("sedeDistrito", "sede-distrito")}
              error={errores["sede-distrito"]}
            />
            <Campo
              id="sede-capacidad"
              etiqueta="Capacidad de la sede"
              inputMode="numeric"
              ayuda="Cuántas personas caben."
              value={estado.sedeCapacidad}
              onChange={(e) => {
                cambiar("sedeCapacidad", e.target.value);
                quitarError("sede-capacidad", "aforo");
              }}
              error={errores["sede-capacidad"]}
            />
          </>
        )}
        <Campo
          id="aforo"
          etiqueta="Aforo del evento"
          inputMode="numeric"
          ayuda={
            capacidad !== null
              ? `Cuántas entradas pondrás a la venta. Máximo ${capacidad}, la capacidad de la sede.`
              : "Cuántas entradas pondrás a la venta."
          }
          value={estado.aforo}
          onChange={texto("aforo")}
          error={errores.aforo}
        />
      </div>

      <div hidden={paso !== "entradas"} className="flex flex-col gap-4">
        <p className="text-meta text-ink-secondary">
          Escribe el precio final en soles, con el IGV incluido. Puedes tener hasta {MAXIMO_CATEGORIAS} categorías.
        </p>
        {estado.categorias.map((categoria, i) => (
          <fieldset key={i} className="flex flex-col gap-3 rounded-md border border-border-hairline bg-surface-raised p-4">
            <legend className="px-1 text-meta text-ink-secondary">Categoría {i + 1}</legend>
            <Campo
              id={idCategoriaNombre(i)}
              etiqueta="Nombre"
              maxLength={60}
              placeholder="General, Estudiantes, VIP…"
              value={categoria.nombre}
              onChange={(e) => {
                const nombre = e.target.value;
                setEstado((a) => ({
                  ...a,
                  categorias: a.categorias.map((c, j) => (j === i ? { ...c, nombre } : c)),
                }));
                quitarError(idCategoriaNombre(i));
              }}
              error={errores[idCategoriaNombre(i)]}
            />
            <Campo
              id={idCategoriaPrecio(i)}
              etiqueta="Precio en soles (S/)"
              inputMode="decimal"
              placeholder="25.00"
              value={categoria.precio}
              onChange={(e) => {
                const precio = e.target.value;
                setEstado((a) => ({
                  ...a,
                  categorias: a.categorias.map((c, j) => (j === i ? { ...c, precio } : c)),
                }));
                quitarError(idCategoriaPrecio(i));
              }}
              error={errores[idCategoriaPrecio(i)]}
            />
            {estado.categorias.length > 1 && (
              <Boton
                variante="secundario"
                onClick={() => {
                  setEstado((a) => ({ ...a, categorias: a.categorias.filter((_, j) => j !== i) }));
                  setErrores({});
                  foco.current = "agregar-categoria";
                }}
              >
                Quitar categoría {i + 1}
              </Boton>
            )}
          </fieldset>
        ))}
        <Boton
          id="agregar-categoria"
          variante="secundario"
          disabled={estado.categorias.length >= MAXIMO_CATEGORIAS}
          aria-describedby={errores.categorias ? "categorias-error" : undefined}
          onClick={() => {
            setEstado((a) => ({ ...a, categorias: [...a.categorias, { nombre: "", precio: "" }] }));
            quitarError("categorias");
            foco.current = idCategoriaNombre(estado.categorias.length);
          }}
        >
          Agregar categoría
        </Boton>
        {errores.categorias && (
          <p id="categorias-error" className="flex items-start gap-2 text-meta text-state-error">
            <span aria-hidden="true">✕</span>
            <span>{errores.categorias}</span>
          </p>
        )}
      </div>

      <div hidden={paso !== "descripcion"} className="flex flex-col gap-4">
        <AreaTexto
          id="descripcion"
          etiqueta="Cuéntanos tu evento"
          rows={5}
          maxLength={600}
          ayuda={`Dos o tres frases: qué es, para quién y por qué no perdérselo. ${largoDescripcion}/600 caracteres.`}
          value={estado.descripcion}
          onChange={texto("descripcion")}
          error={errores.descripcion}
        />
      </div>

      <div hidden={paso !== "musica"} className="flex flex-col gap-4">
        <GrupoOpciones
          id="hay-musica"
          leyenda="¿Habrá música en el evento?"
          opciones={[
            { valor: "si", etiqueta: "Sí" },
            { valor: "no", etiqueta: "No" },
          ]}
          valor={estado.hayMusica === null ? null : estado.hayMusica ? "si" : "no"}
          alCambiar={(valor) => {
            cambiar("hayMusica", valor === "si");
            quitarError("hay-musica", "constancia");
          }}
          error={errores["hay-musica"]}
        />
        {estado.hayMusica && (
          <CampoArchivo
            id="constancia"
            etiqueta="Constancia de APDAYC"
            accept={TIPOS_CONSTANCIA_EVENTO.join(",")}
            ayuda="PDF o imagen, hasta 5 MB."
            nombreArchivo={estado.constancia?.name}
            onChange={alElegirArchivo("constancia", TIPOS_CONSTANCIA_EVENTO)}
            error={errorConstancia}
          />
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
        {indice > 0 ? (
          <Boton variante="secundario" onClick={() => irA(PASOS_ALTA[indice - 1]!)} disabled={enviando}>
            Atrás
          </Boton>
        ) : (
          <span className="max-sm:hidden" />
        )}
        <Boton
          type="submit"
          className="sm:min-w-48"
          disabled={enviando || (esUltimo && faltaConstancia)}
          aria-describedby={esUltimo && faltaConstancia ? "constancia-error" : undefined}
        >
          {esUltimo ? (enviando ? "Enviando…" : "Enviar a aprobación") : "Siguiente"}
        </Boton>
      </div>
    </form>
  );
}
