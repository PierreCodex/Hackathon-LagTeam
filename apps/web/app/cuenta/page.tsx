import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PantallaSesion } from "@/components/layout/pantalla-sesion";
import { Boton, Tarjeta } from "@/components/ui";
import { NOMBRE_ROL } from "@/lib/navegacion";
import { rutaIngresar } from "@/lib/sesion";
import { obtenerSesion } from "@/lib/sesion-servidor";
import { cerrarSesion } from "./acciones";

export const metadata: Metadata = { title: "Tu cuenta · Reto 18" };

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-meta text-ink-secondary">{etiqueta}</dt>
      <dd className="[overflow-wrap:anywhere]">{valor}</dd>
    </div>
  );
}

/** Datos del perfil y "Cerrar sesión" (1.8). */
export default async function Cuenta() {
  const sesion = await obtenerSesion();
  if (sesion.tipo === "anonima") {
    redirect(rutaIngresar("/cuenta"));
  }

  return (
    <PantallaSesion sesion={sesion} rutaActual="/cuenta" titulo="Tu cuenta" destinoActivo="cuenta">
      {sesion.tipo === "cuenta" && (
        <Tarjeta como="section" aria-label="Tus datos">
          <dl className="flex flex-col gap-4">
            <Dato etiqueta="Correo" valor={sesion.perfil.correo} />
            <Dato etiqueta="Tipo de cuenta" valor={NOMBRE_ROL[sesion.rolBarra]} />
            <Dato etiqueta="WhatsApp" valor={sesion.perfil.whatsapp} />
            <Dato etiqueta="Ciudad" valor={sesion.perfil.ciudad ?? "Sin indicar"} />
            <Dato
              etiqueta="Avisos por WhatsApp"
              valor={sesion.perfil.acepta_avisos ? "Sí, quiero recibirlos" : "No"}
            />
          </dl>
        </Tarjeta>
      )}
      {/* Cerrar sesión siempre disponible, aunque el perfil no se haya podido leer. */}
      <form action={cerrarSesion}>
        <Boton type="submit" variante="secundario" anchoCompleto>
          Cerrar sesión
        </Boton>
      </form>
    </PantallaSesion>
  );
}
