import Image from "next/image";
import { clases } from "@/lib/clases";

const ARCHIVOS = {
  // Sobre carbón (cabecera, pie, panel de acceso).
  oscuro: { src: "/marca/logo-oscuro.svg", ancho: 169, alto: 51 },
  // Sobre claro (formulario de acceso).
  claro: { src: "/marca/logo-claro.svg", ancho: 448, alto: 115 },
} as const;

export type LogotipoProps = {
  /** `oscuro` para fondos carbón; `claro` para fondos claros. */
  variante: "oscuro" | "claro";
  /** Clases de tamaño. Por defecto 44 px de alto; nunca menos de 120 px de ancho (DESIGN.md · Logotipo). */
  className?: string;
  /** Precarga en la cabecera, que se ve al abrir cualquier pantalla. */
  precargar?: boolean;
};

/** Logotipo real del Club, recortado de los vectores del manual (`public/marca/`). */
export function Logotipo({ variante, className, precargar }: LogotipoProps) {
  const archivo = ARCHIVOS[variante];
  return (
    <Image
      src={archivo.src}
      width={archivo.ancho}
      height={archivo.alto}
      alt="Club de Arte & Cultura"
      unoptimized
      loading={precargar ? "eager" : undefined}
      // `clases` no fusiona: el alto por defecto solo va si quien llama no pone el suyo.
      className={clases("block w-auto min-w-[120px]", className ?? "h-11")}
    />
  );
}

/** Isotipo blanco como marca de agua decorativa (bandas y panel carbón). */
export function IsotipoMarcaAgua({ className }: { className?: string }) {
  return (
    <Image
      src="/marca/isotipo-blanco.svg"
      width={66}
      height={42}
      alt=""
      aria-hidden="true"
      unoptimized
      className={clases("pointer-events-none absolute select-none", className)}
    />
  );
}
