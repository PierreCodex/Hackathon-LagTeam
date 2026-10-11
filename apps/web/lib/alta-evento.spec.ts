import { AltaEventoSchema, CODIGOS_EVENTOS, TIPOS_CONSTANCIA_EVENTO, TIPOS_FOTO_EVENTO } from "@reto18/shared";
import { describe, expect, it } from "vitest";
import {
  CLAVE_BORRADOR_ALTA,
  construirAlta,
  envioIncierto,
  estadoInicialAlta,
  inicioLima,
  leerBorrador,
  MENSAJE_FALTA_CONSTANCIA,
  pasoDeErrorApi,
  primerCampoConError,
  serializarBorrador,
  solesACentimos,
  validarAlta,
  validarArchivo,
  validarPaso,
  type EstadoAlta,
} from "./alta-evento";

const AHORA = Date.parse("2026-10-10T12:00:00-05:00");
const SEDE_SEMBRADA = "11111111-1111-4111-8111-111111111111";
const SEDES = [
  { id: SEDE_SEMBRADA, nombre: "Teatro Municipal", direccion: "Av. Grau 100", distrito: "Piura", capacidad: 643, propia: true },
];
const FOTO = { size: 1024, type: "image/jpeg", name: "foto.jpg" };
const PDF = { size: 2048, type: "application/pdf", name: "constancia.pdf" };

/** Alta completa con sede nueva de 120, 2 categorías, foto y sin música. */
function estadoValido(cambios: Partial<EstadoAlta> = {}): EstadoAlta {
  return {
    ...estadoInicialAlta(),
    titulo: "La última función",
    categoria: "teatro",
    fecha: "2099-10-24T20:00",
    foto: FOTO,
    tipoSede: "nueva",
    sedeNombre: "Casa de la Cultura",
    sedeDireccion: "Jr. Lima 200",
    sedeDistrito: "Castilla",
    sedeCapacidad: "120",
    aforo: "100",
    categorias: [
      { nombre: "General", precio: "25" },
      { nombre: "Estudiantes", precio: "12.50" },
    ],
    descripcion: "Una comedia sobre una compañía de teatro de Piura. Dos actos y mucha música en vivo.",
    hayMusica: false,
    ...cambios,
  };
}

describe("solesACentimos", () => {
  it("convierte soles a céntimos enteros", () => {
    expect(solesACentimos("25")).toBe(2500);
    expect(solesACentimos("12.50")).toBe(1250);
    expect(solesACentimos("12,5")).toBe(1250);
    expect(solesACentimos(" 0 ")).toBe(0);
    expect(solesACentimos("0.07")).toBe(7);
  });

  it("rechaza negativos, más de 2 decimales y texto", () => {
    for (const malo of ["12,555", "-5", "", "abc", "1.2.3", "12.", ".5", "1e3"]) {
      expect(solesACentimos(malo), malo).toBeNull();
    }
  });
});

describe("inicioLima", () => {
  it("añade la zona de Lima (-05:00)", () => {
    expect(inicioLima("2026-10-24T20:00")).toBe("2026-10-24T20:00:00-05:00");
    expect(inicioLima("2026-10-24T20:00:30")).toBe("2026-10-24T20:00:30-05:00");
  });

  it("el resultado lo acepta el esquema y es el instante correcto", () => {
    const iso = inicioLima("2099-10-24T20:00")!;
    expect(AltaEventoSchema.shape.inicio.safeParse(iso).success).toBe(true);
    expect(new Date(iso).toISOString()).toBe("2099-10-25T01:00:00.000Z");
  });

  it("rechaza fechas imposibles o mal escritas", () => {
    expect(inicioLima("2026-02-31T20:00")).toBeNull();
    expect(inicioLima("2026-10-24T25:00")).toBeNull();
    expect(inicioLima("24/10/2026 20:00")).toBeNull();
    expect(inicioLima("")).toBeNull();
  });
});

describe("validarArchivo", () => {
  it("acepta una foto JPG y una constancia PDF", () => {
    expect(validarArchivo(FOTO, TIPOS_FOTO_EVENTO)).toBeNull();
    expect(validarArchivo(PDF, TIPOS_CONSTANCIA_EVENTO)).toBeNull();
  });

  it("rechaza una foto de 6 MB", () => {
    expect(validarArchivo({ size: 6 * 1024 * 1024, type: "image/png" }, TIPOS_FOTO_EVENTO)).toMatch(/5 MB/);
  });

  it("rechaza un PDF como foto y nombra los tipos válidos", () => {
    expect(validarArchivo(PDF, TIPOS_FOTO_EVENTO)).toBe("Ese archivo no sirve. Sube un JPG, PNG o WebP.");
  });
});

