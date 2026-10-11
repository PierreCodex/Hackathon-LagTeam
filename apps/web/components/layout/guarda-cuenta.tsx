import type { Perfil, Rol as RolApi } from "@reto18/shared";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BotonEnlace, Tarjeta } from "@/components/ui";
import type { IconoDestino } from "@/lib/navegacion";
import { guardaDeCuenta, NOMBRE_PLURAL_ROL, rutaIngresar } from "@/lib/sesion";
import { obtenerSesion } from "@/lib/sesion-servidor";
import { PantallaSesion, type PantallaSesionProps } from "./pantalla-sesion";

export type GuardaCuentaProps = {
  /** Roles que puede usar la ruta; sin lista (o vacía), cualquier cuenta autenticada (historia 8). */
  roles?: readonly RolApi[];
  /** Ruta de la página, para volver a ella tras entrar o al reintentar. */
  ruta: string;
  titulo: string;
  destinoActivo?: IconoDestino;
  /** Ancho del contenido con el rol correcto (ver `Pantalla`). */
  ancho?: PantallaSesionProps["ancho"];
  /** Contenido de la página; solo se pinta con una cuenta permitida. */
  children: (perfil: Perfil) => ReactNode;
};

/** "para organizadores o administradores"; sin lista, cualquier cuenta. */
function nombrePluralRoles(roles: readonly RolApi[]): string {
  return roles.map((rol) => NOMBRE_PLURAL_ROL[rol]).join(" o ");
}

/**
 * Guarda en el servidor para "cualquier cuenta" o "una lista de roles" (historia 8: `GuardaRol` exige
 * un único rol exacto, y aquí "Mis entradas" es de cualquier cuenta y el escáner de organizador o admin).
 * Mismo comportamiento que `GuardaRol`, sin modificarlo: sin sesión → `/ingresar` (y vuelta); rol fuera
 * de la lista → "Esta sección es para …"; perfil sin leer → aviso con "Reintentar".
 */
export async function GuardaCuenta({ roles, ruta, titulo, destinoActivo, ancho, children }: GuardaCuentaProps) {
  const sesion = await obtenerSesion();
  const guarda = guardaDeCuenta(sesion, roles);

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
            Esta sección es para {roles && roles.length > 0 ? nombrePluralRoles(roles) : "cuentas registradas"}
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
