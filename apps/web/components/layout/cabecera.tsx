import Link from "next/link";
import type { ReactNode } from "react";
import { clases } from "@/lib/clases";
import { destinosCabecera, NOMBRE_ROL, type IconoDestino, type Rol } from "@/lib/navegacion";
import { Logotipo } from "./marca";

export type CabeceraProps = {
  /** Acción a la derecha ("Registrarse" e "Ingresar", o la cuenta). */
  accion?: ReactNode;
  /** Rol cuyo menú se muestra desde 1024 px. Sin rol (perfil sin leer) no hay menú. */
  rol?: Rol;
  /** Destino de la pantalla actual: se marca en blanco con subrayado rojo de 3 px. */
  destinoActivo?: IconoDestino;
};

/** Contenedor de 1280 px con márgenes de 16 px (móvil) y 32 px (escritorio). */
export const CONTENEDOR = "mx-auto w-full max-w-pagina px-margin-mobile lg:px-margin-desktop";

/**
 * Cabecera carbón de 68 px (DESIGN.md · Cabecera). No es fija: se desplaza con el contenido.
 * Móvil: logotipo y acción. Escritorio (`lg`): además, el menú del rol en texto.
 */
export function Cabecera({ accion, rol, destinoActivo }: CabeceraProps) {
  const destinos = rol ? destinosCabecera(rol) : [];
  return (
    <header className="superficie-inversa bg-surface-inverse text-ink-on-inverse">
      <div className={clases(CONTENEDOR, "flex h-[68px] items-center gap-8")}>
        <Link href="/" className="flex shrink-0 items-center rounded-sm">
          <Logotipo variante="oscuro" precargar />
        </Link>
        {rol && destinos.length > 0 && (
          <nav aria-label={`Menú de ${NOMBRE_ROL[rol].toLowerCase()}`} className="hidden h-full lg:block">
            <ul className="flex h-full gap-7">
              {destinos.map((destino) => {
                const esActivo = destino.id === destinoActivo;
                return (
                  <li key={destino.id} className="h-full">
                    <Link
                      href={destino.href}
                      aria-current={esActivo ? "page" : undefined}
                      className={clases(
                        "relative flex h-full items-center font-medium no-underline focus-visible:-outline-offset-2",
                        esActivo
                          ? "text-ink-on-inverse after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-accent after:content-['']"
                          : "text-ink-on-inverse-secondary hover:text-ink-on-inverse",
                      )}
                    >
                      {destino.etiqueta}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        {accion && <div className="ml-auto flex min-w-0 items-center gap-3">{accion}</div>}
      </div>
    </header>
  );
}
