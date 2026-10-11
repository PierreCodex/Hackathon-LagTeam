import type { Metadata } from "next";
import { GuardaRol } from "@/components/layout/guarda-rol";
import { PizarraMapa } from "@/components/pizarra/pizarra-mapa";

export const metadata: Metadata = { title: "Nueva sede · Reto 18" };

const RUTA = "/organizador/sedes/nueva";

/** Crea una sede desde la pizarra vacía (historia 2.9, CAP-15). */
export default function NuevaSede() {
  return (
    <GuardaRol rol="organizador" ruta={RUTA} titulo="Nueva sede" destinoActivo="mis-eventos">
      {() => <PizarraMapa modo="crear" apiUrl={process.env.API_URL ?? ""} />}
    </GuardaRol>
  );
}
