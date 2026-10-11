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

/** Destinos que solo tienen sentido con sesión: un visitante anónimo no tiene entradas ni cuenta. */
export const DESTINOS_CON_SESION: readonly IconoDestino[] = ["entradas", "cuenta"];

/**
 * Destinos de la barra inferior. Sin sesión (visitante anónimo, que navega como `publico`) se quitan
 * los de `DESTINOS_CON_SESION`: "Ingresar" y "Registrarse" ya están en la cabecera.
 */
export function destinosBarra(rol: Rol, conSesion = true): readonly Destino[] {
  const destinos = DESTINOS_POR_ROL[rol];
  return conSesion ? destinos : destinos.filter((destino) => !DESTINOS_CON_SESION.includes(destino.id));
}

/**
 * Destinos del menú de la cabecera de escritorio (≥ 1024 px): los de la barra sin "Cuenta",
 * porque la cuenta va a la derecha de la cabecera. Mismo orden que la barra.
 */
export function destinosCabecera(rol: Rol, conSesion = true): readonly Destino[] {
  return destinosBarra(rol, conSesion).filter((destino) => destino.id !== "cuenta");
}
