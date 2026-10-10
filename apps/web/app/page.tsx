import { consultarSalud, resumir } from "../lib/salud";

// Se consulta en cada visita: nunca se sirve una salud cacheada.
export const dynamic = "force-dynamic";

export default async function Inicio() {
  const { api, bd, detalle } = resumir(await consultarSalud(process.env.API_URL));
  const sano = api === "ok" && bd === "ok";

  return (
    <main>
      <h1>Eventos culturales de Piura</h1>
      <section className="tarjeta" aria-live="polite">
        <p className={`estado ${sano ? "ok" : "error"}`}>
          API {api} · BD {bd}
        </p>
        <p className="detalle">{detalle}</p>
      </section>
    </main>
  );
}
