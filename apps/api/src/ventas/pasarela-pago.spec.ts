import type { MetodoPago } from "@reto18/shared";
import { describe, expect, it } from "vitest";
import { PasarelaPagoSimulada } from "./pasarela-pago.js";

const ORDEN = "11111111-1111-4111-8111-111111111111";

describe("PasarelaPagoSimulada (AD-6)", () => {
  it.each(["tarjeta", "yape", "plin"] as const)("confirma un cobro con %s y da una referencia única", async (metodo) => {
    const pasarela = new PasarelaPagoSimulada();
    const a = await pasarela.cobrar({ orden_id: ORDEN, importe_centimos: 4000, metodo });
    const b = await pasarela.cobrar({ orden_id: ORDEN, importe_centimos: 4000, metodo });
    expect(a.referencia).toMatch(new RegExp(`^sim_${metodo}_[0-9a-f-]{36}$`));
    expect(a.referencia).not.toBe(b.referencia);
  });

  it("acepta un cobro de 0 céntimos (entrada libre)", async () => {
    await expect(new PasarelaPagoSimulada().cobrar({ orden_id: ORDEN, importe_centimos: 0, metodo: "yape" })).resolves.toHaveProperty("referencia");
  });

  it.each([-1, 10.5, Number.NaN])("rechaza un importe no válido (%s)", async (importe) => {
    await expect(new PasarelaPagoSimulada().cobrar({ orden_id: ORDEN, importe_centimos: importe, metodo: "plin" })).rejects.toThrow();
  });

  it("rechaza un método desconocido", async () => {
    await expect(
      new PasarelaPagoSimulada().cobrar({ orden_id: ORDEN, importe_centimos: 100, metodo: "efectivo" as MetodoPago }),
    ).rejects.toThrow();
  });

  it("anula una referencia suya y rechaza una ajena", async () => {
    const pasarela = new PasarelaPagoSimulada();
    const { referencia } = await pasarela.cobrar({ orden_id: ORDEN, importe_centimos: 100, metodo: "tarjeta" });
    await expect(pasarela.anular(referencia)).resolves.toBeUndefined();
    await expect(pasarela.anular("otra_pasarela_123")).rejects.toThrow();
  });
});
