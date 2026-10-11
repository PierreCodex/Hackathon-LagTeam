import Link from "next/link";
import { clases } from "@/lib/clases";
import { destinosBarra, NOMBRE_ROL, type IconoDestino, type Rol } from "@/lib/navegacion";
import { IconoDestinoSvg } from "./icono-destino";

export type BarraInferiorProps = {
  /** Rol de quien navega. Lo decide la sesión (`PantallaSesion`, historia 1.8). */
  rol: Rol;
  /** Destino de la pantalla actual. */
  activo?: IconoDestino;
  /** `false` para el visitante anónimo: sin "Mis entradas" ni "Cuenta". */
  conSesion?: boolean;
  /** Fija abajo (lo normal). `false` solo para mostrarla dentro de otra página, como en /muestra. */
  fija?: boolean;
};

/** Barra inferior carbón por rol, sin menú hamburguesa; solo por debajo de 1024 px (DESIGN.md · Barra inferior). */
export function BarraInferior({ rol, activo, conSesion = true, fija = true }: BarraInferiorProps) {
  const destinos = destinosBarra(rol, conSesion);
  return (
    <nav
      aria-label={`Navegación de ${NOMBRE_ROL[rol].toLowerCase()}`}
      className={clases(
        "superficie-inversa border-t border-border-inverse bg-surface-inverse",
        // Solo por debajo de 1024 px: en escritorio navega la cabecera.
        fija && "fixed inset-x-0 bottom-0 z-10 pb-[env(safe-area-inset-bottom)] lg:hidden",
      )}
    >
      <ul className="mx-auto flex w-full max-w-pagina">
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
                    ? "text-ink-on-inverse before:absolute before:inset-x-[30%] before:top-0 before:h-[3px] before:bg-accent before:content-['']"
                    : "text-ink-on-inverse-secondary",
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
