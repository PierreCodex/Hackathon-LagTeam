import { CODIGOS_MARKETING, type PublicacionPieza } from "@reto18/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PIEZA } from "@/test/pieza-fixture";
import { aIsoLima, AvisoErrorPublicar, AvisoResultado, PublicarPieza, textoPublicacion } from "./publicar-pieza";

// Historia 3.4: "Publicar en redes" con Upload-Post.

describe("Publicar en redes (3.4)", () => {
  it("texto propuesto con los textos de la IA, fecha, sede, precio y hashtags", () => {
    const texto = textoPublicacion(PIEZA);
    expect(texto).toContain("Noche de marinera");
    expect(texto).toContain("Vie 16 oct · 8:00 p. m.");
    expect(texto).toContain("Teatro Municipal, Piura");
    expect(texto).toContain("Desde S/ 25");
    expect(texto).toContain("#PiuraCultural");
  });

  it("pinta Instagram y Facebook marcadas y el botón Publicar ahora", () => {
    const html = renderToStaticMarkup(<PublicarPieza apiUrl="http://api" pieza={PIEZA} />);
    expect(html).toContain("Publicar en redes");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(html).toContain("Publicar ahora");
  });

  it("programar: datetime-local en hora de Lima", () => {
    expect(aIsoLima("2026-10-14T19:00")).toBe("2026-10-14T19:00:00-05:00");
    expect(aIsoLima("")).toBeUndefined();
  });

  it("error: mensaje de la API, descargar imagen y copiar texto", () => {
    const html = renderToStaticMarkup(
      <AvisoErrorPublicar
        error={{ codigo: CODIGOS_MARKETING.PUBLICACION_FALLIDA, mensaje: "Upload-Post no respondió." }}
        pieza={PIEZA}
        texto="Hola"
      />,
    );
    expect(html).toContain("Upload-Post no respondió.");
    expect(html).toContain(`href="/piezas/${PIEZA.id}/4x5"`);
    expect(html).toContain("Copiar texto");
  });

  it("resultado: enlace al post y enlace de compra", () => {
    const resultado: PublicacionPieza = {
      pieza_id: PIEZA.id,
      enlace: { codigo: "aZ09bY18", evento_id: PIEZA.evento_id, pieza_id: PIEZA.id, red: null, zona: null, creado_en: PIEZA.creado_en },
      url_enlace: "https://web.example/r/aZ09bY18",
      texto: "Hola",
      programada: false,
      redes: [
        { red: "instagram", ok: true, url: "https://instagram.com/p/1", error: null },
        { red: "facebook", ok: false, url: null, error: "Token vencido" },
      ],
    };
    const html = renderToStaticMarkup(<AvisoResultado resultado={resultado} />);
    expect(html).toContain("Publicado a medias.");
    expect(html).toContain('href="https://instagram.com/p/1"');
    expect(html).toContain("Token vencido");
    expect(html).toContain("https://web.example/r/aZ09bY18");
  });
});
