import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PantallaSesion } from "@/components/layout/pantalla-sesion";
import { destinoTrasIngreso, rutaInternaSegura } from "@/lib/sesion";
import { obtenerSesion } from "@/lib/sesion-servidor";
import { FormularioRegistro } from "./formulario-registro";

export const metadata: Metadata = { title: "Crear cuenta · Reto 18" };

export default async function Registro({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string | string[] }>;
}) {
  const { siguiente: crudo } = await searchParams;
  const siguiente = rutaInternaSegura(typeof crudo === "string" ? crudo : null);

  const sesion = await obtenerSesion();
  if (sesion.tipo === "cuenta") {
    redirect(destinoTrasIngreso(siguiente, sesion.perfil.rol));
  }

  return (
    <PantallaSesion sesion={sesion} rutaActual="/registro" titulo="Crear cuenta">
      <FormularioRegistro siguiente={siguiente} />
    </PantallaSesion>
  );
}
