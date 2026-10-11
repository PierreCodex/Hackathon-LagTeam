import { CODIGOS_EVENTOS, type ErrorApi } from "@reto18/shared";
import { describe, expect, it, vi } from "vitest";
import {
  abrirConstancia,
  accionButacas,
  aplicarErrorAccion,
  type PestanaConstancia,
  type TarjetaConError,
  ESTADO_EVENTO,
  MAXIMO_MOTIVO,
  MENSAJE_MOTIVO_VACIO,
  mensajeMotivoLargo,
  quitarDecidido,
  textoEstadoOrganizador,
  validarMotivo,
} from "./revision";

describe("validarMotivo", () => {
  it.each(["", "   ", "\n\t"])("vacío (%j) → error sin llamar a la API", (texto) => {
    expect(validarMotivo(texto)).toEqual({ ok: false, error: MENSAJE_MOTIVO_VACIO });
  });

  it("601 caracteres → error con el largo", () => {
    expect(validarMotivo("a".repeat(MAXIMO_MOTIVO + 1))).toEqual({ ok: false, error: mensajeMotivoLargo(601) });
  });

  it("600 caracteres → válido", () => {
    expect(validarMotivo("a".repeat(MAXIMO_MOTIVO))).toEqual({ ok: true, motivo: "a".repeat(MAXIMO_MOTIVO) });
  });

  it("recorta los espacios antes de medir y de enviar", () => {
    expect(validarMotivo(`  ${"a".repeat(MAXIMO_MOTIVO)}  `)).toEqual({ ok: true, motivo: "a".repeat(MAXIMO_MOTIVO) });
    expect(validarMotivo("  Completar la descripción del programa. ")).toEqual({
      ok: true,
      motivo: "Completar la descripción del programa.",
    });
  });
});

describe("ESTADO_EVENTO", () => {
  it("cada estado tiene símbolo y texto, no solo color", () => {
    for (const estado of Object.values(ESTADO_EVENTO)) {
      expect(estado.simbolo).not.toBe("");
      expect(estado.texto).not.toBe("");
    }
    expect(ESTADO_EVENTO.rechazado.texto).toBe("Rechazado");
  });
});

describe("textoEstadoOrganizador", () => {
  it.each([
    [{ estado: "pendiente", publicado: false }, "Pendiente de aprobación"],
    [{ estado: "rechazado", publicado: false }, "Rechazado"],
    [{ estado: "aprobado", publicado: false }, "Aprobado · Falta armar el mapa y publicar"],
    [{ estado: "aprobado", publicado: true }, "Aprobado · Publicado"],
  ] as const)("%o → %s", (evento, esperado) => {
    expect(textoEstadoOrganizador(evento)).toBe(esperado);
  });
});

describe("accionButacas", () => {
  const sede_id = "13100000-0000-4000-8000-000000000001";
  const id = "13100000-0000-4000-8000-000000000002";
  const href = `/organizador/sedes/${sede_id}/mapa`;
  const conEvento = `${href}?evento=${id}`;
  it.each([
    [{ id, estado: "pendiente", publicado: false, sede_id }, { texto: "Armar butacas", href: conEvento }],
    [{ id, estado: "aprobado", publicado: false, sede_id }, { texto: "Armar butacas", href: conEvento }],
    [{ id, estado: "aprobado", publicado: true, sede_id }, { texto: "Ver butacas", href }],
    [{ id, estado: "rechazado", publicado: false, sede_id }, null],
  ] as const)("%o → %o", (evento, esperado) => {
    expect(accionButacas(evento)).toEqual(esperado);
  });
});

describe("quitarDecidido", () => {
  it("quita solo ese id y no muta la lista", () => {
    const lista = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(quitarDecidido(lista, "b")).toEqual([{ id: "a" }, { id: "c" }]);
    expect(lista).toHaveLength(3);
  });

  it("id ausente → misma lista", () => {
    expect(quitarDecidido([{ id: "a" }], "x")).toEqual([{ id: "a" }]);
  });
});

