import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clienteAdminDePrueba, clientePublicoDePrueba, entornoDePrueba } from "./ayudas/supabase.js";
import { tokenPorRol } from "./ayudas/tokens.js";
import { ORGANIZADOR_DEMO_ID } from "../fixtures/croquis.js";

const sedeId = randomUUID();
const seccionId = randomUUID();
const generalId = randomUUID();
const filaId = randomUUID();
const otraFilaId = randomUUID();
const bloques = [randomUUID(), randomUUID(), randomUUID()];

beforeAll(async () => {
  const admin = clienteAdminDePrueba();
  expect((await admin.from("eventos_sedes").insert({ id: sedeId, nombre: "Sede de prueba", direccion: "Prueba", distrito: "Piura" })).error).toBeNull();
  expect((await admin.from("eventos_secciones").insert([
    { id: seccionId, sede_id: sedeId, nombre: "Numerada", orden: 1, tipo: "numerada" },
    { id: generalId, sede_id: sedeId, nombre: "General", orden: 2, tipo: "general", capacidad: 20 },
  ])).error).toBeNull();
  expect((await admin.from("eventos_filas").insert([
    { id: filaId, seccion_id: seccionId, nombre: "A", orden: 1 },
    { id: otraFilaId, seccion_id: seccionId, nombre: "B", orden: 2 },
  ])).error).toBeNull();
  expect((await admin.from("eventos_bloques").insert([
    { id: bloques[0], fila_id: filaId, orden: 1 },
    { id: bloques[1], fila_id: filaId, orden: 2 },
    { id: bloques[2], fila_id: otraFilaId, orden: 1 },
  ])).error).toBeNull();
});

afterAll(async () => {
  expect((await clienteAdminDePrueba().from("eventos_sedes").delete().eq("id", sedeId)).error).toBeNull();
});

it("el número es único en toda la fila, y se puede repetir en otra fila", async () => {
  const admin = clienteAdminDePrueba();
  expect((await admin.from("eventos_asientos").insert({ bloque_id: bloques[0], fila_id: filaId, numero: 1 })).error).toBeNull();
  const repetido = await admin.from("eventos_asientos").insert({ bloque_id: bloques[1], fila_id: filaId, numero: 1 });
  expect(repetido.error?.code).toBe("23505");
  expect((await admin.from("eventos_asientos").insert({ bloque_id: bloques[2], fila_id: otraFilaId, numero: 1 })).error).toBeNull();
});

it("no permite falsear la fila de un asiento para eludir la unicidad", async () => {
  const resultado = await clienteAdminDePrueba().from("eventos_asientos").insert({ bloque_id: bloques[0], fila_id: otraFilaId, numero: 2 });
  expect(resultado.error?.code).toBe("23503");
});

it.each([
  { tipo: "general", capacidad: null },
  { tipo: "general", capacidad: 0 },
  { tipo: "general", capacidad: -1 },
  { tipo: "numerada", capacidad: 20 },
])("rechaza sección incoherente: $tipo / $capacidad", async (campos) => {
  const resultado = await clienteAdminDePrueba().from("eventos_secciones").insert({ sede_id: sedeId, nombre: "Inválida", orden: 3, ...campos });
  expect(resultado.error?.code).toBe("23514");
});

it("una sección general no puede tener filas ni recibir filas cambiando el tipo", async () => {
  const admin = clienteAdminDePrueba();
  const fila = await admin.from("eventos_filas").insert({ seccion_id: generalId, nombre: "A", orden: 1 });
  expect(fila.error?.code).toBe("23503");
  const cambio = await admin.from("eventos_secciones").update({ tipo: "general", capacidad: 20 }).eq("id", seccionId);
  expect(cambio.error?.code).toBe("23503");
});

