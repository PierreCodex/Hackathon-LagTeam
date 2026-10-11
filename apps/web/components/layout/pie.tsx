import Link from "next/link";
import { clases } from "@/lib/clases";
import { CONTENEDOR } from "./cabecera";
import { Logotipo } from "./marca";

type Entrada = { texto: string; href?: string };

// Secciones del pie como texto: se enlazan cuando existan sus páginas y las URLs del Club.
// Solo "Para organizadores" lleva a una página que ya existe.
const SECCIONES: { titulo: string; entradas: Entrada[] }[] = [
  {
    titulo: "Conócenos",
    entradas: [
      { texto: "Sobre el Club" },
      { texto: "Preguntas frecuentes" },
      { texto: "Para organizadores", href: "/registro" },
    ],
  },
  {
    titulo: "Legales",
    entradas: [
      { texto: "Términos y condiciones" },
      { texto: "Política de privacidad" },
      { texto: "Libro de reclamaciones" },
    ],
  },
  {
    titulo: "Síguenos",
    entradas: [
      { texto: "Instagram" },
      { texto: "Facebook" },
      { texto: "TikTok" },
      { texto: "¿Necesitas ayuda? Contáctanos por WhatsApp" },
    ],
  },
];

export type PieProps = {
  /** Deja el hueco de la barra inferior fija (solo por debajo de 1024 px). */
  huecoBarra?: boolean;
};

/** Pie carbón del Club (DESIGN.md · Pie). En móvil queda por encima del hueco de la barra. */
export function Pie({ huecoBarra }: PieProps) {
  return (
    <footer
      className={clases(
        "superficie-inversa mt-10 bg-surface-inverse pt-10 text-ink-on-inverse",
        huecoBarra ? "pb-[calc(2.5rem+4rem+env(safe-area-inset-bottom))] lg:pb-10" : "pb-10",
      )}
    >
      <div className={CONTENEDOR}>
        <div className="grid grid-cols-2 gap-7 lg:grid-cols-[2fr_1fr_1fr_1.4fr]">
          <div className="col-span-2 flex flex-col gap-3 lg:col-span-1">
            <Logotipo variante="oscuro" className="h-[52px]" />
            <p className="max-w-80 text-meta text-ink-on-inverse-secondary">
              La red cultural de Piura: todos los eventos de la región en un solo lugar.
            </p>
          </div>
          {SECCIONES.map((seccion) => (
            <section key={seccion.titulo} aria-label={seccion.titulo} className="min-w-0">
              <h2 className="mb-3 text-meta font-extrabold">{seccion.titulo}</h2>
              <ul className="flex flex-col gap-2.5">
                {seccion.entradas.map((entrada) => (
                  <li key={entrada.texto} className="text-meta text-ink-on-inverse-secondary">
                    {entrada.href ? (
                      <Link
                        href={entrada.href}
                        className="inline-flex min-h-12 items-center text-ink-on-inverse underline underline-offset-4"
                      >
                        {entrada.texto}
                      </Link>
                    ) : (
                      entrada.texto
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-7 flex flex-wrap justify-between gap-2 border-t border-border-inverse pt-5 text-meta text-ink-on-inverse-secondary">
          <span>© 2026 Club de Arte &amp; Cultura · Piura</span>
          <span>Pago simulado: no se cobra nada.</span>
        </div>
      </div>
    </footer>
  );
}
