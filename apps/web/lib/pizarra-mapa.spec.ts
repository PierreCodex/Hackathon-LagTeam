import { CODIGOS_EVENTOS, LIMITES_MAPA, type ErrorApi, type MapaSede } from "@reto18/shared";
import { describe, expect, it } from "vitest";
import {
  agregarAsiento,
  agregarBloque,
  aMapaEntrada,
  aMapaInicial,
  ANCHO_PASILLO,
  campoDelError,
  campoDeRuta,
  crearFila,
  crearSeccion,
  estadoDeErrorGuardado,
  estadoInicialPizarra,
  idCampoFilaNombre,
  idCampoSeccionNombre,
  numerosDeFila,
  quitarAsiento,
  quitarBloque,
  quitarFila,
  quitarSeccion,
  validarMapa,
  type EstadoPizarra,
} from "./pizarra-mapa";

/** Croquis pequeño de ejemplo: una sección numerada con una fila de dos bloques, y una zona general. */
const MAPA_EJEMPLO: MapaSede = {
  id: "11111111-1111-4111-8111-111111111111",
  nombre: "Teatro Municipal",
  direccion: "Av. Grau 100",
  distrito: "Piura",
  secciones: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      tipo: "numerada",
      nombre: "Platea",
      orden: 1,
      capacidad: null,
      filas: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          nombre: "A",
          orden: 1,
          bloques: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              orden: 1,
              desplazamiento: 0,
              asientos: [
                { id: "55555555-5555-4555-8555-555555555555", numero: 1 },
                { id: "66666666-6666-4666-8666-666666666666", numero: 2 },
              ],
            },
            {
              id: "77777777-7777-4777-8777-777777777777",
              orden: 2,
              desplazamiento: 3,
              asientos: [
                { id: "88888888-8888-4888-8888-888888888888", numero: 3 },
                { id: "99999999-9999-4999-8999-999999999999", numero: 4 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tipo: "general",
      nombre: "General",
      orden: 2,
      capacidad: 50,
      filas: [],
    },
  ],
};

describe("aMapaInicial / aMapaEntrada (ida y vuelta)", () => {
  it("conserva nombre/dirección/distrito, secciones numeradas y la zona general con su id", () => {
    const estado = aMapaInicial(MAPA_EJEMPLO);

    expect(estado.nombre).toBe("Teatro Municipal");
    expect(estado.direccion).toBe("Av. Grau 100");
    expect(estado.distrito).toBe("Piura");
    expect(estado.secciones).toHaveLength(1);
    expect(estado.secciones[0]!.nombre).toBe("Platea");
    expect(estado.secciones[0]!.filas).toHaveLength(1);
    expect(estado.secciones[0]!.filas[0]!.nombre).toBe("A");
    expect(estado.secciones[0]!.filas[0]!.bloques).toHaveLength(2);
    expect(estado.secciones[0]!.filas[0]!.bloques[0]!.desplazamiento).toBe(0);
    expect(estado.secciones[0]!.filas[0]!.bloques[1]!.desplazamiento).toBe(3);
    expect(estado.secciones[0]!.filas[0]!.bloques[0]!.asientos).toHaveLength(2);
    expect(estado.secciones[0]!.filas[0]!.bloques[1]!.asientos).toHaveLength(2);

    expect(estado.zonasGenerales).toEqual([
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", nombre: "General", capacidad: 50 },
    ]);

    const entrada = aMapaEntrada(estado);
    expect(entrada).toEqual({
      nombre: "Teatro Municipal",
      direccion: "Av. Grau 100",
      distrito: "Piura",
      secciones: [
        {
          tipo: "numerada",
          nombre: "Platea",
          orden: 1,
          filas: [
            {
              nombre: "A",
              orden: 1,
              bloques: [
                { orden: 1, desplazamiento: 0, asientos: [{ numero: 1 }, { numero: 2 }] },
                { orden: 2, desplazamiento: 3, asientos: [{ numero: 3 }, { numero: 4 }] },
              ],
            },
          ],
        },
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          tipo: "general",
          nombre: "General",
          orden: 2,
          capacidad: 50,
        },
      ],
    });
  });

  it("la entrada resultante cumple MapaSedeEntradaSchema (no borra la zona general)", () => {
    const resultado = validarMapa(aMapaInicial(MAPA_EJEMPLO));
    expect(resultado.ok).toBe(true);
  });
});

