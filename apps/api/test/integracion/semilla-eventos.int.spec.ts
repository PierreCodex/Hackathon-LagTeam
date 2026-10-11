import { CategoriaPrecioSchema, EventoRevisionSchema, MapaSedeSchema } from "@reto18/shared";
import { expect, it } from "vitest";
import { CROQUIS, ORGANIZADOR_DEMO_ID, SEDE_CROQUIS_ID, SEDE_GENERAL_ID } from "../fixtures/croquis.js";
import { clienteAdminDePrueba } from "./ayudas/supabase.js";

const seleccionMapa = `id,nombre,direccion,distrito,secciones:eventos_secciones(
  id,nombre,orden,tipo,capacidad,filas:eventos_filas(id,nombre,orden,
  bloques:eventos_bloques(id,orden,desplazamiento,asientos:eventos_asientos(id,numero))))`;

it("la sede de demo coincide con todas las filas, bloques, rangos y desplazamientos de los croquis", async () => {
  const { data, error } = await clienteAdminDePrueba().from("eventos_sedes").select(seleccionMapa).eq("id", SEDE_CROQUIS_ID).single();
  expect(error).toBeNull();
  const mapa = MapaSedeSchema.parse(data);
  mapa.secciones.sort((a, b) => a.orden - b.orden);
  expect(mapa.secciones).toHaveLength(3);
  let total = 0;
  for (const [s, esperado] of CROQUIS.entries()) {
    const seccion = mapa.secciones[s]!;
    expect(seccion).toMatchObject({ nombre: esperado.nombre, orden: s + 1, tipo: "numerada", capacidad: null });
    seccion.filas.sort((a, b) => a.orden - b.orden);
    const filasEsperadas = esperado.grupos.flatMap((grupo) => [...grupo.filas].map((nombre) => ({ nombre, bloques: grupo.bloques })));
    expect(seccion.filas).toHaveLength(filasEsperadas.length);
    let subtotal = 0;
    for (const [f, filaEsperada] of filasEsperadas.entries()) {
      const fila = seccion.filas[f]!;
      expect(fila).toMatchObject({ nombre: filaEsperada.nombre, orden: f + 1 });
      fila.bloques.sort((a, b) => a.orden - b.orden);
      expect(fila.bloques).toHaveLength(filaEsperada.bloques.length);
      for (const [b, [inicio, fin, desplazamiento]] of filaEsperada.bloques.entries()) {
        const bloque = fila.bloques[b]!;
        expect(bloque).toMatchObject({ orden: b + 1, desplazamiento });
        expect(bloque.asientos.map((a) => a.numero).sort((a, b) => a - b)).toEqual(Array.from({ length: fin - inicio + 1 }, (_, n) => inicio + n));
        subtotal += bloque.asientos.length;
      }
    }
    expect(subtotal).toBe(esperado.total);
    total += subtotal;
  }
  expect(total).toBe(643);
});

it("la demo tiene eventos variados, Weekend completo y una zona general con precios", async () => {
  const admin = clienteAdminDePrueba();
  const eventos = await admin.from("eventos_eventos").select("*").eq("organizador_id", ORGANIZADOR_DEMO_ID);
  expect(eventos.error).toBeNull();
  const datos = EventoRevisionSchema.array().parse(eventos.data);
  expect(datos).toHaveLength(8);
  expect(datos.find((e) => e.id === "13600000-0000-4000-8000-000000000007")).toMatchObject({
    estado: "pendiente", descripcion: expect.stringContaining("DJ"), alerta_apdayc: expect.stringContaining("DJ"),
  });
  expect(datos.filter((e) => e.alerta_apdayc !== null)).toHaveLength(1);
  expect(datos.some((e) => e.estado === "pendiente")).toBe(true);
  expect(datos.some((e) => e.estado === "aprobado" && e.destacado)).toBe(true);
  expect(new Set(datos.map((e) => e.categoria)).size).toBe(7);
  expect(new Set(datos.map((e) => e.distrito)).size).toBe(2);
  expect(datos.every((e) => e.inicio >= "2026-10-01" && e.inicio < "2026-12-01")).toBe(true);
  const fechas = datos.filter((e) => e.estado === "aprobado").map((e) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(e.inicio)));
  expect(fechas).toEqual(expect.arrayContaining(["2026-10-16", "2026-10-17", "2026-10-18"]));
  const sede = await admin.from("eventos_sedes").select(seleccionMapa).eq("id", SEDE_GENERAL_ID).single();
  expect(sede.error).toBeNull();
  const general = MapaSedeSchema.parse(sede.data).secciones[0]!;
  expect(general).toMatchObject({ tipo: "general", capacidad: 120, filas: [] });
  const precios = await admin.from("eventos_categorias_precio").select("*").in("evento_id", datos.map((e) => e.id));
  expect(precios.error).toBeNull();
  const categorias = CategoriaPrecioSchema.array().parse(precios.data);
  expect(categorias).toHaveLength(16);
  expect(new Set(categorias.map((c) => c.precio_centimos)).size).toBeGreaterThan(3);
  for (const evento of datos) {
    const propias = categorias.filter((c) => c.evento_id === evento.id);
    expect(propias).toHaveLength(evento.sede_id === SEDE_GENERAL_ID ? 1 : 3);
    expect(propias.every((c) => c.sede_id === evento.sede_id)).toBe(true);
    expect(propias.every((c) => c.seccion_id === (evento.sede_id === SEDE_GENERAL_ID ? general.id : null))).toBe(true);
  }
});
