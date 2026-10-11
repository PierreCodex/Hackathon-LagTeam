import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PantallaAcceso } from "@/components/layout/pantalla-acceso";
import { destinoTrasIngreso, rutaInternaSegura } from "@/lib/sesion";
import { obtenerSesion } from "@/lib/sesion-servidor";
import { FormularioIngreso } from "./formulario-ingreso";

export const metadata: Metadata = { title: "Ingresar · Reto 18" };

export default async function Ingresar({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string | string[] }>;
}) {
  const { siguiente: crudo } = await searchParams;
  const siguiente = rutaInternaSegura(typeof crudo === "string" ? crudo : null);

  // Con sesión ya abierta no hace falta entrar otra vez.
  const sesion = await obtenerSesion();
  if (sesion.tipo === "cuenta") {
    redirect(destinoTrasIngreso(siguiente, sesion.perfil.rol));
  }

  return (
    <PantallaAcceso
      sesion={sesion}
      rutaActual="/ingresar"
      titulo="¡Bienvenido!"
      subtitulo="Ingresa a tu cuenta."
      enlaceInverso={{
        pregunta: "¿No tienes cuenta?",
        texto: "Regístrate",
        href: siguiente ? `/registro?siguiente=${encodeURIComponent(siguiente)}` : "/registro",
      }}
    >
      <FormularioIngreso siguiente={siguiente} />
    </PantallaAcceso>
  );
}
