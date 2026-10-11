import type { Perfil, Rol as RolApi } from "@reto18/shared";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BotonEnlace, Tarjeta } from "@/components/ui";
import type { IconoDestino } from "@/lib/navegacion";
import { guardaDeRol, NOMBRE_PLURAL_ROL, rutaIngresar } from "@/lib/sesion";
import { obtenerSesion } from "@/lib/sesion-servidor";
import { PantallaSesion, type PantallaSesionProps } from "./pantalla-sesion";

export type GuardaRolProps = {
  /** Rol que pide la ruta. */
  rol: RolApi;
  /** Ruta de la página, para volver a ella tras entrar o al reintentar. */
  ruta: string;
  titulo: string;
  destinoActivo?: IconoDestino;
  /** Ancho del contenido con el rol correcto (ver `Pantalla`). */
  ancho?: PantallaSesionProps["ancho"];
  /** Contenido de la página; solo se pinta con el rol correcto. */
  children: (perfil: Perfil) => ReactNode;
};

/**
 * Guarda de rol en el servidor, antes de pintar. Sin sesión → `/ingresar` (y vuelta);
 * otro rol → "Esta sección es para …" sin datos del rol; perfil sin leer → aviso con "Reintentar".
 * Ocultar es comodidad: el permiso real lo da la API (AD-3).
 */
export async function GuardaRol({ rol, ruta, titulo, destinoActivo, ancho, children }: GuardaRolProps) {
  const sesion = await obtenerSesion();
  const guarda = guardaDeRol(sesion, rol);

  if (guarda.tipo === "ingresar") {
    redirect(rutaIngresar(ruta));
  }

  if (guarda.tipo === "error") {
    return <PantallaSesion sesion={sesion} rutaActual={ruta} />;
  }

  if (guarda.tipo === "sin-permiso") {
    return (
      <PantallaSesion sesion={sesion} rutaActual={ruta} ancho="formulario">
        <Tarjeta como="section" aria-labelledby="titulo-sin-permiso" className="flex flex-col gap-4">
          <h1 id="titulo-sin-permiso" className="text-title">
            Esta sección es para {NOMBRE_PLURAL_ROL[guarda.rolRequerido]}
          </h1>
          <p className="text-ink-secondary">Tu cuenta no tiene acceso a esta parte de la web.</p>
          <BotonEnlace href={guarda.portada} anchoCompleto>
            Volver al inicio
          </BotonEnlace>
        </Tarjeta>
      </PantallaSesion>
    );
  }

  return (
    <PantallaSesion sesion={sesion} rutaActual={ruta} titulo={titulo} destinoActivo={destinoActivo} ancho={ancho}>
      {children(guarda.perfil)}
    </PantallaSesion>
  );
}
