import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BarraInferior, IsotipoMarcaAgua, Logotipo, Pantalla } from "@/components/layout";
import { AccionCabeceraSesion } from "@/components/layout/pantalla-sesion";
import {
  Aviso,
  Boton,
  BotonEnlace,
  Campo,
  CampoContrasena,
  Chip,
  Esqueleto,
  EsqueletoGrupo,
  Tarjeta,
} from "@/components/ui";
import { ROLES, NOMBRE_ROL, type IconoDestino, type Rol } from "@/lib/navegacion";

export const metadata: Metadata = {
  title: "Muestra del sistema de diseño · Reto 18",
  robots: { index: false, follow: false },
};

type Muestra = { token: string; hex: string; uso: string };

const PALETA: Muestra[] = [
  { token: "surface-base", hex: "#F1F1F2", uso: "Lienzo del contenido" },
  { token: "surface-raised", hex: "#FFFFFF", uso: "Tarjetas y campos" },
  { token: "surface-overlay", hex: "#FFFFFF", uso: "Hojas, avisos" },
  { token: "border-hairline", hex: "#DCDCDE", uso: "Línea fina" },
  { token: "ink-primary", hex: "#373435", uso: "Texto principal y precios" },
  { token: "ink-secondary", hex: "#6D6E71", uso: "Texto secundario" },
  { token: "ink-muted", hex: "#727376", uso: "Bordes y deshabilitado, no texto" },
  { token: "accent", hex: "#ED3237", uso: "Botón principal, destino activo" },
  { token: "accent-pressed", hex: "#C4262B", uso: "Botón pulsado" },
  { token: "state-success", hex: "#2E8B57", uso: "Éxito" },
  { token: "state-warning", hex: "#B07A00", uso: "Advertencia" },
  { token: "state-error", hex: "#C4262B", uso: "Error (con icono y texto)" },
];

const PALETA_INVERSA: Muestra[] = [
  { token: "surface-inverse", hex: "#272424", uso: "Cabecera, pie, barra, panel" },
  { token: "surface-inverse-raised", hex: "#373435", uso: "Tarjetas sobre carbón" },
  { token: "border-inverse", hex: "#3F3C3C", uso: "Línea fina sobre carbón" },
  { token: "ink-on-inverse", hex: "#FFFFFF", uso: "Texto sobre carbón" },
  { token: "ink-on-inverse-secondary", hex: "#BDBFC1", uso: "Secundario sobre carbón, borde de campo" },
];

const PALETA_MAPA: Muestra[] = [
  { token: "price-1", hex: "#ED3237", uso: "Precio 1" },
  { token: "price-2", hex: "#F2A900", uso: "Precio 2" },
  { token: "price-3", hex: "#2BB5A0", uso: "Precio 3" },
  { token: "price-4", hex: "#7C8CFF", uso: "Precio 4" },
  { token: "seat-sold", hex: "#3A3B3D", uso: "Vendido" },
  { token: "seat-held", hex: "#727376", uso: "En pago" },
  { token: "seat-selected", hex: "#FFFFFF", uso: "Seleccionado" },
];

// Clases escritas enteras para que Tailwind las detecte.
const FONDO: Record<string, string> = {
  "surface-base": "bg-surface-base",
  "surface-raised": "bg-surface-raised",
  "surface-overlay": "bg-surface-overlay",
  "border-hairline": "bg-border-hairline",
  "ink-primary": "bg-ink-primary",
  "ink-secondary": "bg-ink-secondary",
  "ink-muted": "bg-ink-muted",
  accent: "bg-accent",
  "accent-pressed": "bg-accent-pressed",
  "state-success": "bg-state-success",
  "state-warning": "bg-state-warning",
  "state-error": "bg-state-error",
  "surface-inverse": "bg-surface-inverse",
  "surface-inverse-raised": "bg-surface-inverse-raised",
  "border-inverse": "bg-border-inverse",
  "ink-on-inverse": "bg-ink-on-inverse",
  "ink-on-inverse-secondary": "bg-ink-on-inverse-secondary",
  "price-1": "bg-price-1",
  "price-2": "bg-price-2",
  "price-3": "bg-price-3",
  "price-4": "bg-price-4",
  "seat-sold": "bg-seat-sold",
  "seat-held": "bg-seat-held",
  "seat-selected": "bg-seat-selected",
};