describe("validarPaso", () => {
  it("un alta válida no tiene errores en ningún paso", () => {
    const estado = estadoValido();
    for (const paso of ["datos", "sede", "entradas", "descripcion", "musica"] as const) {
      expect(validarPaso(paso, estado, { ahora: AHORA }), paso).toEqual({});
    }
  });

  it("título vacío y fecha pasada: error junto a cada campo y foco en el primero", () => {
    const estado = estadoValido({ titulo: "  ", fecha: "2026-10-01T20:00" });
    const errores = validarPaso("datos", estado, { ahora: AHORA });
    expect(errores.titulo).toBe("Escribe el título del evento.");
    expect(errores.fecha).toBe("La fecha tiene que ser futura.");
    expect(primerCampoConError("datos", estado, errores)).toBe("titulo");
  });

  it("sin foto, o con un archivo no válido, no avanza", () => {
    expect(validarPaso("datos", estadoValido({ foto: null }), { ahora: AHORA }).foto).toBe("Sube una foto del evento.");
    expect(validarPaso("datos", estadoValido({ foto: PDF }), { ahora: AHORA }).foto).toMatch(/JPG/);
    expect(
      validarPaso("datos", estadoValido({ foto: { size: 6 * 1024 * 1024, type: "image/jpeg" } }), { ahora: AHORA }).foto,
    ).toMatch(/5 MB/);
  });

  it("sede existente: hay que elegir una y el aforo no pasa su capacidad", () => {
    const sinElegir = estadoValido({ tipoSede: "existente", sedeId: "" });
    expect(validarPaso("sede", sinElegir, { sedes: SEDES }).sede).toBeDefined();
    const excedido = estadoValido({ tipoSede: "existente", sedeId: SEDE_SEMBRADA, aforo: "700" });
    expect(validarPaso("sede", excedido, { sedes: SEDES }).aforo).toBe(
      "El aforo no puede pasar de 643, la capacidad de la sede.",
    );
    expect(validarPaso("sede", { ...excedido, aforo: "500" }, { sedes: SEDES })).toEqual({});
  });

  it("sede de un borrador que ya no está en la lista: hay que elegir otra", () => {
    const otra = estadoValido({ tipoSede: "existente", sedeId: "22222222-2222-4222-8222-222222222222", aforo: "50" });
    expect(validarPaso("sede", otra, { sedes: SEDES }).sede).toBeDefined();
    expect(validarPaso("sede", otra, { sedes: [] }).sede).toBeDefined();
  });

  it("sede nueva: campos obligatorios y aforo ≤ capacidad", () => {
    const errores = validarPaso("sede", estadoValido({ sedeNombre: "", sedeCapacidad: "cien", aforo: "0" }));
    expect(Object.keys(errores)).toEqual(["sede-nombre", "sede-capacidad", "aforo"]);
    expect(validarPaso("sede", estadoValido({ aforo: "150" })).aforo).toMatch(/120/);
  });

  it("entradas: precios mal escritos y nombres repetidos", () => {
    const estado = estadoValido({
      categorias: [
        { nombre: "General", precio: "12,555" },
        { nombre: "general", precio: "-5" },
      ],
    });
    const errores = validarPaso("entradas", estado);
    expect(errores["categoria-0-precio"]).toMatch(/12.50/);
    expect(errores["categoria-1-nombre"]).toBe("Ya tienes una categoría con ese nombre.");
    expect(errores["categoria-1-precio"]).toBeDefined();
    expect(primerCampoConError("entradas", estado, errores)).toBe("categoria-0-precio");
  });

  it("descripción de menos de 20 caracteres", () => {
    expect(validarPaso("descripcion", estadoValido({ descripcion: "Muy corta" })).descripcion).toBe(
      "Escribe al menos 20 caracteres (llevas 9).",
    );
  });

  it("música sin constancia: el motivo de APDAYC", () => {
    expect(validarPaso("musica", estadoValido({ hayMusica: true, constancia: null })).constancia).toBe(
      MENSAJE_FALTA_CONSTANCIA,
    );
    expect(validarPaso("musica", estadoValido({ hayMusica: true, constancia: PDF }))).toEqual({});
    expect(validarPaso("musica", estadoValido({ hayMusica: null }))["hay-musica"]).toBeDefined();
  });
});

