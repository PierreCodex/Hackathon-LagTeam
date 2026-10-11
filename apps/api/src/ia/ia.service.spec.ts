import { type EntradaTextosYCampana, JSON_SCHEMA_RESPUESTA_IA_TEXTOS_Y_CAMPANA, TextosYCampanaSchema } from "@reto18/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdaptadorOllama, tiempoLimiteIa, urlBaseOllama } from "./adaptador-ollama.js";
import { calendarioDesde, type LlamarProveedor, respaldoTextosYCampana, textosYCampana } from "./funciones/textos-y-campana.js";
import { IaService } from "./ia.service.js";

const ENTRADA: EntradaTextosYCampana = {
  titulo: "Noche de música piurana",
  descripcion: "Concierto de artistas locales.",
  categoria: "musica",
  inicio: "2026-10-16T20:00:00-05:00",
  sede: "Teatro de ejemplo de Piura",
  direccion: "Jr. Prueba 123",
  distrito: "Piura",
  precio_minimo_centimos: 4000,
};
const AHORA = new Date("2026-10-10T12:00:00-05:00");

const RESPUESTA_IA = {
  textos: {
    titular: "La música de Piura suena fuerte",
    subtitulo: "Una noche con artistas de casa",
    llamado: "Separa tu entrada",
    descripcion: "Ven con tus amigos a disfrutar de la música piurana en vivo.",
  },
  paleta: { fondo: "#111111", texto: "#FFFFFF", acento: "#FFCC00" },
  campana: {
    publico: "Jóvenes de Piura de 18 a 35 años",
    reparto: [
      { red: "instagram", soles: 40 },
      { red: "facebook", soles: 20 },
      { red: "instagram", soles: 10 },
    ],
    calendario: [
      { dias_antes: 2, hora: "19:00", accion: "Historia en Instagram" },
      { dias_antes: 5, hora: "18:30", accion: "Publicación en el feed" },
      { dias_antes: 20, hora: "10:00", accion: "Ya pasó" },
    ],
    resumen: "Invierte 70 soles, sobre todo en Instagram.",
  },
};

function respuestaOllama(contenido: unknown, estado = 200): Response {
  return new Response(JSON.stringify({ message: { role: "assistant", content: JSON.stringify(contenido) } }), {
    status: estado,
    headers: { "Content-Type": "application/json" },
  });
}

describe("textosYCampana", () => {
  it("con una respuesta válida: origen ia, total del reparto y fechas desde el inicio en Lima", async () => {
    const llamar = vi.fn<LlamarProveedor>(async () => RESPUESTA_IA);
    const { origen, valor } = await textosYCampana(ENTRADA, llamar, () => {}, AHORA);

    expect(origen).toBe("ia");
    expect(TextosYCampanaSchema.parse(valor)).toEqual(valor);
    expect(valor.textos.titular).toBe("La música de Piura suena fuerte");
    expect(valor.campana.reparto).toEqual([
      { red: "instagram", soles: 50 },
      { red: "facebook", soles: 20 },
    ]);
    expect(valor.campana.presupuesto_total_soles).toBe(70);
    // 20 días antes ya pasó: se descarta.
    expect(valor.campana.calendario).toEqual([
      { dias_antes: 5, hora: "18:30", accion: "Publicación en el feed", fecha: "2026-10-11" },
      { dias_antes: 2, hora: "19:00", accion: "Historia en Instagram", fecha: "2026-10-14" },
    ]);
    const peticion = llamar.mock.calls[0]![0] as { usuario: string; formato: unknown };
    expect(peticion.formato).toBe(JSON_SCHEMA_RESPUESTA_IA_TEXTOS_Y_CAMPANA);
    expect(peticion.usuario).toContain("Teatro de ejemplo de Piura");
    expect(peticion.usuario).toContain("viernes 16 de octubre, 20:00");
  });

  it("si el proveedor lanza o responde fuera del esquema: respaldo y un aviso", async () => {
    for (const llamar of [
      async () => {
        throw new Error("conexión rechazada");
      },
      async () => ({ ...RESPUESTA_IA, paleta: { fondo: "rojo" } }),
    ]) {
      const avisar = vi.fn();
      const { origen, valor } = await textosYCampana(ENTRADA, llamar, avisar, AHORA);
      expect(origen).toBe("respaldo");
      expect(valor).toEqual(respaldoTextosYCampana(ENTRADA, AHORA));
      expect(avisar).toHaveBeenCalledOnce();
    }
  });

  it("evento gratuito: los textos dicen «Entrada libre», con IA y con respaldo", async () => {
    const gratis = { ...ENTRADA, precio_minimo_centimos: 0 };
    const conIa = await textosYCampana(gratis, async () => RESPUESTA_IA, () => {}, AHORA);
    expect(conIa.valor.textos.llamado).toBe("Entrada libre");
    const respaldo = respaldoTextosYCampana(gratis, AHORA);
    expect(respaldo.textos.llamado).toBe("Entrada libre");
    expect(respaldo.textos.descripcion).toContain("Entrada libre");
  });
});

