import type { Metadata } from "next";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { Tarjeta } from "@/components/ui";

export const metadata: Metadata = { title: "Organizador · Reto 18" };

/** Portada mínima del organizador (1.8): comprueba la guarda y la barra. Mis eventos llega con la 1.9. */
export default function PortadaOrganizador() {
  return (
    <GuardaRol rol="organizador" ruta="/organizador" titulo="Tus eventos" destinoActivo="mis-eventos">
      {(perfil) => (
        <Tarjeta className="flex flex-col gap-2">
          <p>Hola, {perfil.correo}.</p>
          <p className="text-meta text-ink-secondary">
            Aquí verás tus eventos y podrás crear uno nuevo muy pronto.
          </p>
        </Tarjeta>
      )}
    </GuardaRol>
  );
}
