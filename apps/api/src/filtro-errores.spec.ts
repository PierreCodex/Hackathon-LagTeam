import {
  type ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FiltroErrores } from "./filtro-errores.js";

/** Ejecuta el filtro con una respuesta de Express simulada y devuelve estado y cuerpo. */
function filtrar(excepcion: unknown) {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  const filtro = new FiltroErrores();
  const logger = (filtro as unknown as { logger: { warn: () => void; error: () => void } }).logger;
  const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
  const error = vi.spyOn(logger, "error").mockImplementation(() => {});

  filtro.catch(excepcion, host);

  return { estado: res.status.mock.calls[0]?.[0], cuerpo: res.json.mock.calls[0]?.[0], warn, error };
}

describe("FiltroErrores", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("usa el código y el mensaje que trae la excepción", () => {
    const r = filtrar(new ForbiddenException({ codigo: "SIN_PERFIL", mensaje: "Sin perfil" }));
    expect(r.estado).toBe(403);
    expect(r.cuerpo).toEqual({ error: { codigo: "SIN_PERFIL", mensaje: "Sin perfil" } });
  });

  it("conserva `detalles` si la excepción los trae como objeto, y nunca otra cosa", () => {
    const con = filtrar(new ConflictException({ codigo: "ENTRADA_YA_USADA", mensaje: "Ya usada", detalles: { usada_en: "x" } }));
    expect(con.cuerpo).toEqual({ error: { codigo: "ENTRADA_YA_USADA", mensaje: "Ya usada", detalles: { usada_en: "x" } } });
    const lista = filtrar(new ConflictException({ codigo: "C", mensaje: "M", detalles: ["x"] }));
    expect(lista.cuerpo).toEqual({ error: { codigo: "C", mensaje: "M" } });
  });

  it("sin código propio, usa el del estado HTTP", () => {
    const r = filtrar(new NotFoundException());
    expect(r.estado).toBe(404);
    expect(r.cuerpo.error.codigo).toBe("NO_ENCONTRADO");
  });

  it("une los mensajes de validación para nombrar el campo que falla", () => {
    const r = filtrar(new BadRequestException(["rol: Opción no válida", "whatsapp: No válido"]));
    expect(r.estado).toBe(400);
    expect(r.cuerpo).toEqual({
      error: { codigo: "PETICION_INVALIDA", mensaje: "rol: Opción no válida; whatsapp: No válido" },
    });
  });

  it("un 500 conocido se registra con traza", () => {
    const r = filtrar(new InternalServerErrorException({ codigo: "ERROR_INTERNO", mensaje: "x" }));
    expect(r.estado).toBe(500);
    expect(r.error).toHaveBeenCalledOnce();
    expect(r.warn).not.toHaveBeenCalled();
  });

  it("un 503 se registra como aviso de una línea, sin traza", () => {
    const r = filtrar(
      new ServiceUnavailableException({ codigo: "AUTH_NO_DISPONIBLE", mensaje: "Auth no responde" }),
    );
    expect(r.estado).toBe(503);
    expect(r.warn).toHaveBeenCalledWith("AUTH_NO_DISPONIBLE: Auth no responde");
    expect(r.error).not.toHaveBeenCalled();
  });

  it("otros 5xx y errores desconocidos se registran con traza y salen como ERROR_INTERNO", () => {
    const r = filtrar(new Error("explotó"));
    expect(r.estado).toBe(500);
    expect(r.cuerpo).toEqual({
      error: { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" },
    });
    expect(r.error).toHaveBeenCalledOnce();
  });
});