describe("operaciones puras: pares agregar/quitar en los cuatro niveles", () => {
  function estadoConUnaSeccion(): EstadoPizarra {
    let estado = crearSeccion(estadoInicialPizarra());
    estado = crearFila(estado, estado.secciones[0]!.id);
    return estado;
  }

  it("crearSeccion / quitarSeccion", () => {
    const vacio = estadoInicialPizarra();
    const conSeccion = crearSeccion(vacio);
    expect(conSeccion.secciones).toHaveLength(1);
    const sinSeccion = quitarSeccion(conSeccion, conSeccion.secciones[0]!.id);
    expect(sinSeccion.secciones).toHaveLength(0);
  });

  it("crearFila / quitarFila, y no quita la última fila de la sección", () => {
    let estado = estadoConUnaSeccion(); // 1 fila (crearSeccion ya no agrega filas)
    expect(estado.secciones[0]!.filas).toHaveLength(1);

    estado = crearFila(estado, estado.secciones[0]!.id);
    expect(estado.secciones[0]!.filas).toHaveLength(2);

    const filaId = estado.secciones[0]!.filas[0]!.id;
    estado = quitarFila(estado, estado.secciones[0]!.id, filaId);
    expect(estado.secciones[0]!.filas).toHaveLength(1);

    // No quita la última fila (se queda igual).
    const ultimaFilaId = estado.secciones[0]!.filas[0]!.id;
    estado = quitarFila(estado, estado.secciones[0]!.id, ultimaFilaId);
    expect(estado.secciones[0]!.filas).toHaveLength(1);
  });

  it("agregarBloque crea un pasillo con desplazamiento no nulo; quitarBloque no quita el último", () => {
    let estado = estadoConUnaSeccion();
    const seccionId = estado.secciones[0]!.id;
    const filaId = estado.secciones[0]!.filas[0]!.id;
    expect(estado.secciones[0]!.filas[0]!.bloques).toHaveLength(1);

    estado = agregarBloque(estado, seccionId, filaId);
    const bloques = estado.secciones[0]!.filas[0]!.bloques;
    expect(bloques).toHaveLength(2);
    expect(bloques[1]!.desplazamiento).toBe(ANCHO_PASILLO);
    expect(bloques[1]!.desplazamiento).not.toBe(0);
    // El bloque existente conserva su desplazamiento real.
    expect(bloques[0]!.desplazamiento).toBe(0);

    const bloqueNuevoId = bloques[1]!.id;
    estado = quitarBloque(estado, seccionId, filaId, bloqueNuevoId);
    expect(estado.secciones[0]!.filas[0]!.bloques).toHaveLength(1);

    // No quita el último bloque de la fila.
    const ultimoBloqueId = estado.secciones[0]!.filas[0]!.bloques[0]!.id;
    estado = quitarBloque(estado, seccionId, filaId, ultimoBloqueId);
    expect(estado.secciones[0]!.filas[0]!.bloques).toHaveLength(1);
  });

  it("agregarAsiento / quitarAsiento, y no quita el último asiento del bloque", () => {
    let estado = estadoConUnaSeccion();
    const seccionId = estado.secciones[0]!.id;
    const filaId = estado.secciones[0]!.filas[0]!.id;
    const bloqueId = estado.secciones[0]!.filas[0]!.bloques[0]!.id;

    estado = agregarAsiento(estado, seccionId, filaId, bloqueId);
    estado = agregarAsiento(estado, seccionId, filaId, bloqueId);
    expect(estado.secciones[0]!.filas[0]!.bloques[0]!.asientos).toHaveLength(2);

    const primerAsientoId = estado.secciones[0]!.filas[0]!.bloques[0]!.asientos[0]!.id;
    estado = quitarAsiento(estado, seccionId, filaId, bloqueId, primerAsientoId);
    expect(estado.secciones[0]!.filas[0]!.bloques[0]!.asientos).toHaveLength(1);

    // No quita el último asiento del bloque.
    const ultimoAsientoId = estado.secciones[0]!.filas[0]!.bloques[0]!.asientos[0]!.id;
    estado = quitarAsiento(estado, seccionId, filaId, bloqueId, ultimoAsientoId);
    expect(estado.secciones[0]!.filas[0]!.bloques[0]!.asientos).toHaveLength(1);
  });
});

describe("numerosDeFila", () => {
  it("numera los asientos de forma continua a través de los pasillos", () => {
    let estado = crearSeccion(estadoInicialPizarra());
    estado = crearFila(estado, estado.secciones[0]!.id);
    const seccionId = estado.secciones[0]!.id;
    const filaId = estado.secciones[0]!.filas[0]!.id;
    const bloque1Id = estado.secciones[0]!.filas[0]!.bloques[0]!.id;

    estado = agregarAsiento(estado, seccionId, filaId, bloque1Id);
    estado = agregarAsiento(estado, seccionId, filaId, bloque1Id); // bloque1: 2 asientos
    estado = agregarBloque(estado, seccionId, filaId);
    const bloque2Id = estado.secciones[0]!.filas[0]!.bloques[1]!.id;
    estado = agregarAsiento(estado, seccionId, filaId, bloque2Id);
    estado = agregarAsiento(estado, seccionId, filaId, bloque2Id);
    estado = agregarAsiento(estado, seccionId, filaId, bloque2Id); // bloque2: 3 asientos

    const numeros = numerosDeFila(estado.secciones[0]!.filas[0]!);
    expect(numeros).toEqual([[1, 2], [3, 4, 5]]);
  });
});