describe("las categorías pertenecen a secciones generales de la sede del evento", () => {
  const otraSedeId = randomUUID();
  const otraGeneralId = randomUUID();
  const eventoId = randomUUID();
  const otroEventoId = randomUUID();
  const categoriaId = randomUUID();
  const categoria = {
    evento_id: eventoId, sede_id: sedeId, seccion_id: generalId,
    nombre: "General", color: "#059669", precio_centimos: 1500,
  };

  beforeAll(async () => {
    const admin = clienteAdminDePrueba();
    expect((await admin.from("eventos_sedes").insert({ id: otraSedeId, nombre: "Otra sede", direccion: "Prueba", distrito: "Castilla" })).error).toBeNull();
    expect((await admin.from("eventos_secciones").insert({ id: otraGeneralId, sede_id: otraSedeId, nombre: "Otra general", orden: 1, tipo: "general", capacidad: 30 })).error).toBeNull();
    const evento = {
      organizador_id: ORGANIZADOR_DEMO_ID, titulo: "Evento de prueba", descripcion: "Prueba de pertenencia",
      categoria: "teatro", distrito: "Piura", inicio: "2026-11-01T19:00:00-05:00", aforo: 20,
    };
    expect((await admin.from("eventos_eventos").insert([
      { ...evento, id: eventoId, sede_id: sedeId },
      { ...evento, id: otroEventoId, sede_id: otraSedeId },
    ])).error).toBeNull();
    expect((await admin.from("eventos_categorias_precio").insert({ ...categoria, id: categoriaId })).error).toBeNull();
  });

  afterAll(async () => {
    const admin = clienteAdminDePrueba();
    expect((await admin.from("eventos_eventos").delete().in("id", [eventoId, otroEventoId])).error).toBeNull();
    expect((await admin.from("eventos_sedes").delete().eq("id", otraSedeId)).error).toBeNull();
  });

  it.each([
    { caso: "sección de otra sede", cambio: { seccion_id: otraGeneralId } },
    { caso: "sede y sección ajenas al evento", cambio: { sede_id: otraSedeId, seccion_id: otraGeneralId } },
    { caso: "evento de otra sede", cambio: { evento_id: otroEventoId } },
    { caso: "sede ajena a la sección", cambio: { evento_id: otroEventoId, sede_id: otraSedeId } },
    { caso: "sección numerada", cambio: { seccion_id: seccionId } },
    { caso: "sección inexistente", cambio: { seccion_id: randomUUID() } },
    { caso: "evento inexistente", cambio: { evento_id: randomUUID() } },
  ])("rechaza INSERT y UPDATE con $caso", async ({ cambio }) => {
    const admin = clienteAdminDePrueba();
    const insercion = await admin.from("eventos_categorias_precio").insert({ ...categoria, nombre: randomUUID(), ...cambio });
    expect(insercion.error?.code).toBe("23503");
    const actualizacion = await admin.from("eventos_categorias_precio").update(cambio).eq("id", categoriaId);
    expect(actualizacion.error?.code).toBe("23503");
    const conservada = await admin.from("eventos_categorias_precio").select("*").eq("id", categoriaId).single();
    expect(conservada.error).toBeNull();
    expect(conservada.data).toMatchObject(categoria);
  });

  it("exige sede incluso con sección nula y admite precios numerados sin sección", async () => {
    const admin = clienteAdminDePrueba();
    const sinSede = await admin.from("eventos_categorias_precio").insert({ ...categoria, nombre: "Sin sede", sede_id: null });
    expect(sinSede.error?.code).toBe("23502");
    const sinSeccion = await admin.from("eventos_categorias_precio").insert({ ...categoria, nombre: "Numerada", seccion_id: null }).select().single();
    expect(sinSeccion.error).toBeNull();
    expect(sinSeccion.data).toMatchObject({ sede_id: sedeId, seccion_id: null });
    const otraSeccion = await admin.from("eventos_categorias_precio").update({ seccion_id: otraGeneralId }).eq("id", sinSeccion.data!.id);
    expect(otraSeccion.error?.code).toBe("23503");
    const sedeFalsa = await admin.from("eventos_categorias_precio").update({ sede_id: otraSedeId }).eq("id", sinSeccion.data!.id);
    expect(sedeFalsa.error?.code).toBe("23503");
    const anularSede = await admin.from("eventos_categorias_precio").update({ sede_id: null }).eq("id", sinSeccion.data!.id);
    expect(anularSede.error?.code).toBe("23502");
  });

  it("admite actualizar juntas las referencias hacia otro evento y su sección general", async () => {
    const admin = clienteAdminDePrueba();
    const id = randomUUID();
    expect((await admin.from("eventos_categorias_precio").insert({ ...categoria, id, nombre: "Trasladable" })).error).toBeNull();
    const cambio = { evento_id: otroEventoId, sede_id: otraSedeId, seccion_id: otraGeneralId };
    const resultado = await admin.from("eventos_categorias_precio").update(cambio).eq("id", id).select().single();
    expect(resultado.error).toBeNull();
    expect(resultado.data).toMatchObject(cambio);
  });

  it("rechaza cambiar después la sede del evento o la sede/tipo de su sección", async () => {
    const admin = clienteAdminDePrueba();
    const evento = await admin.from("eventos_eventos").update({ sede_id: otraSedeId }).eq("id", eventoId);
    expect(evento.error?.code).toBe("23503");
    const sede = await admin.from("eventos_secciones").update({ sede_id: otraSedeId }).eq("id", generalId);
    expect(sede.error?.code).toBe("23503");
    const tipo = await admin.from("eventos_secciones").update({ tipo: "numerada", capacidad: null }).eq("id", generalId);
    expect(tipo.error?.code).toBe("23503");
    const eventoConservado = await admin.from("eventos_eventos").select("sede_id").eq("id", eventoId).single();
    expect(eventoConservado.error).toBeNull();
    expect(eventoConservado.data).toEqual({ sede_id: sedeId });
    const seccionConservada = await admin.from("eventos_secciones").select("sede_id,tipo,capacidad").eq("id", generalId).single();
    expect(seccionConservada.error).toBeNull();
    expect(seccionConservada.data).toEqual({ sede_id: sedeId, tipo: "general", capacidad: 20 });
  });
});

