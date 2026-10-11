import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { EventoSchema, type MapaSede, MapaSedeSchema, type PreciosEvento, PreciosEventoSchema, type RangoPrecioEntrada } from "@reto18/shared";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aEntrada, CROQUIS, entradaDeCroquis } from "../fixtures/croquis.js";
import { crearAppDePrueba } from "./ayudas/app.js";
import { clienteAdminDePrueba, entornoDePrueba } from "./ayudas/supabase.js";
import { tokenPorRol, type UsuarioDePrueba } from "./ayudas/tokens.js";

const RUTA = "/api/v1/eventos";
const EVENTO_SEMILLA_1 = "13600000-0000-4000-8000-000000000001";
const nombreUnico = (base: string) => `${base} ${randomUUID().slice(0, 8)}`;

interface Respuesta {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cuerpo JSON de la respuesta, como en supertest
  body: any;
}

/**
 * Llamadas HTTP con `fetch` a la app escuchando en un puerto local. Aquí no se usa supertest: con respuestas
 * de ~80 kB (los 643 asientos con su categoría), superagent a veces no termina de leer la respuesta en Windows
 * y la petición acaba en ECONNRESET a los ~19 s, aunque la API respondió en milisegundos.
 */
function http(base: string, token?: string) {
  const llamar = (metodo: "GET" | "POST" | "PUT") => async (ruta: string, cuerpo?: unknown): Promise<Respuesta> => {
    const respuesta = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cuerpo === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(20_000),
    });
    const texto = await respuesta.text();
    return { status: respuesta.status, body: texto ? JSON.parse(texto) : undefined };
  };
  return { get: llamar("GET"), post: llamar("POST"), put: llamar("PUT") };
}

/** Filas del croquis con sus números (oráculo independiente del SQL). */
const FILAS = CROQUIS.flatMap((seccion) => seccion.grupos.flatMap((grupo) => [...grupo.filas].map((fila) => ({
  seccion: seccion.nombre as string,
  fila,
  numeros: grupo.bloques.flatMap(([inicio, fin]) => Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i)),
}))));

interface Escenario {
  sede: MapaSede;
  eventoId: string;
  /** Categoría por nombre: "VIP", "General", "Platea baja", "Platea media", "Mezanine" y "Zona" (de zona general). */
  categorias: Record<string, string>;
}

