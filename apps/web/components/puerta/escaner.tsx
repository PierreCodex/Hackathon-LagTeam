"use client";

import { BrowserQRCodeReader } from "@zxing/browser";
import { ResultadoValidacionSchema, ValidarEntradaSchema } from "@reto18/shared";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Aviso, BotonEnlace } from "@/components/ui";
import { pedirApi } from "@/lib/api";
import {
  avisoDeErrorValidacion,
  avisoDeResultadoValidacion,
  debeProcesarCodigo,
  mensajeErrorCamara,
  type EstadoAvisoEscaneo,
} from "@/lib/escaner";
import { rutaIngresar } from "@/lib/sesion";
import { tokenDelNavegador } from "@/lib/supabase/navegador";

export type EscanerProps = {
  /** Base de la API (`API_URL`): el navegador llama directo con el token de la sesión. */
  apiUrl: string;
  eventoId: string;
  /** Ruta de esta pantalla, para volver tras ingresar si la sesión se cerró. */
  ruta: string;
};

/** Lo mínimo de `IScannerControls` (`@zxing/browser`) que usa este componente. */
type ControlesEscaner = { stop: () => void };

/**
 * Escáner de la puerta (historia 8, Flow 3): cámara en vivo con lectura continua (`@zxing/browser`).
 * Por cada código decodificado valida contra la API y sigue escaneando, acierte o no -- salvo que no
 * haya permiso de cámara, caso en el que no hay nada que escanear hasta que se vuelva a intentar.
 */
export function Escaner({ apiUrl, eventoId, ruta }: EscanerProps) {
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const ocupadoRef = useRef(false);
  const ultimoRef = useRef<{ texto: string; en: number } | null>(null);

  const [aviso, setAviso] = useState<EstadoAvisoEscaneo | null>(null);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [sinSesion, setSinSesion] = useState(false);

  useEffect(() => {
    let controles: ControlesEscaner | null = null;
    let cancelado = false;

    async function validar(qr: string) {
      const datos = ValidarEntradaSchema.safeParse({ qr });
      const token = await tokenDelNavegador();
      if (cancelado) return;

      if (!token) {
        setSinSesion(true);
        return;
      }
      setSinSesion(false);

      if (!datos.success) {
        setAviso(avisoDeErrorValidacion({ codigo: "QR_INVALIDO", mensaje: "El QR no es una entrada válida" }));
        return;
      }

      const resultado = await pedirApi(
        `acceso/eventos/${encodeURIComponent(eventoId)}/validar`,
        ResultadoValidacionSchema,
        { apiUrl, metodo: "POST", cuerpo: datos.data, cabeceras: { Authorization: `Bearer ${token}` } },
      );
      if (cancelado) return;
      setAviso(resultado.ok ? avisoDeResultadoValidacion(resultado.datos) : avisoDeErrorValidacion(resultado.error));
    }

    async function iniciar() {
      const lector = new BrowserQRCodeReader();
      try {
        const nuevosControles = await lector.decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (resultado) => {
          if (cancelado || !resultado) return;
          const texto = resultado.getText();
          const ahora = Date.now();
          if (ocupadoRef.current || !debeProcesarCodigo(ultimoRef.current, texto, ahora)) return;
          ultimoRef.current = { texto, en: ahora };
          ocupadoRef.current = true;
          void validar(texto).finally(() => {
            ocupadoRef.current = false;
          });
        });
        if (cancelado) {
          nuevosControles.stop();
        } else {
          controles = nuevosControles;
        }
      } catch (error) {
        if (!cancelado) setErrorCamara(mensajeErrorCamara(error));
      }
    }

    void iniciar();
    return () => {
      cancelado = true;
      controles?.stop();
    };
  }, [apiUrl, eventoId]);

  return (
    <div className="flex flex-col gap-4">
      {sinSesion && (
        <Aviso
          tipo="error"
          titulo="Tu sesión se cerró."
          accion={
            <BotonEnlace href={rutaIngresar(ruta)} variante="secundario">
              Ingresar
            </BotonEnlace>
          }
        >
          Ingresa de nuevo para seguir escaneando.
        </Aviso>
      )}

      {errorCamara && (
        <Aviso
          tipo="error"
          titulo="No pudimos usar la cámara."
          accion={
            <BotonEnlace href={pathname} variante="secundario" prefetch={false}>
              Reintentar
            </BotonEnlace>
          }
        >
          {errorCamara}
        </Aviso>
      )}

      <div className="overflow-hidden rounded-md border border-border-hairline bg-surface-inverse-raised">
        {/* `@zxing/browser` eligen la resolución y la reproducen; sin controles propios de vídeo. */}
        <video ref={videoRef} muted playsInline className="aspect-square w-full object-cover" />
      </div>

      {aviso && (
        <Aviso tipo={aviso.tipo} titulo={aviso.titulo}>
          {aviso.detalle}
        </Aviso>
      )}

      <p className="text-meta text-ink-secondary">
        Apunta la cámara al código QR de la entrada. Sigue escaneando después de cada resultado.
      </p>
    </div>
  );
}