describe("textosYCampana: reglas sobre la salida del modelo (AD-11)", () => {
  const conTextos = (cambio: Partial<typeof RESPUESTA_IA.textos>) => ({
    ...RESPUESTA_IA,
    textos: { ...RESPUESTA_IA.textos, ...cambio },
  });
  const conReparto = (reparto: { red: string; soles: number }[]) => ({
    ...RESPUESTA_IA,
    campana: { ...RESPUESTA_IA.campana, reparto },
  });
  const origen = async (respuesta: unknown, entrada: EntradaTextosYCampana = ENTRADA) =>
    (await textosYCampana(entrada, async () => respuesta, () => {}, AHORA)).origen;

  it.each([
    ["titular", "Entradas a S/ 10"],
    ["subtitulo", "Desde 10 soles por persona"],
    ["descripcion", "Cuesta 40.00 y vale la pena."],
    ["llamado", "Te esperamos a las 20:00"],
    ["subtitulo", "Empieza a las 8.30 en punto"],
  ] as const)("si %s trae precio u hora («%s»): respaldo", async (campo, texto) => {
    expect(await origen(conTextos({ [campo]: texto }))).toBe("respaldo");
  });

  it("los nombres de días y meses no cuentan como fecha", async () => {
    expect(await origen(conTextos({ subtitulo: "Este viernes de octubre, música en vivo" }))).toBe("ia");
  });

  it.each(["Entrada libre para todos", "¡Gratis!", "Un concierto gratuito"])(
    "evento de pago anunciado como gratis («%s»): respaldo",
    async (texto) => {
      expect(await origen(conTextos({ descripcion: texto }))).toBe("respaldo");
    },
  );

  it("evento gratuito: «Entrada libre» en el llamado aunque otro texto ya lo diga; si el llamado lo dice, se respeta", async () => {
    const gratis = { ...ENTRADA, precio_minimo_centimos: 0 };
    const otro = await textosYCampana(gratis, async () => conTextos({ descripcion: "Entrada libre para toda la familia." }), () => {}, AHORA);
    expect(otro.origen).toBe("ia");
    expect(otro.valor.textos.llamado).toBe("Entrada libre");
    const propio = await textosYCampana(gratis, async () => conTextos({ llamado: "Entrada libre: ven temprano" }), () => {}, AHORA);
    expect(propio.valor.textos.llamado).toBe("Entrada libre: ven temprano");
  });

  it.each([
    ["total menor de 30", [{ red: "instagram", soles: 29 }]],
    ["total mayor de 150", [{ red: "instagram", soles: 100 }, { red: "facebook", soles: 51 }]],
    ["una red con 0 soles", [{ red: "instagram", soles: 50 }, { red: "facebook", soles: 0 }]],
  ])("presupuesto con %s: respaldo", async (_caso, reparto) => {
    expect(await origen(conReparto(reparto))).toBe("respaldo");
  });

  it("presupuesto en los límites (30 y 150): origen ia", async () => {
    expect(await origen(conReparto([{ red: "instagram", soles: 30 }]))).toBe("ia");
    expect(await origen(conReparto([{ red: "instagram", soles: 100 }, { red: "tiktok", soles: 50 }]))).toBe("ia");
  });
});

describe("respaldoTextosYCampana", () => {
  it("contiene la fecha, la sede y el precio reales, y la campaña de plantilla", () => {
    const { textos, paleta, campana } = respaldoTextosYCampana(ENTRADA, AHORA);
    expect(textos.titular).toBe(ENTRADA.titulo);
    expect(textos.subtitulo).toBe("viernes 16 de octubre, 20:00 · Teatro de ejemplo de Piura · Entradas desde S/ 40.00");
    expect(textos.descripcion).toContain("viernes 16 de octubre, 20:00");
    expect(textos.descripcion).toContain("Teatro de ejemplo de Piura (Jr. Prueba 123, Piura)");
    expect(textos.descripcion).toContain("S/ 40.00");
    expect(paleta).toEqual({ fondo: "#1E1B4B", texto: "#FFFFFF", acento: "#F59E0B" });
    expect(campana.presupuesto_total_soles).toBe(50);
    expect(campana.reparto).toEqual([
      { red: "instagram", soles: 30 },
      { red: "facebook", soles: 20 },
    ]);
    expect(campana.calendario.map((p) => [p.fecha, p.hora])).toEqual([
      ["2026-10-11", "19:00"],
      ["2026-10-14", "19:00"],
      ["2026-10-16", "18:00"],
    ]);
    expect(campana.resumen).toContain("Invierte 50 soles: 30 en Instagram y 20 en Facebook");
  });

  it("sin categorías (precio null): llamado «No te lo pierdas» y sin precio en los textos", () => {
    const { textos } = respaldoTextosYCampana({ ...ENTRADA, precio_minimo_centimos: null }, AHORA);
    expect(textos.llamado).toBe("No te lo pierdas");
    expect(textos.subtitulo).not.toContain("S/");
  });

  it("si todas las fechas pasaron, deja una publicación el mismo día", () => {
    const calendario = calendarioDesde(ENTRADA.inicio, [{ dias_antes: 5, hora: "19:00", accion: "x" }], new Date("2026-10-16T09:00:00-05:00"));
    expect(calendario).toEqual([expect.objectContaining({ dias_antes: 0, fecha: "2026-10-16" })]);
  });
});