describe("tope de secciones (LIMITES_MAPA.secciones), contando también zonasGenerales", () => {
  it("crearSeccion deja de añadir cuando numeradas + zonas generales llega al tope", () => {
    const zonasGenerales = Array.from({ length: LIMITES_MAPA.secciones - 1 }, (_, i) => ({
      id: `zona-${i}`,
      nombre: `Zona ${i}`,
      capacidad: 10,
    }));
    let estado: EstadoPizarra = { ...estadoInicialPizarra(), zonasGenerales };

    estado = crearSeccion(estado); // 0 + 19 = 19 < 20: se agrega
    expect(estado.secciones).toHaveLength(1);

    estado = crearSeccion(estado); // 1 + 19 = 20 >= 20: no se agrega
    expect(estado.secciones).toHaveLength(1);
  });

  it("sin zonas generales, respeta igual el tope de LIMITES_MAPA.secciones", () => {
    let estado = estadoInicialPizarra();
    for (let i = 0; i < LIMITES_MAPA.secciones + 2; i++) {
      estado = crearSeccion(estado);
    }
    expect(estado.secciones).toHaveLength(LIMITES_MAPA.secciones);
  });
});

describe("otros límites de LIMITES_MAPA", () => {
  it("crearFila no pasa de LIMITES_MAPA.filasPorSeccion", () => {
    let estado = crearSeccion(estadoInicialPizarra());
    const seccionId = estado.secciones[0]!.id;
    for (let i = 0; i < LIMITES_MAPA.filasPorSeccion + 2; i++) {
      estado = crearFila(estado, seccionId);
    }
    expect(estado.secciones[0]!.filas).toHaveLength(LIMITES_MAPA.filasPorSeccion);
  });

  it("agregarAsiento no pasa de LIMITES_MAPA.asientosPorFila en toda la fila", () => {
    let estado = crearSeccion(estadoInicialPizarra());
    estado = crearFila(estado, estado.secciones[0]!.id);
    const seccionId = estado.secciones[0]!.id;
    const filaId = estado.secciones[0]!.filas[0]!.id;
    const bloqueId = estado.secciones[0]!.filas[0]!.bloques[0]!.id;
    for (let i = 0; i < LIMITES_MAPA.asientosPorFila + 2; i++) {
      estado = agregarAsiento(estado, seccionId, filaId, bloqueId);
    }
    expect(estado.secciones[0]!.filas[0]!.bloques[0]!.asientos).toHaveLength(LIMITES_MAPA.asientosPorFila);
  });
});

describe("campoDeRuta", () => {
  it("resuelve una sección numerada por posición, nunca por id local", () => {
    expect(campoDeRuta(["secciones", 0], 2)).toBe(idCampoSeccionNombre(0));
    expect(campoDeRuta(["secciones", 0, "nombre"], 2)).toBe(idCampoSeccionNombre(0));
    expect(campoDeRuta(["secciones", 0, "orden"], 2)).toBe(idCampoSeccionNombre(0));
  });

  it("resuelve una fila por posición", () => {
    expect(campoDeRuta(["secciones", 0, "filas", 1], 2)).toBe(idCampoFilaNombre(0, 1));
    expect(campoDeRuta(["secciones", 0, "filas", 1, "nombre"], 2)).toBe(idCampoFilaNombre(0, 1));
    expect(campoDeRuta(["secciones", 0, "filas", 1, "orden"], 2)).toBe(idCampoFilaNombre(0, 1));
  });

  it("da null para bloques/asientos: no tienen Campo propio", () => {
    expect(campoDeRuta(["secciones", 0, "filas", 1, "bloques", 0, "orden"], 2)).toBeNull();
    expect(campoDeRuta(["secciones", 0, "filas", 1, "bloques", 0, "asientos", 2, "numero"], 2)).toBeNull();
    expect(campoDeRuta(["secciones", 0, "filas", 1, "bloques"], 2)).toBeNull();
  });

  it("da null cuando el índice cae en una zona general conservada (fuera de rango)", () => {
    // Con 2 secciones numeradas, el índice 2 es la primera zona general intercalada por aMapaEntrada.
    expect(campoDeRuta(["secciones", 2], 2)).toBeNull();
    expect(campoDeRuta(["secciones", 2, "id"], 2)).toBeNull();
  });

  it("resuelve los campos de la sede en la raíz", () => {
    expect(campoDeRuta(["nombre"], 0)).toBe("nombre");
    expect(campoDeRuta(["direccion"], 0)).toBe("direccion");
    expect(campoDeRuta(["distrito"], 0)).toBe("distrito");
  });

  it("da null para rutas vacías o irreconocibles", () => {
    expect(campoDeRuta([], 2)).toBeNull();
    expect(campoDeRuta(["secciones"], 2)).toBeNull();
    expect(campoDeRuta(["otracosa"], 2)).toBeNull();
  });
});

