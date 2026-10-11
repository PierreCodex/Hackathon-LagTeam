/**
 * Destinos de la barra inferior por rol (EXPERIENCE.md · Information Architecture).
 * Única fuente de los menús: la barra y cualquier otra navegación leen de aquí.
 *
 * Las rutas son las previstas; cada historia que construye una pantalla confirma la suya.
 * El destino principal de organizador y administrador es su portada (`/organizador`, `/admin`, 1.8).
 */

export const ROLES = ["publico", "organizador", "administrador", "puerta"] as const;
export type Rol = (typeof ROLES)[number];

export type IconoDestino =
  | "eventos"
  | "calendario"
  | "entradas"
  | "cuenta"
  | "mis-eventos"
  | "marketing"
  | "ventas"
  | "aprobar"
  | "weekend"
  | "tablero"
  | "escanear"
  | "registro";

export type Destino = {
  id: IconoDestino;
  etiqueta: string;
  href: string;
};

export const NOMBRE_ROL: Record<Rol, string> = {
  publico: "Público",
  organizador: "Organizador",
  administrador: "Administrador",
  puerta: "Puerta",
};

export const DESTINOS_POR_ROL: Record<Rol, readonly Destino[]> = {
  publico: [
    { id: "eventos", etiqueta: "Eventos", href: "/" },
    { id: "calendario", etiqueta: "Calendario", href: "/calendario" },
    { id: "entradas", etiqueta: "Mis entradas", href: "/mis-entradas" },
    { id: "cuenta", etiqueta: "Cuenta", href: "/cuenta" },
  ],
  organizador: [
    { id: "mis-eventos", etiqueta: "Mis eventos", href: "/organizador" },
    { id: "marketing", etiqueta: "Marketing", href: "/organizador/marketing" },
    { id: "ventas", etiqueta: "Ventas", href: "/organizador/ventas" },
    { id: "cuenta", etiqueta: "Cuenta", href: "/cuenta" },
  ],
  administrador: [
    { id: "aprobar", etiqueta: "Aprobar", href: "/admin" },
    { id: "weekend", etiqueta: "Weekend", href: "/admin/weekend" },
    { id: "tablero", etiqueta: "Tablero", href: "/admin/tablero" },
    { id: "cuenta", etiqueta: "Cuenta", href: "/cuenta" },
  ],
  puerta: [
    { id: "escanear", etiqueta: "Escanear", href: "/puerta/escanear" },
    { id: "registro", etiqueta: "Registro", href: "/puerta/registro" },
  ],
};
