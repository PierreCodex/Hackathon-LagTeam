import type { Metadata } from "next";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { Tarjeta } from "@/components/ui";

export const metadata: Metadata = { title: "Administración · Reto 18" };

/** Portada mínima del administrador (1.8): comprueba la guarda y la barra. Aprobar llega con la 1.10. */
export default function PortadaAdmin() {
  return (
    <GuardaRol rol="admin" ruta="/admin" titulo="Administración" destinoActivo="aprobar">
      {(perfil) => (
        <Tarjeta className="flex flex-col gap-2">
          <p>Hola, {perfil.correo}.</p>
          <p className="text-meta text-ink-secondary">
            Aquí aprobarás los eventos pendientes muy pronto.
          </p>
        </Tarjeta>
      )}
    </GuardaRol>
  );
}
