"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Esqueleto } from "@/components/ui";

export type QrEntradaProps = {
  /** Texto a codificar: `entrada.qr` (`entrada_id.firma`, AD-7). */
  valor: string;
  /** Para el `alt` de la imagen: qué entrada es. */
  etiqueta: string;
};

/**
 * QR de una entrada (historia 8, Flow 2), dibujado en el navegador con `qrcode`. Solo se muestra en
 * pantalla: no se manda por WhatsApp (2.2) ni se guarda en ningún lado.
 */
export function QrEntrada({ valor, etiqueta }: QrEntradaProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    QRCode.toDataURL(valor, { margin: 1, width: 240 })
      .then((url) => {
        if (!cancelado) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelado) setFallo(true);
      });
    return () => {
      cancelado = true;
    };
  }, [valor]);

  if (fallo) return null;
  if (!dataUrl) {
    return <Esqueleto className="aspect-square w-full max-w-60" />;
  }
  return (
    // `next/image` no aporta nada a un data URL generado en el navegador.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUrl} alt={`Código QR de la entrada: ${etiqueta}`} className="w-full max-w-60 rounded-sm" />
  );
}
