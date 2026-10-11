import { EventoIdSchema, RechazoEventoSchema, DestacadoEventoSchema } from "@reto18/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClienteSupabase } from "../supabase/supabase.module.js";
import { ArchivosEventos } from "./archivos-eventos.js";
import { EventosService, TIEMPO_LIMITE_BD_MS } from "./eventos.service.js";

function simular(respuestas: Array<{ data: unknown; error: unknown } | Error>, timeout = false) {
  const filtros: unknown[][] = [];
  const cambios: unknown[] = [];
  const ordenes: string[] = [];
  const from = vi.fn(() => {
    let senal: AbortSignal;
    const consulta = {
      select: () => consulta,
      update: (datos: unknown) => { cambios.push(datos); return consulta; },
      eq: (...args: unknown[]) => { filtros.push(args); return consulta; },
      order: (campo: string) => { ordenes.push(campo); return consulta; },
      abortSignal: (s: AbortSignal) => { senal = s; return consulta; },
      maybeSingle: () => consulta,
      then: (resolver: (v: unknown) => unknown, rechazar: (e: unknown) => unknown) => {
        if (timeout) return new Promise((_, reject) => senal.addEventListener("abort", () => reject(senal.reason))).then(resolver, rechazar);
        const siguiente = respuestas.shift();
        return (siguiente instanceof Error ? Promise.reject(siguiente) : Promise.resolve(siguiente)).then(resolver, rechazar);
      },
    };
    return consulta;
  });
  const archivos = { firmarConstancia: vi.fn(async () => "https://storage.test/firmada") };
  return {
    servicio: new EventosService({ from } as unknown as ClienteSupabase, archivos as unknown as ArchivosEventos),
    filtros, cambios, ordenes, archivos,
  };
}

describe("contratos de revisión", () => {
  it.each(["", " ", "x".repeat(601), null, 42])("rechaza motivo inválido %#", (motivo_rechazo) => {
    expect(RechazoEventoSchema.safeParse({ motivo_rechazo }).success).toBe(false);
  });
  it("recorta el motivo y admite sus dos límites", () => {
    expect(RechazoEventoSchema.parse({ motivo_rechazo: "  a  " }).motivo_rechazo).toBe("a");
    expect(RechazoEventoSchema.parse({ motivo_rechazo: "x".repeat(600) }).motivo_rechazo).toHaveLength(600);
  });
  it.each(["true", "false", 1, 0, null, undefined])("exige destacado booleano %#", (destacado) => {
    expect(DestacadoEventoSchema.safeParse({ destacado }).success).toBe(false);
  });
  it("valida UUID", () => {
    expect(EventoIdSchema.safeParse("no-es-uuid").success).toBe(false);
  });
});

describe("revisión administrativa", () => {
  afterEach(() => vi.restoreAllMocks());

  it("filtra pendientes y propios en servidor con orden estable", async () => {
    const s = simular([{ data: [], error: null }, { data: [], error: null }]);
    await s.servicio.listarPendientes();
    await s.servicio.listarPropios("organizador-token");
    expect(s.filtros).toEqual([["estado", "pendiente"], ["organizador_id", "organizador-token"]]);
    expect(s.ordenes).toEqual(["inicio", "id", "inicio", "id"]);
  });

  it("condiciona las decisiones y guarda todos sus campos juntos", async () => {
    const s = simular(Array.from({ length: 4 }, () => ({ data: { id: "evento" }, error: null })));
    await s.servicio.aprobar("evento");
    await s.servicio.rechazar("evento", "Falta constancia");
    await s.servicio.destacar("evento", true);
    await s.servicio.destacar("evento", false);
    expect(s.cambios).toEqual([
      { estado: "aprobado", motivo_rechazo: null },
      { estado: "rechazado", motivo_rechazo: "Falta constancia", destacado: false },
      { destacado: true }, { destacado: false },
    ]);
    expect(s.filtros.filter(([campo]) => campo === "estado")).toEqual([
      ["estado", "pendiente"], ["estado", "pendiente"], ["estado", "aprobado"], ["estado", "aprobado"],
    ]);
  });

  it("si no actualiza, distingue inexistencia y conflicto sin reintentar el UPDATE", async () => {
    for (const existe of [true, false]) {
      const s = simular([{ data: null, error: null }, { data: existe ? { id: "evento" } : null, error: null }]);
      await expect(s.servicio.aprobar("evento")).rejects.toMatchObject({
        status: existe ? 409 : 404,
        response: { codigo: existe ? "ESTADO_EVENTO_INCOMPATIBLE" : "EVENTO_NO_EXISTE" },
      });
      expect(s.cambios).toHaveLength(1);
    }
  });

  it("firma con el propietario leído, y no llama a Storage si no hay archivo", async () => {
    const s = simular([
      { data: { organizador_id: "propietario", constancia_apdayc_url: "privada" }, error: null },
      { data: { constancia_apdayc_url: null }, error: null },
    ]);
    expect(await s.servicio.constancia("evento")).toEqual({ url: "https://storage.test/firmada" });
    expect(s.archivos.firmarConstancia).toHaveBeenCalledWith("propietario", "privada");
    expect(await s.servicio.constancia("evento")).toEqual({ url: null });
    expect(s.archivos.firmarConstancia).toHaveBeenCalledTimes(1);
  });

  it.each(["listarPendientes", "listarPropios", "aprobar", "rechazar", "destacar", "constancia"] as const)(
    "%s transforma rechazos de red y errores PostgREST en 503", async (metodo) => {
      for (const respuesta of [new TypeError("fetch failed"), { data: null, error: { message: "BD caída" } }]) {
        const s = simular([respuesta]);
        const ejecutar = () => metodo === "rechazar" ? s.servicio.rechazar("id", "motivo")
          : metodo === "destacar" ? s.servicio.destacar("id", true)
          : s.servicio[metodo]("id");
        await expect(ejecutar()).rejects.toMatchObject({ status: 503, response: { codigo: "BD_NO_DISPONIBLE" } });
      }
    },
  );

  it("aborta una consulta que no responde en diez segundos", async () => {
    const controlador = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controlador.signal);
    const s = simular([], true);
    const resultado = s.servicio.listarPendientes();
    const comprobacion = expect(resultado).rejects.toMatchObject({ status: 503 });
    await Promise.resolve();
    controlador.abort();
    await comprobacion;
    expect(timeout).toHaveBeenCalledWith(TIEMPO_LIMITE_BD_MS);
    expect(TIEMPO_LIMITE_BD_MS).toBe(10_000);
  });
});
