import type { Perfil } from "@reto18/shared";
import { describe, expect, it, vi } from "vitest";
import { CODIGO_SIN_CONEXION } from "./api";
import { DESTINOS_POR_ROL } from "./navegacion";
import {
  decidirProxy,
  destinoTrasIngreso,
  guardaDeRol,
  portadaDeRol,
  resolverSesion,
  rolBarraDeSesion,
  rolDeBarra,
  rolDeRuta,
  rutaIngresar,
  rutaInternaSegura,
  type Sesion,
} from "./sesion";

const API = "https://api.ejemplo";

function perfil(rol: Perfil["rol"]): Perfil {
  return {
    id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    correo: `${rol}@ejemplo.pe`,
    rol,
    whatsapp: "+51987654321",
    ciudad: null,
    acepta_avisos: false,
  };
}

function respuestaJson(cuerpo: unknown, status: number) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(cuerpo), { status }));
}

const cuenta = (rol: Perfil["rol"]): Sesion => ({
  tipo: "cuenta",
  perfil: perfil(rol),
  rolBarra: rolDeBarra(rol),
});

describe("rol de la API → barra de la 1.7", () => {
  it("publico → público, organizador → organizador, admin → administrador", () => {
    expect(rolDeBarra("publico")).toBe("publico");
    expect(rolDeBarra("organizador")).toBe("organizador");
    expect(rolDeBarra("admin")).toBe("administrador");
  });

  it("sin sesión, la barra es la de público; con error, ninguna", () => {
    expect(rolBarraDeSesion({ tipo: "anonima" })).toBe("publico");
    expect(rolBarraDeSesion(cuenta("admin"))).toBe("administrador");
    expect(
      rolBarraDeSesion({ tipo: "error", error: { codigo: CODIGO_SIN_CONEXION, mensaje: "x" } }),
    ).toBeUndefined();
  });

  it("el destino principal de organizador y admin es su portada (sin 404)", () => {
    expect(DESTINOS_POR_ROL.organizador[0]?.href).toBe(portadaDeRol("organizador"));
    expect(DESTINOS_POR_ROL.administrador[0]?.href).toBe(portadaDeRol("admin"));
    expect(DESTINOS_POR_ROL.publico[0]?.href).toBe(portadaDeRol("publico"));
  });
});

describe("portada por rol", () => {
  it("publico → /, organizador → /organizador, admin → /admin", () => {
    expect(portadaDeRol("publico")).toBe("/");
    expect(portadaDeRol("organizador")).toBe("/organizador");
    expect(portadaDeRol("admin")).toBe("/admin");
  });

  it("tras entrar vuelve a la ruta pedida si es interna; si no, a la portada", () => {
    expect(destinoTrasIngreso("/admin?x=1", "admin")).toBe("/admin?x=1");
    expect(destinoTrasIngreso(null, "organizador")).toBe("/organizador");
    expect(destinoTrasIngreso("https://malo.ejemplo", "publico")).toBe("/");
    expect(destinoTrasIngreso("//malo.ejemplo", "publico")).toBe("/");
    expect(destinoTrasIngreso("/\\malo.ejemplo", "publico")).toBe("/");
    expect(destinoTrasIngreso("/ingresar?siguiente=/admin", "admin")).toBe("/admin");
  });

  it("rutaIngresar lleva la vuelta codificada", () => {
    expect(rutaIngresar("/admin")).toBe("/ingresar?siguiente=%2Fadmin");
    expect(rutaIngresar("//malo")).toBe("/ingresar");
    expect(rutaInternaSegura("")).toBeNull();
  });

  it("rechaza caracteres de control que el navegador quitaría (redirección abierta)", () => {
    expect(rutaInternaSegura("/\t/evil.example")).toBeNull();
    expect(rutaInternaSegura("/\n/evil.example")).toBeNull();
    expect(rutaInternaSegura("/\r/evil.example")).toBeNull();
    expect(destinoTrasIngreso("/\t/evil.example/x", "publico")).toBe("/");
  });

  it("/%09/… se permite solo porque resuelve en el mismo origen", () => {
    expect(new URL("/%09/evil.example", "https://app.ejemplo").origin).toBe("https://app.ejemplo");
    expect(rutaInternaSegura("/%09/evil.example")).toBe("/%09/evil.example");
  });
});

