import type { HTMLAttributes } from "react";
import { clases } from "@/lib/clases";

export type TarjetaProps = HTMLAttributes<HTMLElement> & {
  /** Elemento HTML: `section` si tiene título propio, `article` para un evento. */
  como?: "div" | "section" | "article";
  /** Sin relleno, para tarjetas con imagen a sangre. */
  sinRelleno?: boolean;
};

/** Superficie elevada sin sombra: tono raised y línea fina (DESIGN.md · Elevation). */
export function Tarjeta({ como: Elemento = "div", sinRelleno, className, ...resto }: TarjetaProps) {
  return (
    <Elemento
      className={clases(
        "overflow-hidden rounded-md border border-border-hairline bg-surface-raised",
        !sinRelleno && "p-4",
        className,
      )}
      {...resto}
    />
  );
}