describe("AD-1: todas las tablas de eventos cerradas al navegador", () => {
  let autenticado: SupabaseClient;
  beforeAll(async () => {
    const { token } = await tokenPorRol("publico");
    const { url, clavePublica } = entornoDePrueba();
    autenticado = createClient(url, clavePublica, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  });
  const tablas = ["eventos_sedes", "eventos_secciones", "eventos_filas", "eventos_bloques", "eventos_asientos", "eventos_eventos", "eventos_categorias_precio"];
  for (const tabla of tablas) {
    it.each(["anon", "authenticated"])(`${tabla}: %s no puede leer, insertar, actualizar ni borrar`, async (rol) => {
      const cliente = rol === "anon" ? clientePublicoDePrueba() : autenticado;
      const admin = clienteAdminDePrueba();
      const original = await admin.from(tabla).select("*").limit(1).single();
      expect(original.error).toBeNull();
      const lectura = await cliente.from(tabla).select("*");
      expect(lectura.data ?? []).toEqual([]);
      expect(lectura.error?.code).toBe("42501");
      const insercion = await cliente.from(tabla).insert({ id: randomUUID() });
      expect(insercion.error?.code).toBe("42501");
      const cambio = await cliente.from(tabla).update({ id: original.data!.id }).eq("id", original.data!.id);
      expect(cambio.error?.code).toBe("42501");
      const borrado = await cliente.from(tabla).delete().eq("id", original.data!.id);
      expect(borrado.error?.code).toBe("42501");
      const despues = await admin.from(tabla).select("*").eq("id", original.data!.id).single();
      expect(despues.error).toBeNull();
      expect(despues.data).toEqual(original.data);
    });
  }
});
