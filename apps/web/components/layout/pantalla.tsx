import type { ReactNode } from "react";
import { clases } from "@/lib/clases";
import type { IconoDestino, Rol } from "@/lib/navegacion";
import { BarraInferior } from "./barra-inferior";
import { Cabecera, CONTENEDOR } from "./cabecera";
import { Pie } from "./pie";

export type PantallaProps = {
  /** Título de la pantalla (h1 en estilo `title`). Opcional si la página pone el suyo. */
  titulo?: string;
  /** Acción a la derecha de la cabecera. */
  accionCabecera?: ReactNode;
  /** Sin acción en la cabecera (acceso y registro: así no hay dos botones rojos). */
  sinAccionesCabecera?: boolean;
  /** Rol del menú de la cabecera y de la barra inferior. Sin rol no hay menú ni barra. */
  rol?: Rol;
  /** Destino activo del menú y de la barra. */
  destinoActivo?: IconoDestino;
  /** `false` para el visitante anónimo: el menú no muestra "Mis entradas" ni "Cuenta". */
  conSesion?: boolean;
  /**
   * `completo`: todo el contenedor de 1280 px (lo normal).
   * `formulario`: una columna de 480 px centrada dentro del contenedor.
   */
  ancho?: "completo" | "formulario";
  children: ReactNode;
};

/**
 * Esqueleto de toda pantalla: cabecera carbón, contenido, pie y barra inferior por rol.
 * Contenedor de hasta 1280 px con márgenes de 16 px (32 px desde 1024 px).
 * Desde 1024 px no hay barra inferior: el menú del rol está en la cabecera.
 */
export function Pantalla({
  titulo,
  accionCabecera,
  sinAccionesCabecera,
  rol,
  destinoActivo,
  conSesion = true,
  ancho = "completo",
  children,
}: PantallaProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-20 focus:rounded-sm focus:bg-surface-overlay focus:p-3"
      >
        Saltar al contenido
      </a>
      <Cabecera
        accion={sinAccionesCabecera ? undefined : accionCabecera}
        rol={rol}
        destinoActivo={destinoActivo}
        conSesion={conSesion}
      />
      <main id="contenido" tabIndex={-1} className={clases(CONTENEDOR, "flex flex-1 flex-col pt-6 outline-none")}>
        <div
          className={clases(
            "flex w-full flex-1 flex-col gap-4",
            ancho === "formulario" && "mx-auto max-w-formulario",
          )}
        >
          {titulo && <h1 className="text-title">{titulo}</h1>}
          {children}
        </div>
      </main>
      {/* El hueco de la barra fija va en el pie, así la barra nunca lo tapa. */}
      <Pie huecoBarra={Boolean(rol)} />
      {rol && <BarraInferior rol={rol} activo={destinoActivo} conSesion={conSesion} />}
    </div>
  );
}
