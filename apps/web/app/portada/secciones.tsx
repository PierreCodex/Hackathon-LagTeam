import type { CategoriaEvento } from "@reto18/shared";
import Link from "next/link";
import type { ReactNode } from "react";
import { BotonEnlace, Campo, Selector } from "@/components/ui";
import { clases } from "@/lib/clases";
import {
  CATEGORIAS,
  etiquetaCategoria,
  OPCIONES_FECHA,
  OPCIONES_PRECIO,
  type ValoresFiltro,
} from "@/lib/catalogo";

/** Buscador del mockup: un formulario GET a la portada, así cada búsqueda tiene su URL. */
export function Buscador({ valores, distritos, activos }: { valores: ValoresFiltro; distritos: string[]; activos: boolean }) {
  // Un distrito escrito en la URL que no está en la lista se conserva como opción.
  const opcionesDistrito = [...new Set([...distritos, ...(valores.distrito ? [valores.distrito] : [])])].map((d) => ({
    valor: d,
    etiqueta: d,
  }));
  return (
    <form
      action="/"
      method="get"
      role="search"
      aria-label="Buscar eventos"
      className="grid grid-cols-2 items-end gap-3 rounded-md border border-border-hairline bg-surface-raised p-4 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
    >
      <Campo
        id="buscar-q"
        name="q"
        type="search"
        etiqueta="Busca tu próximo evento"
        placeholder="Obras, conciertos, artistas…"
        defaultValue={valores.q}
        maxLength={100}
        className="col-span-2 lg:col-span-1"
      />
      <Selector id="buscar-fecha" name="fecha" etiqueta="Fecha" textoVacio="Todas" opciones={OPCIONES_FECHA} defaultValue={valores.fecha} />
      <Selector id="buscar-distrito" name="distrito" etiqueta="Distrito" textoVacio="Todos" opciones={opcionesDistrito} defaultValue={valores.distrito} />
      <Selector id="buscar-precio" name="precio" etiqueta="Precio" textoVacio="Todos" opciones={OPCIONES_PRECIO} defaultValue={valores.precio} />
      <Selector
        id="buscar-categoria"
        name="categoria"
        etiqueta="Categoría"
        textoVacio="Todas"
        opciones={CATEGORIAS.map((c) => ({ valor: c, etiqueta: etiquetaCategoria(c) }))}
        defaultValue={valores.categoria}
      />
      <div className="col-span-2 flex gap-2 lg:col-span-1">
        <button
          type="submit"
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-surface-inverse px-4 text-button text-ink-on-inverse hover:bg-surface-inverse-raised"
        >
          <IconoBuscar />
          <span className="lg:sr-only">Buscar</span>
        </button>
        {activos && (
          <BotonEnlace href="/" variante="secundario" className="flex-1 px-4">
            Limpiar
          </BotonEnlace>
        )}
      </div>
    </form>
  );
}

function IconoBuscar() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

const TRAZOS_CATEGORIA: Record<CategoriaEvento | "calendario", ReactNode> = {
  musica: <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />,
  teatro: (
    <>
      <path d="M4 4h16v7a8 8 0 0 1-16 0z" />
      <path d="M9 9h.01M15 9h.01M9 14a4 4 0 0 0 6 0" />
    </>
  ),
  danza: (
    <>
      <circle cx="13" cy="4" r="2" />
      <path d="m8 21 3-6 3 2v4M11 15l-1-5 4-2 3 3 3 1M10 10l-3 2" />
    </>
  ),
  artes_visuales: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" />
    </>
  ),
  cine: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3" />
    </>
  ),
  literatura: <path d="M12 6c-2-2-6-2-9-1v14c3-1 7-1 9 1 2-2 6-2 9-1V5c-3-1-7-1-9 1Zm0 0v14" />,
  otro: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
};

/** Fila de categorías del mockup: cada una abre la lista filtrada; el calendario al final. */
export function FilaCategorias({ activa }: { activa: string }) {
  const enlaces = [
    ...CATEGORIAS.filter((c) => c !== "otro").map((c) => ({
      id: c as CategoriaEvento | "calendario",
      etiqueta: etiquetaCategoria(c),
      href: `/?categoria=${c}`,
    })),
    { id: "calendario" as const, etiqueta: "Calendario", href: "/calendario" },
  ];
  return (
    <nav aria-label="Categorías" className="rounded-md border border-border-hairline bg-surface-raised">
      <ul className="flex overflow-x-auto">
        {enlaces.map((enlace) => {
          const esActiva = enlace.id === activa;
          return (
            <li key={enlace.id} className="min-w-24 flex-1">
              <Link
                href={enlace.href}
                aria-current={esActiva ? "page" : undefined}
                className={clases(
                  "flex flex-col items-center gap-2 px-2 py-5 text-meta no-underline hover:text-ink-primary",
                  esActiva ? "text-ink-primary" : "text-ink-secondary",
                )}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {TRAZOS_CATEGORIA[enlace.id]}
                </svg>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  {esActiva && <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />}
                  {enlace.etiqueta}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Lateral del héroe: el fin de semana cultural y la invitación a los organizadores. */
export function LateralHeroe() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      <section className="superficie-inversa flex flex-col justify-end gap-2 rounded-md bg-surface-inverse p-5 text-ink-on-inverse">
        <p className="text-meta tracking-wide text-ink-on-inverse-secondary">Piura Cultural Weekend</p>
        <h2 className="text-body font-bold">Este fin de semana: la ruta cultural de Piura</h2>
        <Link href="/?fecha=fin-de-semana" className="self-start text-meta font-medium text-ink-on-inverse decoration-accent decoration-2 underline-offset-4">
          Ver la ruta
        </Link>
      </section>
      <section className="flex flex-col justify-end gap-2 rounded-md border border-border-hairline bg-surface-raised p-5">
        <p className="text-meta tracking-wide text-ink-secondary">Organizadores</p>
        <h2 className="text-body font-bold">¿Tienes un evento? Publícalo y véndelo con IA</h2>
        <Link href="/registro" className="self-start text-meta font-medium text-ink-primary decoration-accent decoration-2 underline-offset-4">
          Publica tu evento
        </Link>
      </section>
    </div>
  );
}

/** Banda final para organizadores. */
export function BandaOrganizadores() {
  return (
    <section className="superficie-inversa flex flex-col gap-4 rounded-md bg-surface-inverse px-6 py-8 text-ink-on-inverse sm:flex-row sm:items-center sm:justify-between sm:px-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-title font-bold">¿Organizas eventos en Piura?</h2>
        <p className="text-meta text-ink-on-inverse-secondary">
          Publica tu evento, arma tu mapa de butacas y deja que la IA prepare tu campaña.
        </p>
      </div>
      <BotonEnlace href="/registro" variante="inverso" className="shrink-0">
        Publica tu evento
      </BotonEnlace>
    </section>
  );
}
