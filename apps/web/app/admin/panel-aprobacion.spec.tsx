import type { ErrorApi, EventoRevision } from "@reto18/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContenidoMisEventos, FilaMisEventos } from "../organizador/fila-mis-eventos";
import {
  AvisoErrorRevision,
  FormularioMotivo,
  InterruptorDestacar,
  PanelAprobacion,
  TarjetaRevision,
  type TarjetaRevisionProps,
} from "./panel-aprobacion";

// Casos de la tabla de la historia 1.10, sobre el HTML que pinta el servidor.

const ALERTA = "La descripción menciona un DJ, pero el evento no tiene constancia de APDAYC.";

const PENDIENTE: EventoRevision = {
  id: "13600000-0000-4000-8000-000000000007",
  organizador_id: "11111111-1111-4111-8111-111111111111",
  sede_id: "22222222-2222-4222-8222-222222222222",
  titulo: "Noche de DJ en la plaza",
  descripcion: "Fiesta con DJ invitado.",
  categoria: "musica",
  distrito: "Castilla",
  inicio: "2026-10-16T20:00:00-05:00",
  estado: "pendiente",
  motivo_rechazo: null,
  destacado: false,
  hay_musica: true,
  constancia_apdayc_url: "https://x.supabase.co/storage/v1/object/constancias/u/c.pdf",
  foto_url: null,
  aforo: 120,
  publicado: false,
  alerta_apdayc: null,
};

const nada = () => {};

function pintarTarjeta(props: Partial<TarjetaRevisionProps> = {}) {
  return renderToStaticMarkup(
    <TarjetaRevision
      evento={PENDIENTE}
      accion={null}
      error={null}
      rechazo={{ abierto: false, motivo: "" }}
      onVerConstancia={nada}
      onAprobar={nada}
      onAbrirRechazo={nada}
      onCambiarMotivo={nada}
      onConfirmarRechazo={nada}
      onCancelarRechazo={nada}
      onDestacar={nada}
      {...props}
    />,
  );
}

describe("pendientes (1.10)", () => {
  it("tarjeta con título, categoría, fecha en Lima, distrito, aforo, descripción, música y acciones", () => {
    const html = pintarTarjeta();
    expect(html).toContain("Noche de DJ en la plaza");
    expect(html).toContain("Música");
    expect(html).toContain("Vie 16 oct · 8:00 p. m.");
    expect(html).toContain("Castilla");
    expect(html).toContain("120 personas");
    expect(html).toContain("Fiesta con DJ invitado.");
    expect(html).toContain("Pendiente de aprobación");
    expect(html).toContain(">Ver constancia<");
    expect(html).toContain(">Aprobar<");
    expect(html).toContain(">Rechazar<");
    expect(html).not.toContain("Destacar");
  });

  it("lista vacía → No hay eventos pendientes", () => {
    const html = renderToStaticMarkup(<PanelAprobacion apiUrl="http://api" pendientes={[]} rutaActual="/admin" />);
    expect(html).toContain("No hay eventos pendientes");
  });

  it("el panel pinta una tarjeta por pendiente", () => {
    const html = renderToStaticMarkup(
      <PanelAprobacion
        apiUrl="http://api"
        pendientes={[PENDIENTE, { ...PENDIENTE, id: "13600000-0000-4000-8000-000000000008", titulo: "Otro" }]}
        rutaActual="/admin"
      />,
    );
    expect(html.match(/<article/g)).toHaveLength(2);
  });
});

describe("alerta APDAYC (1.10)", () => {
  it("alerta no nula → aviso de advertencia con su texto", () => {
    const html = pintarTarjeta({ evento: { ...PENDIENTE, alerta_apdayc: ALERTA } });
    expect(html).toContain('role="status"');
    expect(html).toContain("Atención");
    expect(html).toContain(ALERTA);
  });

  it("alerta nula → nada", () => {
    expect(pintarTarjeta()).not.toContain("Atención");
  });
});

