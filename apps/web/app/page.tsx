import { PantallaSesion } from "@/components/layout/pantalla-sesion";
import { Aviso, BotonEnlace, Tarjeta } from "@/components/ui";
import { consultarSalud, resumir } from "../lib/salud";

// Se consulta en cada visita: nunca se sirve una salud cacheada.
export const dynamic = "force-dynamic";

export default async function Inicio() {
  const { api, bd, detalle } = resumir(await consultarSalud(process.env.API_URL));
  const sano = api === "ok" && bd === "ok";

  return (
    <PantallaSesion titulo="Eventos culturales de Piura" destinoActivo="eventos" rutaActual="/">
      <Tarjeta como="section" aria-labelledby="titulo-salud" className="flex flex-col gap-3">
        <h2 id="titulo-salud" className="text-meta text-ink-secondary">
          Estado del sistema
        </h2>
        <Aviso
          tipo={sano ? "exito" : "error"}
          titulo={`API ${api} · BD ${bd}`}
          accion={
            sano ? undefined : (
              <BotonEnlace href="/" variante="secundario" prefetch={false}>
                Reintentar
              </BotonEnlace>
            )
          }
        >
          {detalle}
        </Aviso>
      </Tarjeta>
    </PantallaSesion>
  );
}
