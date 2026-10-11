"use client";

import { useState } from "react";
import { Campo, type CampoProps } from "./campo";

export type CampoContrasenaProps = Omit<CampoProps, "type" | "accesorio">;

/** Tipo del campo y nombre del botón según si la contraseña se ve o no. */
export function estadoContrasena(visible: boolean) {
  return visible
    ? { tipo: "text", etiquetaBoton: "Ocultar contraseña" }
    : { tipo: "password", etiquetaBoton: "Mostrar contraseña" };
}

/**
 * Campo de contraseña con un botón de 48 px para mostrarla u ocultarla (DESIGN.md · Pantalla de acceso).
 * El botón anuncia su estado con `aria-pressed` y cambia su nombre a "Ocultar contraseña".
 */
export function CampoContrasena(props: CampoContrasenaProps) {
  const [visible, setVisible] = useState(false);
  const { tipo, etiquetaBoton } = estadoContrasena(visible);
  return (
    <Campo
      {...props}
      type={tipo}
      accesorio={
        <button
          type="button"
          aria-pressed={visible}
          aria-controls={props.id}
          aria-label={etiquetaBoton}
          onClick={() => setVisible((v) => !v)}
          className="flex size-12 items-center justify-center rounded-sm text-ink-secondary hover:text-ink-primary focus-visible:-outline-offset-4"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M4 4l16 16" />}
          </svg>
        </button>
      }
    />
  );
}