const ACTIVO_POR_ROL: Record<Rol, IconoDestino> = {
  publico: "eventos",
  organizador: "mis-eventos",
  administrador: "aprobar",
  puerta: "escanear",
};

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t border-border-hairline pt-6">
      <h2 id={id} className="text-title">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Muestras({ lista }: { lista: Muestra[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {lista.map(({ token, hex, uso }) => (
        <li key={token} className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={`size-10 shrink-0 rounded-sm border border-border-hairline ${FONDO[token]}`}
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-meta text-ink-primary">{token}</span>
            <span className="truncate text-meta text-ink-secondary">
              {hex} · {uso}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function MuestraSistemaDiseno() {
  return (
    <Pantalla
      titulo="Sistema de diseño"
      rol="publico"
      destinoActivo="eventos"
      accionCabecera={<AccionCabeceraSesion sesion={{ tipo: "anonima" }} />}
    >
      <p className="text-ink-secondary">
        Tokens, tipografía y componentes base del DESIGN.md. Revisa esta página a 360 px y a 1440 px: desde
        1024 px la cabecera lleva el menú del rol, hay pie y no hay barra inferior.
      </p>

      <Seccion id="paleta" titulo="Paleta">
        <Muestras lista={PALETA} />
        <h3 className="text-meta text-ink-secondary">Estructura carbón</h3>
        <Muestras lista={PALETA_INVERSA} />
        <h3 className="text-meta text-ink-secondary">Solo dentro del mapa de butacas</h3>
        <Muestras lista={PALETA_MAPA} />
      </Seccion>

      <Seccion id="logotipo" titulo="Logotipo">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="superficie-inversa relative flex min-h-32 items-center justify-center overflow-hidden rounded-md bg-surface-inverse p-6">
            <IsotipoMarcaAgua className="-right-6 -bottom-6 w-40 opacity-[0.06]" />
            <Logotipo variante="oscuro" className="relative h-14" />
          </div>
          <div className="flex min-h-32 items-center justify-center rounded-md border border-border-hairline bg-surface-raised p-6">
            <Logotipo variante="claro" className="h-14" />
          </div>
        </div>
        <p className="text-meta text-ink-secondary">
          logo-oscuro sobre carbón y logo-claro sobre claro; nunca menos de 120 px de ancho.
        </p>
      </Seccion>

      <Seccion id="tipografia" titulo="Tipografía · Inter">
        <p className="text-display">Muestra de Arte Piurano</p>
        <p className="text-meta text-ink-secondary">display · 28 / 900</p>
        <p className="text-title">Qué hacer en Piura</p>
        <p className="text-meta text-ink-secondary">title · 20 / 800</p>
        <p className="text-body">
          Elige tu butaca y recibe tu entrada con QR por WhatsApp. Pago simulado: no se cobra nada.
        </p>
        <p className="text-meta text-ink-secondary">body · 16 / 400</p>
        <p className="text-meta text-ink-secondary">Sáb 17 oct · 8:00 pm · Teatro Municipal, Piura</p>
        <p className="text-meta text-ink-secondary">meta · 13 / 500</p>
        <p className="text-button">Elegir butaca</p>
        <p className="text-meta text-ink-secondary">button · 16 / 700</p>
      </Seccion>

      <Seccion id="botones" titulo="Botones">
        <Boton anchoCompleto>Elegir butaca</Boton>
        <Boton variante="secundario" anchoCompleto>
          Ver mapa de la sede
        </Boton>
        <Boton anchoCompleto disabled>
          Pagar
        </Boton>
        <div className="flex flex-wrap gap-3">
          <Boton>Primario</Boton>
          <Boton variante="secundario">Secundario</Boton>
        </div>
        <div className="superficie-inversa flex flex-wrap gap-3 rounded-md bg-surface-inverse p-4">
          <Boton variante="inverso">Inverso sobre carbón</Boton>
        </div>
        <p className="text-meta text-ink-secondary">
          Al pulsar, el primario pasa a accent-pressed. Uno rojo por pantalla (aquí se repite solo para
          mostrarlo).
        </p>
      </Seccion>

      <Seccion id="campos" titulo="Campos">
        <Campo id="muestra-nombre" etiqueta="Nombre completo" autoComplete="name" />
        <Campo
          id="muestra-whatsapp"
          etiqueta="WhatsApp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          ayuda="Te enviamos tu entrada a este número."
          defaultValue="+51 987 654 321"
        />
        <Campo
          id="muestra-correo"
          etiqueta="Correo"
          type="email"
          defaultValue="lucia@correo"
          error="Escribe un correo completo, por ejemplo lucia@correo.pe."
        />
        <Campo id="muestra-sede" etiqueta="Sede" defaultValue="Teatro Municipal" disabled />
        <CampoContrasena id="muestra-contrasena" etiqueta="Contraseña" defaultValue="butaca-17" />
      </Seccion>

      <Seccion id="tarjetas" titulo="Tarjeta">
        <Tarjeta como="article" sinRelleno>
          <div className="relative flex aspect-[4/3] items-end overflow-hidden bg-surface-inverse p-3 text-ink-on-inverse">
            <IsotipoMarcaAgua className="top-3 right-3 w-12 opacity-50" />
            <h3 className="relative text-title">Muestra de Arte Piurano</h3>
          </div>
          <div className="flex flex-col gap-1 px-4 py-3">
            <p className="text-meta text-ink-secondary">Sáb 17 oct · 8:00 pm · Teatro Municipal, Piura</p>
            <p className="text-ink-secondary">
              Desde <span className="font-extrabold text-ink-primary">S/ 25</span>
            </p>
          </div>
        </Tarjeta>
        <Tarjeta>
          <p className="text-title">Tarjeta simple</p>
          <p className="text-ink-secondary">Superficie raised con línea fina, sin sombra.</p>
        </Tarjeta>
      </Seccion>

      <Seccion id="chips" titulo="Chips de filtro">
        <div className="flex flex-wrap gap-x-2 gap-y-4 py-2">
          <Chip activo>Este finde</Chip>
          <Chip>Categoría</Chip>
          <Chip>Distrito</Chip>
          <Chip>Precio</Chip>
        </div>
      </Seccion>

      <Seccion id="avisos" titulo="Avisos">
        <Aviso tipo="exito" titulo="Tu entrada está lista.">
          Muéstrala en la puerta.
        </Aviso>
        <Aviso tipo="advertencia" titulo="Te quedan 2 minutos para pagar.">
          Si se acaba el tiempo, tu butaca queda libre.
        </Aviso>
        <Aviso tipo="error" titulo="Falta la constancia de APDAYC para publicar con música." />
        <Aviso tipo="info" titulo="Pago simulado: no se cobra nada." />
        <Aviso
          tipo="error"
          titulo="No pudimos conectar con el servidor."
          accion={
            <BotonEnlace href="/muestra" variante="secundario">
              Reintentar
            </BotonEnlace>
          }
        >
          Revisa tu conexión e inténtalo de nuevo.
        </Aviso>
      </Seccion>

      <Seccion id="carga" titulo="Cargando">
        <EsqueletoGrupo etiqueta="Cargando eventos…">
          <Esqueleto className="aspect-[4/3] w-full rounded-md" />
          <Esqueleto className="h-5 w-2/3" />
          <Esqueleto className="h-4 w-1/2" />
        </EsqueletoGrupo>
      </Seccion>

      <Seccion id="barras" titulo="Barra inferior por rol">
        {ROLES.map((rol) => (
          <div key={rol} className="flex flex-col gap-2">
            <h3 className="text-meta text-ink-secondary">{NOMBRE_ROL[rol]}</h3>
            <div className="overflow-hidden rounded-md border border-border-hairline">
              <BarraInferior rol={rol} activo={ACTIVO_POR_ROL[rol]} fija={false} />
            </div>
          </div>
        ))}
      </Seccion>
    </Pantalla>
  );
}
