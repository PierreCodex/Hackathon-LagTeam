"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Aviso, Boton, Campo } from "@/components/ui";
import { ingresar, type EstadoIngreso } from "./acciones";

type ErroresCampo = { correo?: string; contrasena?: string };

/** Correo y contraseña. Lo escrito se conserva si algo falla. */
export function FormularioIngreso({ siguiente }: { siguiente: string | null }) {
  const [estado, enviar, enviando] = useActionState<EstadoIngreso, Parameters<typeof ingresar>[1]>(
    ingresar,
    {},
  );
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [errores, setErrores] = useState<ErroresCampo>({});

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nuevos: ErroresCampo = {};
    if (!correo.trim()) nuevos.correo = "Escribe tu correo.";
    if (!contrasena) nuevos.contrasena = "Escribe tu contraseña.";
    setErrores(nuevos);
    if (nuevos.correo) return document.getElementById("correo")?.focus();
    if (nuevos.contrasena) return document.getElementById("contrasena")?.focus();
    // Sin `action` en el <form>: así React no lo vacía al terminar.
    startTransition(() => enviar({ correo, contrasena, siguiente }));
  }

  return (
    <form noValidate onSubmit={alEnviar} className="flex flex-col gap-4">
      {estado.error && !enviando && (
        <Aviso tipo="error" titulo={estado.error.mensaje}>
          {estado.error.codigo === "CREDENCIALES_INVALIDAS"
            ? "Revisa los datos e inténtalo de nuevo."
            : undefined}
        </Aviso>
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
      <Campo
        id="contrasena"
        etiqueta="Contraseña"
        type="password"
        autoComplete="current-password"
        value={contrasena}
        onChange={(e) => setContrasena(e.target.value)}
        error={errores.contrasena}
      />
      <Boton type="submit" anchoCompleto disabled={enviando}>
        {enviando ? "Entrando…" : "Ingresar"}
      </Boton>
      <p className="text-meta text-ink-secondary">
        ¿Aún no tienes cuenta?{" "}
        <Link
          href={siguiente ? `/registro?siguiente=${encodeURIComponent(siguiente)}` : "/registro"}
          className="text-ink-primary underline"
        >
          Regístrate
        </Link>
      </p>
    </form>
  );
}
