import type { Metadata } from "next";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { BotonEnlace, Tarjeta } from "@/components/ui";

export const metadata: Metadata = { title: "Organizador · Reto 18" };

/** Portada mínima del organizador (1.8) con "Nuevo evento" (1.9). La lista de Mis eventos llega cuando haya endpoint. */
export default function PortadaOrganizador() {
  return (
    <GuardaRol rol="organizador" ruta="/organizador" titulo="Tus eventos" destinoActivo="mis-eventos">
      {(perfil) => (
        <>
          <BotonEnlace href="/organizador/eventos/nuevo" className="self-start max-sm:w-full">
            Nuevo evento
          </BotonEnlace>
          <Tarjeta className="flex flex-col gap-2">
            <p>Hola, {perfil.correo}.</p>
            <p className="text-meta text-ink-secondary">Muy pronto verás aquí la lista de tus eventos.</p>
          </Tarjeta>
        </>
      )}
    </GuardaRol>
  );
}