describe("urlBaseOllama", () => {
  it("quita las barras finales y un /api final", () => {
    expect(urlBaseOllama("http://o:11434/")).toBe("http://o:11434");
    expect(urlBaseOllama("http://o:11434/api")).toBe("http://o:11434");
    expect(urlBaseOllama(" http://o:11434/api/ ")).toBe("http://o:11434");
    expect(urlBaseOllama("https://tunel.example/API//")).toBe("https://tunel.example");
    expect(urlBaseOllama("https://tunel.example/apis")).toBe("https://tunel.example/apis");
    expect(urlBaseOllama("")).toBeUndefined();
    expect(urlBaseOllama(undefined)).toBeUndefined();
  });
});

describe("IaService con Ollama (fetch simulado)", () => {
  const entorno = { ...process.env };
  let servicio: IaService;

  beforeEach(() => {
    process.env.OLLAMA_URL = "http://ollama.prueba:11434/api/";
    process.env.OLLAMA_MODELO = "modelo-prueba";
    delete process.env.IA_TIEMPO_LIMITE_MS;
    servicio = new IaService(new AdaptadorOllama());
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...entorno };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("éxito: llama a /api/chat sin streaming, con el modelo y el format, y devuelve origen ia", async () => {
    const fetchSimulado = vi.fn(async () => respuestaOllama(RESPUESTA_IA));
    vi.stubGlobal("fetch", fetchSimulado);

    const { origen } = await servicio.textosYCampana(ENTRADA);

    expect(origen).toBe("ia");
    const [url, opciones] = fetchSimulado.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://ollama.prueba:11434/api/chat");
    const cuerpo = JSON.parse(String(opciones.body));
    expect(cuerpo).toMatchObject({ model: "modelo-prueba", stream: false, format: JSON_SCHEMA_RESPUESTA_IA_TEXTOS_Y_CAMPANA });
    expect(opciones.signal).toBeInstanceOf(AbortSignal);
  });

  it("tiempo límite: respaldo en cuanto vence IA_TIEMPO_LIMITE_MS", async () => {
    process.env.IA_TIEMPO_LIMITE_MS = "50";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, opciones: RequestInit) =>
          new Promise<Response>((_resolver, rechazar) => {
            opciones.signal?.addEventListener("abort", () => rechazar(opciones.signal?.reason));
          }),
      ),
    );
    const antes = Date.now();
    const { origen, valor } = await servicio.textosYCampana(ENTRADA);
    expect(origen).toBe("respaldo");
    expect(Date.now() - antes).toBeLessThan(1000);
    expect(valor.textos.descripcion).toContain("S/ 40.00");
  });

  it("JSON inválido en el contenido o HTTP 500: respaldo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: { content: "{roto" } }), { status: 200 })),
    );
    expect((await servicio.textosYCampana(ENTRADA)).origen).toBe("respaldo");
    vi.stubGlobal("fetch", vi.fn(async () => respuestaOllama(RESPUESTA_IA, 500)));
    expect((await servicio.textosYCampana(ENTRADA)).origen).toBe("respaldo");
  });

  it("sin OLLAMA_URL: respaldo sin llamar a la red", async () => {
    delete process.env.OLLAMA_URL;
    const fetchSimulado = vi.fn();
    vi.stubGlobal("fetch", fetchSimulado);
    const { origen, valor } = await servicio.textosYCampana(ENTRADA);
    expect(origen).toBe("respaldo");
    expect(fetchSimulado).not.toHaveBeenCalled();
    expect(valor.textos.subtitulo).toContain("viernes 16 de octubre");
    expect(valor.textos.subtitulo).toContain("Teatro de ejemplo de Piura");
  });

  it("IA_TIEMPO_LIMITE_MS: 30 s por defecto y valores no válidos ignorados", () => {
    expect(tiempoLimiteIa({})).toBe(30_000);
    expect(tiempoLimiteIa({ IA_TIEMPO_LIMITE_MS: "abc" })).toBe(30_000);
    for (const valor of ["0", "-5", "1.5", "2147483648", "1e10"]) {
      expect(tiempoLimiteIa({ IA_TIEMPO_LIMITE_MS: valor })).toBe(30_000);
    }
    expect(tiempoLimiteIa({ IA_TIEMPO_LIMITE_MS: "1" })).toBe(1);
    expect(tiempoLimiteIa({ IA_TIEMPO_LIMITE_MS: "2147483647" })).toBe(2_147_483_647);
    expect(tiempoLimiteIa({ IA_TIEMPO_LIMITE_MS: "1500" })).toBe(1500);
  });
});
