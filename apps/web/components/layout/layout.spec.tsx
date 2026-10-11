import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampoContrasena, estadoContrasena } from "@/components/ui/campo-contrasena";
import { Pantalla } from "./pantalla";
import { AccionCabeceraSesion } from "./pantalla-sesion";

// Cada caso de la tabla de la historia 1.12, sobre el HTML que pinta el servidor.

function menuCabecera(html: string) {
  return html.match(/<nav aria-label="Menú de [^"]+"[\s\S]*?<\/nav>/)?.[0] ?? "";
}

describe("layout de escritorio (1.12)", () => {
  it("anónimo: menú de público, Registrarse solo en escritorio, Ingresar, pie y barra solo en móvil", () => {
    const html = renderToStaticMarkup(
      <Pantalla rol="publico" destinoActivo="eventos" accionCabecera={<AccionCabeceraSesion sesion={{ tipo: "anonima" }} />}>
        <p>contenido</p>
      </Pantalla>,
    );
    const menu = menuCabecera(html);
    expect(menu).toContain("Eventos");
    expect(menu).toContain("Mis entradas");
    expect(menu).not.toContain("Cuenta");
    expect(html).toMatch(/max-lg:hidden" href="\/registro">Registrarse</);
    expect(html).toContain('href="/ingresar"');
    expect(html).toContain("<footer");
    expect(html).toMatch(/<nav aria-label="Navegación de público" class="[^"]*lg:hidden/);
    expect(html).not.toContain('href="#"');
  });

  it("organizador: su menú con Mis eventos activo y su cuenta a la derecha", () => {
    const html = renderToStaticMarkup(
      <Pantalla
        rol="organizador"
        destinoActivo="mis-eventos"
        accionCabecera={
          <AccionCabeceraSesion
            sesion={{
              tipo: "cuenta",
              rolBarra: "organizador",
              perfil: {
                id: "00000000-0000-0000-0000-000000000000",
                correo: "lucia@teatro.pe",
                rol: "organizador",
                whatsapp: "+51987654321",
                ciudad: null,
                acepta_avisos: false,
              },
            } as never}
          />
        }
      >
        <p>contenido</p>
      </Pantalla>,
    );
    const menu = menuCabecera(html);
    expect(menu.match(/<a [^>]*>[^<]+<\/a>/g)?.map((a) => a.replace(/<[^>]+>/g, ""))).toEqual([
      "Mis eventos",
      "Marketing",
      "Ventas",
    ]);
    expect(menu).toMatch(/aria-current="page"[^>]*>Mis eventos</);
    expect(html).toContain('aria-label="Tu cuenta: lucia@teatro.pe"');
  });

  it("perfil sin leer: ni menú ni barra", () => {
    const html = renderToStaticMarkup(
      <Pantalla accionCabecera={<AccionCabeceraSesion sesion={{ tipo: "error" } as never} />}>
        <p>contenido</p>
      </Pantalla>,
    );
    expect(menuCabecera(html)).toBe("");
    expect(html).not.toContain("Navegación de");
    expect(html).toContain('href="/cuenta"');
  });

  it("acceso: la cabecera va sin botones", () => {
    const html = renderToStaticMarkup(
      <Pantalla rol="publico" sinAccionesCabecera accionCabecera={<AccionCabeceraSesion sesion={{ tipo: "anonima" }} />}>
        <p>formulario</p>
      </Pantalla>,
    );
    expect(html).not.toContain('href="/ingresar"');
    expect(html).not.toContain(">Registrarse<");
  });
});

describe("mostrar u ocultar la contraseña", () => {
  it("empieza oculta, con el botón Mostrar contraseña sin pulsar", () => {
    const html = renderToStaticMarkup(<CampoContrasena id="contrasena" etiqueta="Contraseña" />);
    expect(html).toContain('type="password"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Mostrar contraseña"');
  });

  it("al pulsar pasa a texto y el botón dice Ocultar contraseña; al volver a pulsar se oculta", () => {
    expect(estadoContrasena(true)).toEqual({ tipo: "text", etiquetaBoton: "Ocultar contraseña" });
    expect(estadoContrasena(false)).toEqual({ tipo: "password", etiquetaBoton: "Mostrar contraseña" });
  });
});