describe("aplicarErrorAccion", () => {
  const conflicto: ErrorApi = { codigo: CODIGOS_EVENTOS.ESTADO_EVENTO_INCOMPATIBLE, mensaje: "El evento ya no está pendiente." };
  const caida: ErrorApi = { codigo: CODIGOS_EVENTOS.BD_NO_DISPONIBLE, mensaje: "La base de datos no responde." };
  const evento = { id: "b", titulo: "Noche de DJ" };
  const tarjetas = (accion: TarjetaConError["accion"]): TarjetaConError[] => [
    { id: "a", accion: null, error: null },
    { id: "b", accion, error: null },
  ];

  it.each(["aprobar", "rechazar"] as const)("409 al %s → sale de la lista y aviso de otro administrador", (accion) => {
    const resultado = aplicarErrorAccion(tarjetas(accion), evento, accion, conflicto);
    expect(resultado.tarjetas.map((t) => t.id)).toEqual(["a"]);
    expect(resultado.decidido).toEqual({
      titulo: 'Otro administrador ya decidió "Noche de DJ".',
      mensaje: "El evento ya no está pendiente.",
    });
  });

  it("409 al destacar → la tarjeta se queda con el error", () => {
    const resultado = aplicarErrorAccion(tarjetas("destacar"), evento, "destacar", conflicto);
    expect(resultado.decidido).toBeNull();
    expect(resultado.tarjetas).toEqual([
      { id: "a", accion: null, error: null },
      { id: "b", accion: null, error: conflicto },
    ]);
  });

  it.each(["aprobar", "rechazar", "constancia"] as const)("otro error al %s → se queda con el error", (accion) => {
    const resultado = aplicarErrorAccion(tarjetas(accion), evento, accion, caida);
    expect(resultado.decidido).toBeNull();
    expect(resultado.tarjetas[1]).toEqual({ id: "b", accion: null, error: caida });
    expect(resultado.tarjetas[0]).toEqual({ id: "a", accion: null, error: null });
  });
});

describe("abrirConstancia", () => {
  const URL_FIRMADA = "https://x.supabase.co/storage/v1/object/sign/constancias/u/c.pdf?token=t";
  const pestanaFalsa = () => {
    const pestana: PestanaConstancia = { opener: {}, location: { href: "about:blank" }, close: vi.fn() };
    return pestana;
  };

  it("URL firmada → navega la pestaña abierta y le quita el opener", () => {
    const pestana = pestanaFalsa();
    const abrirNueva = vi.fn();
    expect(abrirConstancia({ url: URL_FIRMADA }, pestana, abrirNueva)).toBe("abierta");
    expect(pestana.location.href).toBe(URL_FIRMADA);
    expect(pestana.opener).toBeNull();
    expect(pestana.close).not.toHaveBeenCalled();
    expect(abrirNueva).not.toHaveBeenCalled();
  });

  it("URL firmada sin pestaña (bloqueada) → abre una nueva", () => {
    const abrirNueva = vi.fn();
    expect(abrirConstancia({ url: URL_FIRMADA }, null, abrirNueva)).toBe("abierta");
    expect(abrirNueva).toHaveBeenCalledWith(URL_FIRMADA);
  });

  it("url null → cierra la pestaña y Sin constancia", () => {
    const pestana = pestanaFalsa();
    expect(abrirConstancia({ url: null }, pestana, vi.fn())).toBe("sin-constancia");
    expect(pestana.close).toHaveBeenCalledOnce();
    expect(pestana.location.href).toBe("about:blank");
  });

  it("fallo de la API → cierra la pestaña", () => {
    const pestana = pestanaFalsa();
    const abrirNueva = vi.fn();
    expect(abrirConstancia(null, pestana, abrirNueva)).toBe("fallo");
    expect(pestana.close).toHaveBeenCalledOnce();
    expect(abrirNueva).not.toHaveBeenCalled();
    expect(abrirConstancia(null, null, abrirNueva)).toBe("fallo");
  });
});