describe("construirAlta", () => {
  it("alta con sede nueva: céntimos, hora de Lima y cumple AltaEventoSchema", () => {
    const alta = construirAlta(estadoValido());
    expect(alta).toEqual({
      titulo: "La última función",
      categoria: "teatro",
      descripcion: expect.any(String),
      inicio: "2099-10-24T20:00:00-05:00",
      aforo: 100,
      hay_musica: false,
      sede: { tipo: "nueva", nombre: "Casa de la Cultura", direccion: "Jr. Lima 200", distrito: "Castilla", capacidad: 120 },
      categorias: [
        { nombre: "General", precio_centimos: 2500 },
        { nombre: "Estudiantes", precio_centimos: 1250 },
      ],
    });
    expect(AltaEventoSchema.safeParse(alta).success).toBe(true);
  });

  it("alta con sede existente y música", () => {
    const resultado = validarAlta(
      estadoValido({ tipoSede: "existente", sedeId: SEDE_SEMBRADA, aforo: "500", hayMusica: true, constancia: PDF }),
      { sedes: SEDES },
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.datos.sede).toEqual({ tipo: "existente", sede_id: SEDE_SEMBRADA });
      expect(resultado.datos.hay_musica).toBe(true);
    }
  });

  it("validarAlta devuelve el primer paso con errores", () => {
    const resultado = validarAlta(estadoValido({ foto: null, descripcion: "" }));
    expect(resultado).toMatchObject({ ok: false, paso: "datos", errores: { foto: expect.any(String) } });
  });
});

describe("pasoDeErrorApi", () => {
  it("cada código vuelve a su paso", () => {
    const de = (codigo: string, mensaje = "x") => pasoDeErrorApi({ codigo, mensaje });
    expect(de(CODIGOS_EVENTOS.AFORO_SUPERA_SEDE)).toBe("sede");
    expect(de(CODIGOS_EVENTOS.SEDE_NO_EXISTE)).toBe("sede");
    expect(de(CODIGOS_EVENTOS.MUSICA_SIN_CONSTANCIA)).toBe("musica");
    expect(de(CODIGOS_EVENTOS.ARCHIVO_NO_VALIDO, "constancia: no es PDF")).toBe("musica");
    expect(de(CODIGOS_EVENTOS.ARCHIVO_NO_VALIDO, "foto: falta")).toBe("datos");
    expect(de(CODIGOS_EVENTOS.ARCHIVO_NO_VALIDO, "La constancia no es PDF ni imagen")).toBe("musica");
    expect(de(CODIGOS_EVENTOS.ARCHIVO_NO_VALIDO, "El archivo pasa de 5 MB")).toBeNull();
    expect(de(CODIGOS_EVENTOS.DATOS_INVALIDOS, "categorias.0.nombre: repetido")).toBe("entradas");
    expect(de(CODIGOS_EVENTOS.DATOS_INVALIDOS, "descripcion: corta")).toBe("descripcion");
    expect(de("SIN_CONEXION")).toBeNull();
    expect(de(CODIGOS_EVENTOS.STORAGE_NO_DISPONIBLE)).toBeNull();
  });
});

describe("envioIncierto", () => {
  const sinConexion = { codigo: "SIN_CONEXION", mensaje: "x" };
  it("cortado por tiempo: incierto, no se ofrece Reintentar", () => {
    expect(envioIncierto(sinConexion, 60_000, 60_000)).toBe(true);
  });
  it("sin conexión desde el principio, u otro error: se puede reintentar", () => {
    expect(envioIncierto(sinConexion, 300, 60_000)).toBe(false);
    expect(envioIncierto({ codigo: "AFORO_SUPERA_SEDE", mensaje: "x" }, 60_000, 60_000)).toBe(false);
  });
});

describe("borrador", () => {
  it("guarda los textos y el paso, sin archivos, y los recupera", () => {
    const estado = estadoValido({ hayMusica: true, constancia: PDF });
    const crudo = serializarBorrador(estado, "entradas");
    expect(crudo).not.toContain("foto.jpg");
    expect(crudo).not.toContain("constancia.pdf");
    const { estado: recuperado, paso } = leerBorrador(crudo);
    expect(paso).toBe("entradas");
    expect(recuperado).toEqual({ ...estado, foto: null, constancia: null });
  });

  it("un borrador roto o ausente da el estado inicial", () => {
    expect(leerBorrador(null)).toEqual({ estado: estadoInicialAlta(), paso: "datos" });
    expect(leerBorrador("{no es json")).toEqual({ estado: estadoInicialAlta(), paso: "datos" });
    expect(leerBorrador(JSON.stringify({ titulo: 5, paso: "otro" })).paso).toBe("datos");
    expect(CLAVE_BORRADOR_ALTA).toMatch(/alta-evento/);
  });
});