describe("campoDelError", () => {
  it("parsea el formato de validarConEsquema (\"<ruta>: <mensaje>; ...\") y resuelve el primer campo", () => {
    const error: ErrorApi = {
      codigo: CODIGOS_EVENTOS.DATOS_INVALIDOS,
      mensaje: "secciones.0.filas.1.nombre: Fila inválida; secciones.0.orden: Orden repetido",
    };
    expect(campoDelError(error, 2)).toBe(idCampoFilaNombre(0, 1));
  });

  it("da null cuando la ruta cae en una zona general conservada", () => {
    const error: ErrorApi = {
      codigo: CODIGOS_EVENTOS.DATOS_INVALIDOS,
      mensaje: "secciones.2.id: Id de zona general repetido",
    };
    expect(campoDelError(error, 2)).toBeNull();
  });

  it("da null para códigos que no son DATOS_INVALIDOS", () => {
    const error: ErrorApi = { codigo: CODIGOS_EVENTOS.SEDE_AJENA, mensaje: "secciones.0.nombre: no importa" };
    expect(campoDelError(error, 2)).toBeNull();
  });
});

describe("validarMapa", () => {
  it("bloquea el guardado si falta el nombre de la sede (red de seguridad de zod)", () => {
    const estado = aMapaInicial(MAPA_EJEMPLO);
    estado.nombre = "";
    const resultado = validarMapa(estado);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.campo).toBe("nombre");
  });

  it("sin secciones numeradas ni zonas generales, da un error genérico (sin Campo que lo señale)", () => {
    const estado: EstadoPizarra = {
      nombre: "Local",
      direccion: "Jr. Lima 200",
      distrito: "Piura",
      secciones: [],
      zonasGenerales: [],
    };
    const resultado = validarMapa(estado);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.campo).toBeNull();
  });

  it("señala el campo de una sección con nombre demasiado largo", () => {
    let estado = aMapaInicial(MAPA_EJEMPLO);
    estado = { ...estado, secciones: [{ ...estado.secciones[0]!, nombre: "x".repeat(61) }] };
    const resultado = validarMapa(estado);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.campo).toBe(idCampoSeccionNombre(0));
  });

  it("acepta un mapa válido", () => {
    const resultado = validarMapa(aMapaInicial(MAPA_EJEMPLO));
    expect(resultado.ok).toBe(true);
  });
});

describe("estadoDeErrorGuardado (matriz I/O)", () => {
  it("SEDE_AJENA y MAPA_CERRADO ofrecen duplicar", () => {
    expect(estadoDeErrorGuardado({ codigo: CODIGOS_EVENTOS.SEDE_AJENA, mensaje: "x" }, 2)).toEqual({ tipo: "duplicar" });
    expect(estadoDeErrorGuardado({ codigo: CODIGOS_EVENTOS.MAPA_CERRADO, mensaje: "x" }, 2)).toEqual({ tipo: "duplicar" });
  });

  it("sin conexión ofrece reintentar", () => {
    expect(estadoDeErrorGuardado({ codigo: "SIN_CONEXION", mensaje: "x" }, 2)).toEqual({ tipo: "reintentar" });
  });

  it("DATOS_INVALIDOS con una ruta resoluble señala el campo", () => {
    const error: ErrorApi = { codigo: CODIGOS_EVENTOS.DATOS_INVALIDOS, mensaje: "secciones.0.nombre: Repetido" };
    expect(estadoDeErrorGuardado(error, 2)).toEqual({ tipo: "campo", campo: idCampoSeccionNombre(0) });
  });

  it("DATOS_INVALIDOS sin ruta resoluble (o cualquier otro código) da el aviso genérico", () => {
    const error: ErrorApi = { codigo: CODIGOS_EVENTOS.DATOS_INVALIDOS, mensaje: "secciones.2.id: Repetido" };
    expect(estadoDeErrorGuardado(error, 2)).toEqual({ tipo: "generico" });
    expect(estadoDeErrorGuardado({ codigo: CODIGOS_EVENTOS.BD_NO_DISPONIBLE, mensaje: "x" }, 2)).toEqual({ tipo: "generico" });
  });
});