describe("precios por rango de asientos contra la BD de prueba", () => {
  let app: INestApplication;
  let lucia: UsuarioDePrueba;
  let pedro: UsuarioDePrueba;
  let publico: UsuarioDePrueba;
  let admin: UsuarioDePrueba;
  let base: string;
  const api = (token?: string) => http(base, token);

  beforeAll(async () => {
    app = await crearAppDePrueba();
    await app.listen(0, "127.0.0.1");
    base = await app.getUrl();
    [lucia, pedro, publico, admin] = await Promise.all([
      tokenPorRol("organizador"),
      tokenPorRol("organizador"),
      tokenPorRol("publico"),
      tokenPorRol("admin"),
    ]);
  });

  // Antes que `limpieza.ts`: eventos y sedes referencian a los usuarios de prueba (rangos y categorías caen en cascada).
  afterAll(async () => {
    await app?.close();
    const bd = clienteAdminDePrueba();
    const organizadores = [lucia, pedro].filter(Boolean).map((u) => u.id);
    expect((await bd.from("eventos_eventos").delete().in("organizador_id", organizadores)).error).toBeNull();
    expect((await bd.from("eventos_sedes").delete().in("creado_por", organizadores)).error).toBeNull();
  });

  /**
   * Sede de los croquis más una zona general, de Lucía, con un evento aprobado sin publicar
   * (como si lo hubiera aprobado el admin en la 1.5) y sus categorías.
   */
  async function escenario(): Promise<Escenario> {
    const entrada = entradaDeCroquis(nombreUnico("Teatro de precios"));
    entrada.secciones.push({ nombre: "Zona general", orden: 4, tipo: "general", capacidad: 80 });
    const creada = await api(lucia.token).post(`${RUTA}/sedes`, entrada);
    expect(creada.status, JSON.stringify(creada.body)).toBe(201);
    const sede = MapaSedeSchema.parse(creada.body);
    const bd = clienteAdminDePrueba();
    const evento = await bd.from("eventos_eventos").insert({
      organizador_id: lucia.id, sede_id: sede.id, titulo: "Función con precios", descripcion: "Evento de prueba de precios.",
      categoria: "teatro", distrito: "Piura", inicio: "2030-11-20T20:00:00-05:00", estado: "aprobado", aforo: 643,
    }).select("id").single();
    expect(evento.error).toBeNull();
    const eventoId = evento.data!.id as string;
    const zona = sede.secciones.find((s) => s.tipo === "general")!.id;
    const filas = [
      ["VIP", null], ["General", null], ["Platea baja", null], ["Platea media", null], ["Mezanine", null], ["Zona", zona],
    ].map(([nombre, seccion_id], i) => ({
      evento_id: eventoId, sede_id: sede.id, nombre, color: "#D97706", precio_centimos: 1000 * (i + 1), seccion_id,
    }));
    const categorias = await bd.from("eventos_categorias_precio").insert(filas).select("id, nombre");
    expect(categorias.error).toBeNull();
    return { sede, eventoId, categorias: Object.fromEntries(categorias.data!.map((c) => [c.nombre, c.id])) };
  }

  /** Cubre todo el croquis: cada fila con la categoría de su sección, y la fila A con tres categorías. */
  function rangosCompletos(e: Escenario): RangoPrecioEntrada[] {
    return FILAS.flatMap(({ seccion, fila, numeros }) => {
      const ultimo = Math.max(...numeros);
      if (seccion === "Platea baja" && fila === "A") {
        return [
          { categoria_id: e.categorias.VIP!, seccion, fila, desde: 1, hasta: 6 },
          { categoria_id: e.categorias.General!, seccion, fila, desde: 7, hasta: 16 },
          { categoria_id: e.categorias["Platea baja"]!, seccion, fila, desde: 17, hasta: ultimo },
        ];
      }
      return [{ categoria_id: e.categorias[seccion]!, seccion, fila, desde: 1, hasta: ultimo }];
    });
  }

  /** Categoría esperada de cada asiento según los rangos completos. */
  function esperadoCompleto(e: Escenario) {
    return FILAS.flatMap(({ seccion, fila, numeros }) => numeros.map((numero) => {
      let categoria = e.categorias[seccion]!;
      if (seccion === "Platea baja" && fila === "A" && numero <= 6) categoria = e.categorias.VIP!;
      else if (seccion === "Platea baja" && fila === "A" && numero <= 16) categoria = e.categorias.General!;
      return { seccion, fila, numero, categoria_id: categoria };
    }));
  }

  const sinIdDeRango = (precios: PreciosEvento) => precios.rangos.map(({ categoria_id, seccion, fila, desde, hasta }) => ({ categoria_id, seccion, fila, desde, hasta }));
  const sinIds = (precios: PreciosEvento) => precios.asientos.map(({ seccion, fila, numero, categoria_id }) => ({ seccion, fila, numero, categoria_id }));
  const guardar = (usuario: UsuarioDePrueba, eventoId: string, cuerpo: unknown) =>
    api(usuario.token).put(`${RUTA}/${eventoId}/precios`, cuerpo);
  const leer = (usuario: UsuarioDePrueba, eventoId: string) => api(usuario.token).get(`${RUTA}/${eventoId}/precios`);
  async function precios(eventoId: string, usuario: UsuarioDePrueba = lucia): Promise<PreciosEvento> {
    const respuesta = await leer(usuario, eventoId);
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);
    return PreciosEventoSchema.parse(respuesta.body);
  }
  const idsDeAsientos = (sede: MapaSede) =>
    sede.secciones.flatMap((s) => s.filas.flatMap((f) => f.bloques.flatMap((b) => b.asientos.map((a) => a.id))));

  it("guarda los rangos del croquis (fila A con tres categorías) y cada asiento tiene la categoría de su rango", async () => {
    const e = await escenario();
    const rangos = rangosCompletos(e);

    const respuesta = await guardar(lucia, e.eventoId, { rangos });

    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);
    const guardados = PreciosEventoSchema.parse(respuesta.body);
    expect(guardados.asientos).toHaveLength(643);
    expect(sinIds(guardados)).toEqual(esperadoCompleto(e));
    expect(guardados.asientos.map((a) => a.asiento_id)).toEqual(idsDeAsientos(e.sede));
    expect(sinIdDeRango(guardados)).toEqual(rangos);
    // El dueño y el admin leen lo mismo.
    expect(await precios(e.eventoId)).toEqual(guardados);
    expect(await precios(e.eventoId, admin)).toEqual(guardados);
  });

  it("reemplazar con menos rangos deja solo los nuevos; la lista vacía deja todo sin categoría", async () => {
    const e = await escenario();
    expect((await guardar(lucia, e.eventoId, { rangos: rangosCompletos(e) })).status).toBe(200);
    const uno = { categoria_id: e.categorias.Mezanine!, seccion: "Mezanine", fila: "U", desde: 3, hasta: 10 };

    const menos = PreciosEventoSchema.parse((await guardar(lucia, e.eventoId, { rangos: [uno] })).body);

    expect(sinIdDeRango(menos)).toEqual([uno]);
    expect(menos.asientos.filter((a) => a.categoria_id).map((a) => [a.fila, a.numero])).toEqual(
      [3, 4, 5, 6, 7, 8, 9, 10].map((n) => ["U", n]),
    );

    const vacia = await guardar(lucia, e.eventoId, { rangos: [] });
    expect(vacia.status).toBe(200);
    const sinRangos = PreciosEventoSchema.parse(vacia.body);
    expect(sinRangos.rangos).toEqual([]);
    expect(sinRangos.asientos).toHaveLength(643);
    expect(sinRangos.asientos.every((a) => a.categoria_id === null)).toBe(true);
  });

  it("tras reemplazar el mapa, los rangos siguen resolviendo sobre los asientos nuevos (con huecos)", async () => {
    const e = await escenario();
    expect((await guardar(lucia, e.eventoId, { rangos: rangosCompletos(e) })).status).toBe(200);
    const nuevo = aEntrada(e.sede);
    const platea = nuevo.secciones[0] as Extract<(typeof nuevo.secciones)[number], { tipo: "numerada" }>;
    platea.filas[0]!.bloques[0]!.asientos.splice(2, 1); // Quita A3: hueco dentro del rango VIP.

    const mapa = await api(lucia.token).put(`${RUTA}/sedes/${e.sede.id}/mapa`, nuevo);
    expect(mapa.status, JSON.stringify(mapa.body)).toBe(200);
    const reemplazado = MapaSedeSchema.parse(mapa.body);

    const despues = await precios(e.eventoId);
    expect(sinIds(despues)).toEqual(esperadoCompleto(e).filter((a) => !(a.fila === "A" && a.numero === 3)));
    expect(despues.asientos.map((a) => a.asiento_id)).toEqual(idsDeAsientos(reemplazado));
    expect(new Set(idsDeAsientos(reemplazado)).has(idsDeAsientos(e.sede)[0]!)).toBe(false);
  });

  it("solape o rango invertido → 400 DATOS_INVALIDOS con la ruta, sin guardar nada", async () => {
    const e = await escenario();
    expect((await guardar(lucia, e.eventoId, { rangos: rangosCompletos(e) })).status).toBe(200);
    const antes = await precios(e.eventoId);
    const vip = { categoria_id: e.categorias.VIP!, seccion: "Platea baja", fila: "A" };

    const solape = await guardar(lucia, e.eventoId, { rangos: [{ ...vip, desde: 1, hasta: 6 }, { ...vip, desde: 6, hasta: 9 }] });
    expect(solape.status).toBe(400);
    expect(solape.body.error.codigo).toBe("DATOS_INVALIDOS");
    expect(solape.body.error.mensaje).toContain("rangos.1:");

    const invertido = await guardar(lucia, e.eventoId, { rangos: [{ ...vip, desde: 7, hasta: 6 }] });
    expect(invertido.status).toBe(400);
    expect(invertido.body.error.mensaje).toContain("rangos.0.hasta:");

    expect(await precios(e.eventoId)).toEqual(antes);
  });

  it("sección o fila que no está en el mapa, o sección general → 400 RANGO_FUERA_DEL_MAPA, sin guardar nada", async () => {
    const e = await escenario();
    expect((await guardar(lucia, e.eventoId, { rangos: rangosCompletos(e) })).status).toBe(200);
    const antes = await precios(e.eventoId);
    const categoria_id = e.categorias.VIP!;

    for (const [seccion, fila] of [["Platea baja", "Z"], ["Palco", "A"], ["Zona general", "A"], ["Platea media", "A"]]) {
      const respuesta = await guardar(lucia, e.eventoId, { rangos: [...rangosCompletos(e), { categoria_id, seccion, fila, desde: 1, hasta: 2 }].slice(-2) });
      expect(respuesta.status, `${seccion}/${fila}`).toBe(400);
      expect(respuesta.body.error.codigo).toBe("RANGO_FUERA_DEL_MAPA");
      expect(respuesta.body.error.mensaje).toContain("rangos.1.");
    }
    expect(await precios(e.eventoId)).toEqual(antes);
  });

  it("categoría de otro evento, inexistente o de zona general → 400 CATEGORIA_NO_VALIDA, sin guardar nada", async () => {
    const e = await escenario();
    const otro = await escenario();
    const antes = await precios(e.eventoId);

    for (const categoria_id of [otro.categorias.VIP!, randomUUID(), e.categorias.Zona!]) {
      const respuesta = await guardar(lucia, e.eventoId, { rangos: [{ categoria_id, seccion: "Platea baja", fila: "A", desde: 1, hasta: 2 }] });
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.codigo).toBe("CATEGORIA_NO_VALIDA");
    }
    expect(await precios(e.eventoId)).toEqual(antes);
  });

  it("publicar con algún asiento sin categoría → 409 ASIENTOS_SIN_PRECIO; con todos cubiertos publica y los precios se cierran", async () => {
    const e = await escenario();
    const bd = clienteAdminDePrueba();
    const publicar = () => api(lucia.token).post(`${RUTA}/${e.eventoId}/publicar`);
    const incompletos = rangosCompletos(e).slice(0, -1); // Sin la fila W.
    expect((await guardar(lucia, e.eventoId, { rangos: incompletos })).status).toBe(200);

    const sinPrecio = await publicar();
    expect(sinPrecio.status).toBe(409);
    expect(sinPrecio.body.error.codigo).toBe("ASIENTOS_SIN_PRECIO");
    expect(sinPrecio.body.error.mensaje).toContain("25");
    expect((await bd.from("eventos_eventos").select("publicado").eq("id", e.eventoId).single()).data).toEqual({ publicado: false });
    expect((await bd.from("eventos_sedes").select("mapa_cerrado").eq("id", e.sede.id).single()).data).toEqual({ mapa_cerrado: false });

    expect((await guardar(lucia, e.eventoId, { rangos: rangosCompletos(e) })).status).toBe(200);
    const publicado = await publicar();
    expect(publicado.status, JSON.stringify(publicado.body)).toBe(200);
    expect(EventoSchema.parse(publicado.body)).toMatchObject({ publicado: true });

    const antes = await precios(e.eventoId);
    const cerrado = await guardar(lucia, e.eventoId, { rangos: [] });
    expect(cerrado.status).toBe(409);
    expect(cerrado.body.error.codigo).toBe("EVENTO_PUBLICADO");
    expect(await precios(e.eventoId)).toEqual(antes);
  });

  it("evento de otro organizador → 403 EVENTO_AJENO; inexistente → 404 EVENTO_NO_EXISTE", async () => {
    const e = await escenario();
    expect((await guardar(lucia, e.eventoId, { rangos: rangosCompletos(e) })).status).toBe(200);
    const antes = await precios(e.eventoId);

    for (const respuesta of [await leer(pedro, e.eventoId), await guardar(pedro, e.eventoId, { rangos: [] })]) {
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.codigo).toBe("EVENTO_AJENO");
    }
    expect(await precios(e.eventoId)).toEqual(antes);

    const id = randomUUID();
    for (const respuesta of [await leer(lucia, id), await leer(admin, id), await guardar(lucia, id, { rangos: [] })]) {
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe("EVENTO_NO_EXISTE");
    }
    expect((await leer(lucia, "no-es-un-id")).body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("roles: público no lee ni escribe; admin lee pero no escribe; sin token → 401", async () => {
    const e = await escenario();

    expect((await leer(publico, e.eventoId)).status).toBe(403);
    expect((await guardar(publico, e.eventoId, { rangos: [] })).status).toBe(403);
    expect((await guardar(admin, e.eventoId, { rangos: [] })).status).toBe(403);
    expect((await leer(admin, e.eventoId)).status).toBe(200);
    expect((await api().get(`${RUTA}/${e.eventoId}/precios`)).status).toBe(401);
    expect((await api().put(`${RUTA}/${e.eventoId}/precios`, { rangos: [] })).status).toBe(401);
  });

  it("semilla: los 643 asientos del evento 1 tienen la categoría de su sección", async () => {
    const semilla = await precios(EVENTO_SEMILLA_1, admin);
    const categoria = { "Platea baja": "13700000-0000-4000-8000-000000000011", "Platea media": "13700000-0000-4000-8000-000000000012", Mezanine: "13700000-0000-4000-8000-000000000013" } as Record<string, string>;

    expect(sinIds(semilla)).toEqual(FILAS.flatMap(({ seccion, fila, numeros }) => numeros.map((numero) => ({ seccion, fila, numero, categoria_id: categoria[seccion] }))));
    expect(semilla.rangos).toHaveLength(23);
  });

  it("las funciones de precios no se pueden ejecutar desde el navegador (AD-1)", async () => {
    const { url, clavePublica } = entornoDePrueba();
    const navegador = createClient(url, clavePublica, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${lucia.token}` } },
    });

    const llamadas = await Promise.all([
      navegador.rpc("eventos_guardar_precios", { p_organizador: lucia.id, p_evento_id: EVENTO_SEMILLA_1, p_rangos: [] }),
      navegador.rpc("eventos_leer_precios", { p_evento_id: EVENTO_SEMILLA_1 }),
      navegador.rpc("eventos_precios_asientos", { p_evento_id: EVENTO_SEMILLA_1 }),
    ]);
    for (const { error } of llamadas) expect(error?.code).toBe("42501");
    const tabla = await navegador.from("eventos_precios_rango").select("id");
    expect(tabla.error?.code).toBe("42501");
  });
});