describe("resolverSesion", () => {
  it("sin token: anónima y sin llamar a la API", async () => {
    const fetchFn = vi.fn<typeof fetch>();
    expect(await resolverSesion(null, { apiUrl: API, fetchFn })).toEqual({ tipo: "anonima" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("con token: pide el perfil con Bearer y toma el rol del perfil", async () => {
    const fetchFn = respuestaJson(perfil("admin"), 200);

    const sesion = await resolverSesion("jwt-123", { apiUrl: API, fetchFn });

    expect(sesion).toEqual({ tipo: "cuenta", perfil: perfil("admin"), rolBarra: "administrador" });
    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://api.ejemplo/api/v1/identidad/perfil");
    expect(fetchFn.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer jwt-123" });
  });

  it("token que la API rechaza (401 NO_AUTENTICADO): anónima", async () => {
    const fetchFn = respuestaJson({ error: { codigo: "NO_AUTENTICADO", mensaje: "Inicia sesión" } }, 401);
    expect(await resolverSesion("caducado", { apiUrl: API, fetchFn })).toEqual({ tipo: "anonima" });
  });

  it("API caída: error SIN_CONEXION, sin rol ni barra", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });

    const sesion = await resolverSesion("jwt", { apiUrl: API, fetchFn });

    expect(sesion).toMatchObject({ tipo: "error", error: { codigo: CODIGO_SIN_CONEXION } });
    expect(rolBarraDeSesion(sesion)).toBeUndefined();
  });

  it("cuenta sin perfil (403 SIN_PERFIL): error con el mensaje de la API", async () => {
    const fetchFn = respuestaJson({ error: { codigo: "SIN_PERFIL", mensaje: "Tu cuenta no tiene perfil" } }, 403);
    expect(await resolverSesion("jwt", { apiUrl: API, fetchFn })).toEqual({
      tipo: "error",
      error: { codigo: "SIN_PERFIL", mensaje: "Tu cuenta no tiene perfil" },
    });
  });

  it("perfil fuera de contrato (rol desconocido): error, nunca un menú inventado", async () => {
    const fetchFn = respuestaJson({ ...perfil("publico"), rol: "puerta" }, 200);
    expect(await resolverSesion("jwt", { apiUrl: API, fetchFn })).toMatchObject({ tipo: "error" });
  });
});

describe("guardas de rol", () => {
  it("sin sesión en ruta privada → ingresar", () => {
    expect(guardaDeRol({ tipo: "anonima" }, "admin")).toEqual({ tipo: "ingresar" });
  });

  it("público en /admin → sin permiso, con vuelta a su portada", () => {
    expect(guardaDeRol(cuenta("publico"), "admin")).toEqual({
      tipo: "sin-permiso",
      rolRequerido: "admin",
      portada: "/",
    });
  });

  it("admin en /organizador → sin permiso; organizador en /organizador → permitido", () => {
    expect(guardaDeRol(cuenta("admin"), "organizador")).toMatchObject({ tipo: "sin-permiso", portada: "/admin" });
    expect(guardaDeRol(cuenta("organizador"), "organizador")).toMatchObject({ tipo: "permitido" });
  });

  it("perfil sin leer → error, sin datos del rol", () => {
    const error = { codigo: CODIGO_SIN_CONEXION, mensaje: "Sin conexión" };
    expect(guardaDeRol({ tipo: "error", error }, "admin")).toEqual({ tipo: "error", error });
  });
});

describe("proxy", () => {
  it("rolDeRuta reconoce solo las rutas privadas", () => {
    expect(rolDeRuta("/admin")).toBe("admin");
    expect(rolDeRuta("/admin/weekend")).toBe("admin");
    expect(rolDeRuta("/organizador")).toBe("organizador");
    expect(rolDeRuta("/administracion")).toBeNull();
    expect(rolDeRuta("/")).toBeNull();
    expect(rolDeRuta("/cuenta")).toBeNull();
  });

  it("sin sesión en /admin redirige a /ingresar con la vuelta", () => {
    expect(decidirProxy("/admin", "?x=1", "sin-sesion")).toEqual({
      tipo: "redirigir",
      destino: "/ingresar?siguiente=%2Fadmin%3Fx%3D1",
    });
  });

  it("deja pasar rutas públicas, sesiones abiertas y Auth sin respuesta", () => {
    expect(decidirProxy("/", "", "sin-sesion")).toEqual({ tipo: "seguir" });
    expect(decidirProxy("/admin", "", "con-sesion")).toEqual({ tipo: "seguir" });
    expect(decidirProxy("/organizador", "", "desconocido")).toEqual({ tipo: "seguir" });
  });
});
