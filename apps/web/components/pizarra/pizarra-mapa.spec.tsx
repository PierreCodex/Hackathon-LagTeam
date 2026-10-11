import type { MapaSede } from "@reto18/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PizarraMapa } from "./pizarra-mapa";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/organizador/sedes/x/mapa" }));
vi.mock("@/lib/supabase/navegador", () => ({ tokenDelNavegador: async () => null }));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let siguiente = 100;
const asientos = (desde: number, hasta: number) =>
  Array.from({ length: hasta - desde + 1 }, (_, k) => ({ id: uuid(siguiente++), numero: desde + k }));

// Una sección con dos filas: A con pasillo (1–3 | 4–5) y B en un solo bloque (1–4).
const MAPA = {
  id: uuid(1),
  nombre: "Sala de prueba",
  direccion: "Av. Grau 1",
  distrito: "Piura",
  secciones: [
    {
      id: uuid(2),
      nombre: "Platea",
      orden: 0,
      tipo: "numerada",
      capacidad: null,
      filas: [
        {
          id: uuid(3),
          nombre: "A",
          orden: 0,
          bloques: [
            { id: uuid(4), orden: 0, desplazamiento: 0, asientos: asientos(1, 3) },
            { id: uuid(5), orden: 1, desplazamiento: 2, asientos: asientos(4, 5) },
          ],
        },
        { id: uuid(6), nombre: "B", orden: 1, bloques: [{ id: uuid(7), orden: 0, desplazamiento: 0, asientos: asientos(1, 4) }] },
      ],
    },
  ],
} as unknown as MapaSede;

describe("pizarra del mapa como sala", () => {
  const html = renderToStaticMarkup(<PizarraMapa modo="editar" sedeId={uuid(1)} mapaInicial={MAPA} apiUrl="http://api" />);

  it("pinta el lienzo oscuro con escenario y el contador de butacas", () => {
    expect(html).toMatch(/<section aria-label="Pizarra del mapa" class="superficie-inversa[^"]*bg-surface-inverse/);
    expect(html).toContain("ESCENARIO");
    expect(html).toMatch(/>9<\/span> butacas/);
  });

  it("cada butaca es un botón que la quita, con su número continuo en la fila", () => {
    expect(html.match(/aria-label="Quitar asiento \d+ de la fila [AB]"/g)).toHaveLength(9);
    expect(html).toContain('aria-label="Quitar asiento 5 de la fila A"');
    expect(html).toContain('aria-label="Quitar asiento 4 de la fila B"');
  });

  it("el pasillo es un hueco que se puede quitar y hay un + al final de cada bloque", () => {
    expect(html).toContain('aria-label="Quitar pasillo 1 de la fila A"');
    expect(html).not.toContain("Quitar pasillo 1 de la fila B");
    expect(html.match(/aria-label="Añadir asiento al bloque \d de la fila [AB]"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Añadir pasillo a la fila B"');
  });

  it("los nombres de sección y fila conservan los ids a los que llega el error de la API", () => {
    expect(html).toMatch(/<input id="seccion-0-nombre" aria-label="Nombre de la sección 1"[^>]*value="Platea"/);
    expect(html).toMatch(/<input id="fila-0-0-nombre" aria-label="Nombre de la fila 1"[^>]*value="A"/);
    expect(html).toMatch(/<input id="fila-0-1-nombre"[^>]*value="B"/);
  });

  it("la pizarra vacía muestra el escenario y Agregar sección", () => {
    const vacia = renderToStaticMarkup(<PizarraMapa modo="crear" apiUrl="http://api" />);
    expect(vacia).toContain("ESCENARIO");
    expect(vacia).toContain("+ Agregar sección");
    expect(vacia).toMatch(/>0<\/span> butacas/);
  });
});
