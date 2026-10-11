"use client";

import { CODIGOS_IDENTIDAD, type RolRegistro } from "@reto18/shared";
import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Aviso, Boton, BotonEnlace, Campo, CampoContrasena } from "@/components/ui";
import { clases } from "@/lib/clases";
import { primerCampoConError, validarRegistro, type ErroresRegistro } from "@/lib/formularios";
import { registrar, type EstadoRegistro } from "./acciones";

const OPCIONES_ROL: { valor: RolRegistro; etiqueta: string; ayuda: string }[] = [
  { valor: "publico", etiqueta: "Público", ayuda: "Quiero ver eventos y comprar entradas." },
  { valor: "organizador", etiqueta: "Organizador", ayuda: "Quiero publicar mis eventos." },
];

/** Id del elemento que recibe el foco para cada campo con error. */
const ID_FOCO: Record<keyof ErroresRegistro, string> = {
  correo: "correo",
  contrasena: "contrasena",
  rol: "rol-publico",
  whatsapp: "whatsapp",
  ciudad: "ciudad",
  acepta_avisos: "acepta_avisos",
};

function ErrorCampo({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="flex items-start gap-2 text-meta text-state-error">
      <span aria-hidden="true">✕</span>
      <span>{error}</span>
    </p>
  );
}

/**
 * Registro (1.8): correo, contraseña, tipo de cuenta, WhatsApp obligatorio, ciudad opcional y
 * avisos sin marcar. Valida con `RegistroSchema` antes de enviar; lo escrito se conserva.
 */
export function FormularioRegistro({ siguiente }: { siguiente: string | null }) {
  const [estado, enviar, enviando] = useActionState<EstadoRegistro, Parameters<typeof registrar>[1]>(
    registrar,
    {},
  );
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [rol, setRol] = useState<RolRegistro>("publico");
  const [whatsapp, setWhatsapp] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [aceptaAvisos, setAceptaAvisos] = useState(false);
  const [erroresLocales, setErroresLocales] = useState<ErroresRegistro>({});

  const errores: ErroresRegistro =
    Object.keys(erroresLocales).length > 0 || enviando ? erroresLocales : (estado.errores ?? {});

  const rutaIngresar = siguiente ? `/ingresar?siguiente=${encodeURIComponent(siguiente)}` : "/ingresar";

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = { correo, contrasena, rol, whatsapp, ciudad, acepta_avisos: aceptaAvisos };
    const validacion = validarRegistro(datos);
    if (!validacion.ok) {
      setErroresLocales(validacion.errores);
      const primero = primerCampoConError(validacion.errores);
      if (primero) document.getElementById(ID_FOCO[primero])?.focus();
      return;
    }
    setErroresLocales({});
    // Sin `action` en el <form>: así React no lo vacía al terminar.
    startTransition(() => enviar({ datos: validacion.datos, siguiente }));
  }

  const errorApi = !enviando ? estado.error : undefined;

  return (
    <form noValidate onSubmit={alEnviar} className="flex flex-col gap-4">
      {errorApi && (
        <Aviso
          tipo="error"
          titulo={errorApi.mensaje}
          accion={
            errorApi.codigo === CODIGOS_IDENTIDAD.CORREO_YA_REGISTRADO || estado.cuentaCreada ? (
              <BotonEnlace href={rutaIngresar} variante="secundario">
                Ingresar
              </BotonEnlace>
            ) : undefined
          }
        />
      )}

      <Campo
        id="correo"
        etiqueta="Correo"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        error={errores.correo}
      />
      <CampoContrasena
        id="contrasena"
        etiqueta="Contraseña"
        autoComplete="new-password"
        ayuda="Al menos 8 caracteres."
        value={contrasena}
        onChange={(e) => setContrasena(e.target.value)}
        error={errores.contrasena}
      />

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={errores.rol ? "rol-error" : undefined}
      >
        <legend className="mb-2 text-meta text-ink-primary">Tipo de cuenta</legend>
        {OPCIONES_ROL.map((opcion) => (
          <label
            key={opcion.valor}
            htmlFor={`rol-${opcion.valor}`}
            className={clases(
              "flex min-h-12 cursor-pointer items-start gap-3 rounded-sm border bg-surface-raised p-3",
              rol === opcion.valor ? "border-ink-primary" : "border-ink-muted",
            )}
          >
            <input
              id={`rol-${opcion.valor}`}
              type="radio"
              name="rol"
              value={opcion.valor}
              checked={rol === opcion.valor}
              onChange={() => setRol(opcion.valor)}
              aria-invalid={errores.rol ? true : undefined}
              aria-describedby={errores.rol ? "rol-error" : undefined}
              className="mt-1 size-5 shrink-0 accent-accent"
            />
            <span className="flex flex-col gap-1">
              <span className="font-bold">{opcion.etiqueta}</span>
              <span className="text-meta text-ink-secondary">{opcion.ayuda}</span>
            </span>
          </label>
        ))}
        <ErrorCampo id="rol-error" error={errores.rol} />
      </fieldset>

      <Campo
        id="whatsapp"
        etiqueta="WhatsApp"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="987 654 321"
        ayuda="Ahí te llegarán tus entradas."
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        error={errores.whatsapp}
      />
      <Campo
        id="ciudad"
        etiqueta="Ciudad (opcional)"
        autoComplete="address-level2"
        value={ciudad}
        onChange={(e) => setCiudad(e.target.value)}
        error={errores.ciudad}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="acepta_avisos" className="flex min-h-12 cursor-pointer items-start gap-3 py-2">
          <input
            id="acepta_avisos"
            type="checkbox"
            checked={aceptaAvisos}
            onChange={(e) => setAceptaAvisos(e.target.checked)}
            aria-describedby={errores.acepta_avisos ? "acepta_avisos-error" : undefined}
            aria-invalid={errores.acepta_avisos ? true : undefined}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          <span>Quiero recibir avisos de mis entradas y eventos por WhatsApp.</span>
        </label>
        <ErrorCampo id="acepta_avisos-error" error={errores.acepta_avisos} />
      </div>

      <Boton type="submit" anchoCompleto disabled={enviando}>
        {enviando ? "Creando tu cuenta…" : "Crear cuenta"}
      </Boton>
      <p className="text-meta text-ink-secondary">
        ¿Ya tienes cuenta?{" "}
        <Link href={rutaIngresar} className="text-ink-primary underline">
          Ingresar
        </Link>
      </p>
    </form>
  );
}
