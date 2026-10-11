import { CODIGOS_MARKETING, type Pieza } from "@reto18/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CODIGO_SIN_CONEXION } from "@/lib/api";
import { EVENTO_ID, PIEZA } from "@/test/pieza-fixture";
import { AvisoErrorGenerar, PanelMarketing } from "./panel-marketing";

// Casos de la tabla de la historia 3.8, sobre el HTML que pinta el servidor.

function pintar(pieza?: Pieza) {
  return renderToStaticMarkup(
    <PanelMarketing apiUrl="http://api" eventoId={EVENTO_ID} piezaInicial={pieza} rutaActual="/organizador/marketing" />,
  );
}

describe("pantalla Marketing (3.8)", () => {
  it("genera con IA: flyer 4:5 y campaña con los datos reales del evento", () => {
    const html = pintar(PIEZA);
    expect(html).toContain(`src="/piezas/${PIEZA.id}/4x5"`);
    expect(html).toContain('alt="Noche de marinera"');
    expect(html).toContain("Vie 16 oct · 8:00 p. m.");
    expect(html).toContain("Teatro Municipal");
    expect(html).toContain("Desde S/ 25");
    expect(html).toContain("Jóvenes y familias de Piura");
    expect(html).toContain("Instagram");
    expect(html).toContain("S/ 100");
    expect(html).toContain("Mié 14 oct · 7:00 p. m.");
    expect(html).not.toContain("La IA no respondió");
  });

  it("respaldo: igual, con el aviso informativo", () => {
    const html = pintar({ ...PIEZA, origen: "respaldo" });
    expect(html).toContain("La IA no respondió a tiempo.");
    expect(html).toContain(`src="/piezas/${PIEZA.id}/4x5"`);
  });

  it("precios: entrada libre y sin precio", () => {
    expect(pintar({ ...PIEZA, datos: { ...PIEZA.datos, precio_minimo_centimos: 0 } })).toContain("Entrada libre");
    const sinPrecio = pintar({ ...PIEZA, datos: { ...PIEZA.datos, precio_minimo_centimos: null } });
    expect(sinPrecio).not.toContain("Desde S/");
    expect(sinPrecio).not.toContain("Entrada libre");
  });

  it("sin pieza: botón Generar y sin flyer", () => {
    const html = pintar();
    expect(html).toContain(">Generar<");
    expect(html).not.toContain("/piezas/");
  });
});

describe("errores de Generar (3.8)", () => {
  const pintarError = (codigo: string, mensaje: string) =>
    renderToStaticMarkup(<AvisoErrorGenerar error={{ codigo, mensaje }} generando={false} onReintentar={() => {}} />);

  it.each([
    [CODIGOS_MARKETING.EVENTO_NO_APROBADO, "El evento aún no está aprobado."],
    [CODIGOS_MARKETING.EVENTO_FINALIZADO, "El evento ya pasó."],
    [CODIGOS_MARKETING.EVENTO_NO_ENCONTRADO, "No encontramos el evento."],
  ])("%s: aviso con el mensaje de la API, sin Reintentar", (codigo, mensaje) => {
    const html = pintarError(codigo, mensaje);
    expect(html).toContain(mensaje);
    expect(html).not.toContain("Reintentar");
  });

  it("sin conexión: aviso con Reintentar", () => {
    const html = pintarError(CODIGO_SIN_CONEXION, "No hay conexión.");
    expect(html).toContain("No hay conexión.");
    expect(html).toContain("Reintentar");
  });
});