describe("constancia (1.10)", () => {
  it("evento sin archivo → Sin constancia, sin botón", () => {
    const html = pintarTarjeta({ evento: { ...PENDIENTE, constancia_apdayc_url: null } });
    expect(html).toContain("Sin constancia");
    expect(html).not.toContain("Ver constancia");
  });

  it("la API devolvió url null → Sin constancia", () => {
    expect(pintarTarjeta({ sinConstancia: true })).toContain("Sin constancia");
  });

  it("la URL guardada no se pinta: se firma al pulsar", () => {
    expect(pintarTarjeta()).not.toContain(PENDIENTE.constancia_apdayc_url!);
  });

  it("abriendo → botones desactivados", () => {
    const html = pintarTarjeta({ accion: "constancia" });
    expect(html).toContain("Abriendo…");
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe("aprobar y destacar (1.10)", () => {
  it("aprobando → botones desactivados", () => {
    const html = pintarTarjeta({ accion: "aprobar" });
    expect(html).toContain("Aprobando…");
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("aprobado → estado Aprobado e interruptor Destacar, sin Aprobar ni Rechazar", () => {
    const html = pintarTarjeta({ evento: { ...PENDIENTE, estado: "aprobado" } });
    expect(html).toContain("Aprobado");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("Destacar");
    expect(html).not.toContain(">Aprobar<");
    expect(html).not.toContain(">Rechazar<");
  });

  it("interruptor: destacado y en curso", () => {
    const destacado = renderToStaticMarkup(<InterruptorDestacar destacado enCurso={false} onCambiar={nada} />);
    expect(destacado).toContain('aria-checked="true"');
    expect(destacado).toContain("★ Destacado");
    const enCurso = renderToStaticMarkup(<InterruptorDestacar destacado={false} enCurso onCambiar={nada} />);
    expect(enCurso).toContain("Guardando…");
    expect(enCurso).toContain('disabled=""');
  });
});

describe("rechazar (1.10)", () => {
  it("abre el motivo con Confirmar rechazo y Cancelar en lugar de Aprobar", () => {
    const html = pintarTarjeta({ rechazo: { abierto: true, motivo: "" } });
    expect(html).toContain("Motivo del rechazo");
    expect(html).toContain("Confirmar rechazo");
    expect(html).toContain("Cancelar");
    expect(html).not.toContain(">Aprobar<");
  });

  it("error del motivo junto al campo, asociado", () => {
    const html = renderToStaticMarkup(
      <FormularioMotivo
        id="motivo-x"
        motivo=""
        error="Escribe el motivo del rechazo."
        enviando={false}
        onCambiar={nada}
        onConfirmar={nada}
        onCancelar={nada}
      />,
    );
    expect(html).toContain('id="motivo-x-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Escribe el motivo del rechazo.");
  });

  it("enviando → Rechazando… y desactivado", () => {
    const html = renderToStaticMarkup(
      <FormularioMotivo id="m" motivo="x" enviando onCambiar={nada} onConfirmar={nada} onCancelar={nada} />,
    );
    expect(html).toContain("Rechazando…");
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("constancia en curso con el motivo abierto → el formulario desactivado, sin Rechazando…", () => {
    const html = pintarTarjeta({ accion: "constancia", rechazo: { abierto: true, motivo: "Falta el programa." } });
    expect(html).toMatch(/<textarea[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Cancelar</);
    expect(html).toMatch(/<button type="submit"[^>]*disabled=""[^>]*>Confirmar rechazo</);
    expect(html).not.toContain("Rechazando…");
  });

  it("rechazado → estado Rechazado con el motivo, sin acciones", () => {
    const html = pintarTarjeta({
      evento: { ...PENDIENTE, estado: "rechazado", motivo_rechazo: "Completar la descripción del programa." },
    });
    expect(html).toContain("Rechazado");
    expect(html).toContain("Completar la descripción del programa.");
    expect(html).not.toContain(">Aprobar<");
    expect(html).not.toContain("Destacar");
  });
});

describe("errores de la API (1.10)", () => {
  it.each<ErrorApi>([
    { codigo: "STORAGE_NO_DISPONIBLE", mensaje: "No pudimos firmar la constancia." },
    { codigo: "DATOS_INVALIDOS", mensaje: "motivo_rechazo: demasiado largo" },
    { codigo: "SIN_CONEXION", mensaje: "No pudimos conectar con el servidor." },
  ])("$codigo → aviso con el mensaje", (error) => {
    const html = renderToStaticMarkup(<AvisoErrorRevision error={error} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain(error.mensaje);
    expect(pintarTarjeta({ error })).toContain(error.mensaje);
  });
});

describe("Mis eventos (1.10)", () => {
  const pintarFila = (evento: EventoRevision) => renderToStaticMarkup(<FilaMisEventos evento={evento} />);

  it("rechazado → estado y motivo exacto", () => {
    const html = pintarFila({ ...PENDIENTE, estado: "rechazado", motivo_rechazo: "Completar la descripción del programa." });
    expect(html).toContain("Rechazado");
    expect(html).toContain("Completar la descripción del programa.");
  });

  it("aprobado sin publicar → Falta armar el mapa y publicar, con Armar butacas hacia la pizarra de su sede", () => {
    const html = pintarFila({ ...PENDIENTE, estado: "aprobado" });
    expect(html).toContain("Aprobado · Falta armar el mapa y publicar");
    expect(html).toMatch(new RegExp(`<a [^>]*href="/organizador/sedes/${PENDIENTE.sede_id}/mapa\\?evento=${PENDIENTE.id}"[^>]*>Armar butacas</a>`));
  });

  it("rechazado → sin botón de butacas", () => {
    expect(pintarFila({ ...PENDIENTE, estado: "rechazado", motivo_rechazo: "x" })).not.toContain("butacas");
  });

  const pintarContenido = (eventos: EventoRevision[], error?: ErrorApi) =>
    renderToStaticMarkup(<ContenidoMisEventos eventos={eventos} error={error} rutaActual="/organizador" />);

  it("error de la API → aviso con el mensaje y Reintentar a la misma ruta", () => {
    const html = pintarContenido([], { codigo: "SIN_CONEXION", mensaje: "No pudimos conectar con el servidor." });
    expect(html).toContain('role="alert"');
    expect(html).toContain("No pudimos cargar tus eventos.");
    expect(html).toContain("No pudimos conectar con el servidor.");
    expect(html).toContain('href="/organizador"');
    expect(html).toContain(">Reintentar<");
    expect(html).not.toContain("<li");
  });

  it("lista vacía → estado vacío con el camino a Nuevo evento", () => {
    const html = pintarContenido([]);
    expect(html).toContain("Aún no tienes eventos");
    expect(html).toContain('href="/organizador/eventos/nuevo"');
    expect(html).toContain(">Nuevo evento<");
    expect(html).not.toContain("Reintentar");
  });

  it("con eventos → una fila por evento, con estados y motivo", () => {
    const html = pintarContenido([
      PENDIENTE,
      { ...PENDIENTE, id: "13600000-0000-4000-8000-000000000001", estado: "aprobado", publicado: true },
      {
        ...PENDIENTE,
        id: "13600000-0000-4000-8000-000000000002",
        estado: "rechazado",
        motivo_rechazo: "Completar la descripción del programa.",
      },
    ]);
    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html).toContain("Pendiente de aprobación");
    expect(html).toContain("Aprobado · Publicado");
    expect(html).toContain("Completar la descripción del programa.");
    expect(html).not.toContain("Aún no tienes eventos");
  });

  it("pendiente → con fecha y distrito", () => {
    const html = pintarFila(PENDIENTE);
    expect(html).toContain("Pendiente de aprobación");
    expect(html).toContain("Vie 16 oct · 8:00 p. m.");
    expect(html).toContain("Castilla");
  });
});
