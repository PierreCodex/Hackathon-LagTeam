import Link from "next/link";
import type { ReactNode } from "react";

export type CabeceraProps = {
  /** Acción a la derecha (p. ej. "Ingresar" o el nombre de la cuenta). */
  accion?: ReactNode;
};

/** Marca del Club como anfitrión: logotipo en blanco sobre negro, "&" en rojo. */
export function MarcaClub() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-12 items-center text-meta font-black tracking-[0.02em] text-ink-primary no-underline"
    >
      CLUB DE ARTE <span className="mx-1 text-accent">&amp;</span> CULTURA
    </Link>
  );
}

/** Cabecera de cada pantalla (no es fija: se desplaza con el contenido) (DESIGN.md · Logotipo; EXPERIENCE.md · Foundation). */
export function Cabecera({ accion }: CabeceraProps) {
  return (
    <header className="border-b border-border-hairline bg-surface-base">
      <div className="mx-auto flex w-full items-center justify-between gap-3 px-margin-mobile md:max-w-contenido">
        <MarcaClub />
        {accion && <div className="flex shrink-0 items-center">{accion}</div>}
      </div>
    </header>
  );
}
