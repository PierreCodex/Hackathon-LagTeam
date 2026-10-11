import { HttpException } from "@nestjs/common";
import { CODIGOS_ACCESO } from "@reto18/shared";
import { describe, expect, it, vi } from "vitest";
import type { UsuarioAutenticado } from "../identidad/roles.js";
import { FirmaQr, firmarQr } from "../ventas/qr.js";
import type { ResultadoConsumo, VentasService } from "../ventas/ventas.service.js";
import { AccesoService } from "./acceso.service.js";

const SECRETO = "secreto-de-prueba-con-longitud-suficiente";
const DUENO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENTO = "11111111-1111-4111-8111-111111111111";
const ENTRADA = "33333333-3333-4333-8333-333333333333";
const QR = firmarQr(ENTRADA, SECRETO);
const USADA = "2026-10-11T20:00:00+00:00";

function usuario(id: string, rol: "organizador" | "admin"): UsuarioAutenticado {
  return { id, correo: "x@prueba.local", perfil: { rol, whatsapp: "+51987654321" } as UsuarioAutenticado["perfil"] };
}

function servicio(consumo: ResultadoConsumo = { estado: "aceptada", usada_en: USADA }, organizador: string | null = DUENO) {
  const ventas = {
    organizadorDelEvento: vi.fn(async () => organizador),
    consumirEntrada: vi.fn(async () => consumo),
  };
  return { acceso: new AccesoService(ventas as unknown as VentasService, new FirmaQr(SECRETO)), ventas };
}

async function codigo(promesa: Promise<unknown>): Promise<[number, unknown]> {
  const error = (await promesa.then(() => undefined, (e: unknown) => e)) as HttpException;
  return [error.getStatus(), error.getResponse()];
}

describe("AccesoService.validar", () => {
  it("el organizador dueño acepta un QR válido y consume la entrada de ese evento", async () => {
    const { acceso, ventas } = servicio();
    await expect(acceso.validar(usuario(DUENO, "organizador"), EVENTO, QR)).resolves.toEqual({
      resultado: "aceptada", entrada_id: ENTRADA, evento_id: EVENTO, usada_en: USADA,
    });
    expect(ventas.consumirEntrada).toHaveBeenCalledWith(ENTRADA, EVENTO);
  });

  it("un admin valida en cualquier evento", async () => {
    const { acceso } = servicio();
    await expect(acceso.validar(usuario("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "admin"), EVENTO, QR)).resolves.toMatchObject({ resultado: "aceptada" });
  });

  it("un organizador ajeno o un evento inexistente → 404 EVENTO_NO_ENCONTRADO sin consumir", async () => {
    for (const [organizador, quien] of [[DUENO, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"], [null, DUENO]] as const) {
      const { acceso, ventas } = servicio(undefined, organizador);
      const [estado, cuerpo] = await codigo(acceso.validar(usuario(quien, "organizador"), EVENTO, QR));
      expect(estado).toBe(404);
      expect(cuerpo).toMatchObject({ codigo: CODIGOS_ACCESO.EVENTO_NO_ENCONTRADO });
      expect(ventas.consumirEntrada).not.toHaveBeenCalled();
    }
  });

  it("QR con firma falsa o formato roto → 400 QR_INVALIDO sin consumir", async () => {
    for (const qr of [firmarQr(ENTRADA, "otro-secreto"), "basura", `${ENTRADA}.`]) {
      const { acceso, ventas } = servicio();
      const [estado, cuerpo] = await codigo(acceso.validar(usuario(DUENO, "organizador"), EVENTO, qr));
      expect(estado).toBe(400);
      expect(cuerpo).toMatchObject({ codigo: CODIGOS_ACCESO.QR_INVALIDO });
      expect(ventas.consumirEntrada).not.toHaveBeenCalled();
    }
  });

  it.each([
    [{ estado: "ya_usada", usada_en: USADA }, 409, { codigo: CODIGOS_ACCESO.ENTRADA_YA_USADA, detalles: { usada_en: USADA } }],
    [{ estado: "otro_evento" }, 409, { codigo: CODIGOS_ACCESO.ENTRADA_DE_OTRO_EVENTO }],
    [{ estado: "no_existe" }, 400, { codigo: CODIGOS_ACCESO.QR_INVALIDO }],
  ] as const)("consumo %# → %s", async (consumo, estadoEsperado, cuerpoEsperado) => {
    const { acceso } = servicio(consumo as ResultadoConsumo);
    const [estado, cuerpo] = await codigo(acceso.validar(usuario(DUENO, "organizador"), EVENTO, QR));
    expect(estado).toBe(estadoEsperado);
    expect(cuerpo).toMatchObject(cuerpoEsperado);
  });
});
