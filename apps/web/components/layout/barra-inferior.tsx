import Link from "next/link";
import { clases } from "@/lib/clases";
import { DESTINOS_POR_ROL, NOMBRE_ROL, type IconoDestino, type Rol } from "@/lib/navegacion";
import { IconoDestinoSvg } from "./icono-destino";

export type BarraInferiorProps = {
  /** Rol de quien navega. Llega como dato: la sesión real llega con la historia 1.8. */
  rol: Rol;
  /** Destino de la pantalla actual. */
  activo?: IconoDestino;
  /** Fija abajo (lo normal). `false` solo para mostrarla dentro de otra página, como en /muestra. */
  fija?: boolean;
};

/** Barra inferior por rol, sin menú hamburguesa (DESIGN.md · Barra inferior). */
export function BarraInferior({ rol, activo, fija = true }: BarraInferiorProps) {
  const destinos = DESTINOS_POR_ROL[rol];
  return (
    <nav
      aria-label={`Navegación de ${NOMBRE_ROL[rol].toLowerCase()}`}
      className={clases(
        "border-t border-border-hairline bg-surface-base",
        fija && "fixed inset-x-0 bottom-0 z-10 pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto flex w-full md:max-w-contenido">
        {destinos.map((destino) => {
          const esActivo = destino.id === activo;
          return (
            <li key={destino.id} className="min-w-0 flex-1">
              <Link
                href={destino.href}
                aria-current={esActivo ? "page" : undefined}
                className={clases(
                  "relative flex h-16 flex-col items-center justify-center gap-1 px-1 text-center text-meta no-underline focus-visible:-outline-offset-2",
                  esActivo
                    ? "text-ink-primary before:absolute before:inset-x-[30%] before:top-0 before:h-0.5 before:bg-accent before:content-['']"
                    : "text-ink-secondary",
                )}
              >
                <IconoDestinoSvg icono={destino.id} />
                <span className="max-w-full leading-tight [overflow-wrap:anywhere]">{destino.etiqueta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
