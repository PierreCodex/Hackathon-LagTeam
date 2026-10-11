import type { Pieza } from "@reto18/shared";

/** Pieza de prueba de la historia 3.8: evento con fecha, sede y precio conocidos. */
export const EVENTO_ID = "11111111-1111-4111-8111-111111111111";

export const PIEZA: Pieza = {
  id: "22222222-2222-4222-8222-222222222222",
  evento_id: EVENTO_ID,
  origen: "ia",
  textos: {
    titular: "Noche de marinera",
    subtitulo: "Lo mejor del baile norteño",
    llamado: "Separa tu entrada",
    descripcion: "Una noche para celebrar la marinera en Piura.",
  },
  paleta: { fondo: "#1A1A2E", texto: "#FFFFFF", acento: "#E94560" },
  campana: {
    publico: "Jóvenes y familias de Piura",
    reparto: [
      { red: "instagram", soles: 60 },
      { red: "whatsapp", soles: 40 },
    ],
    resumen: "Campaña de una semana en redes.",
    presupuesto_total_soles: 100,
    calendario: [{ dias_antes: 2, fecha: "2026-10-14", hora: "19:00", accion: "Publica el flyer" }],
  },
  datos: {
    evento_id: EVENTO_ID,
    titulo: "Noche de marinera",
    inicio: "2026-10-16T20:00:00-05:00",
    sede: "Teatro Municipal",
    direccion: "Av. Grau 123",
    distrito: "Piura",
    precio_minimo_centimos: 2500,
    foto_url: null,
  },
  creado_en: "2026-10-11T10:00:00-05:00",
};
