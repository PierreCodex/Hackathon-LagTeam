"use client";

import { OrdenPagadaSchema, OrdenSchema, type ErrorApi, type EventoPublico, type MetodoPago } from "@reto18/shared";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Aviso, Boton, Campo, Selector } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import {
  categoriasDeZonaGeneral,
  OPCIONES_METODO_PAGO,
  opcionesCantidad,
  opcionesCategoria,
  totalCompra,
  validarSeleccionCompra,
} from "@/lib/compra";
import { rutaIngresar } from "@/lib/sesion";
import { tokenDelNavegador } from "@/lib/supabase/navegador";

export type FormularioCompraProps = {
  /** Base de la API (`API_URL`): el navegador llama directo con el token de la sesión. */
  apiUrl: string;
  evento: EventoPublico;
  /** `?ref=` de la URL del checkout (AD-8); se manda tal cual, sin validar. */
  refCampana?: string;
  /** WhatsApp del perfil, si hay sesión al cargar la página. */
  whatsappInicial?: string;
  /** Ruta de esta pantalla, para volver tras ingresar. */
  ruta: string;
};

type Fase = "idle" | "creando" | "pagando";

/**
 * Checkout de zona general con pago simulado (historia 8, Flow 2): crea la orden y paga en un solo
 * clic. Sin sesión al enviar, va a `/ingresar` y vuelve aquí. Si el pago falla tras crear la orden,
 * el id se conserva y "Reintentar" repite solo el pago -- nunca una segunda orden (AD-5: gastaría cupo).
 */
export function FormularioCompra({ apiUrl, evento, refCampana, whatsappInicial, ruta }: FormularioCompraProps) {
  const router = useRouter();
  // Solo zona general: las butacas numeradas se compran en el mapa (2.11).
  const categorias = categoriasDeZonaGeneral(evento.categorias);
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [cantidad, setCantidad] = useState(1);
  const [metodo, setMetodo] = useState<MetodoPago>("tarjeta");
  const [whatsapp, setWhatsapp] = useState(whatsappInicial ?? "");
  const [ordenId, setOrdenId] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("idle");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);

  const sinCategorias = categorias.length === 0;
  const ocupado = fase !== "idle";
  const pendientePago = ordenId !== null;
  const total = totalCompra(categorias, categoriaId, cantidad);

  async function pagar(id: string, token: string) {
    setFase("pagando");
    const pagada = await pedirApi(`ventas/ordenes/${encodeURIComponent(id)}/pagar`, OrdenPagadaSchema, {
      apiUrl,
      metodo: "POST",
      cuerpo: { metodo },
      cabeceras: { Authorization: `Bearer ${token}` },
    });
    setFase("idle");
    if (!pagada.ok) {
      setError(pagada.error);
      return;
    }
    router.push("/mis-entradas");
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    setErrorLocal(null);
    setError(null);

    if (!pendientePago) {
      const validacion = validarSeleccionCompra(categoriaId, cantidad);
      if (!validacion.ok) {
        setErrorLocal(validacion.mensaje);
        return;
      }
    }

    const token = await tokenDelNavegador();
    if (!token) {
      router.push(rutaIngresar(ruta));
      return;
    }

    if (pendientePago) {
      await pagar(ordenId, token);
      return;
    }

    setFase("creando");
    const creada = await pedirApi("ventas/ordenes", OrdenSchema, {
      apiUrl,
      metodo: "POST",
      cuerpo: { evento_id: evento.id, categoria_id: categoriaId, cantidad, ref: refCampana },
      cabeceras: { Authorization: `Bearer ${token}` },
    });
    if (!creada.ok) {
      setFase("idle");
      setError(creada.error);
      return;
    }
    setOrdenId(creada.datos.id);
    await pagar(creada.datos.id, token);
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4">
      <Selector
        id="categoria"
        etiqueta="Categoría"
        opciones={opcionesCategoria(categorias)}
        textoVacio={sinCategorias ? "Sin zona general en venta" : undefined}
        value={categoriaId}
        onChange={(e) => setCategoriaId(e.target.value)}
        disabled={pendientePago || sinCategorias}
      />
      <Selector
        id="cantidad"
        etiqueta="Cantidad de entradas"
        opciones={opcionesCantidad()}
        value={String(cantidad)}
        onChange={(e) => setCantidad(Number(e.target.value))}
        disabled={pendientePago || sinCategorias}
      />
      <Selector
        id="metodo-pago"
        etiqueta="Método de pago"
        opciones={OPCIONES_METODO_PAGO}
        value={metodo}
        onChange={(e) => setMetodo(e.target.value as MetodoPago)}
        disabled={sinCategorias}
      />
      <Campo
        id="whatsapp"
        etiqueta="WhatsApp"
        type="tel"
        autoComplete="tel"
        ayuda="Solo para mostrarlo aquí: en esta historia el QR no se envía por WhatsApp, se ve en Mis entradas."
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
      />

      {total && <p className="text-title">Total: {total}</p>}

      {errorLocal && (
        <Aviso tipo="error" titulo="Revisa tu selección.">
          {errorLocal}
        </Aviso>
      )}

      {error && (
        <Aviso tipo="error" titulo="No pudimos completar la compra.">
          {error.mensaje}
        </Aviso>
      )}

      <Boton type="submit" disabled={ocupado || sinCategorias} anchoCompleto>
        {fase === "creando"
          ? "Creando la orden…"
          : fase === "pagando"
            ? "Pagando…"
            : pendientePago
              ? "Reintentar pago"
              : "Comprar entradas"}
      </Boton>
    </form>
  );
}
