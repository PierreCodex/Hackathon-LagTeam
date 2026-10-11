import type { ReactNode } from "react";
import type { IconoDestino } from "@/lib/navegacion";

// Iconos de trazo de 24 px, decorativos: la etiqueta del destino siempre se ve.
const TRAZOS: Record<IconoDestino, ReactNode> = {
  eventos: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  entradas: (
    <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4zM14 5v14" />
  ),
  cuenta: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  "mis-eventos": (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  marketing: <path d="M3 10v4h4l6 4V6L7 10zM17 9a4 4 0 0 1 0 6" />,
  ventas: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  aprobar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  weekend: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  tablero: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 16v-4M12 16V8M17 16v-6" />
    </>
  ),
  escanear: (
    <>
      <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </>
  ),
  registro: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
};

export function IconoDestinoSvg({ icono }: { icono: IconoDestino }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {TRAZOS[icono]}
    </svg>
  );
}
