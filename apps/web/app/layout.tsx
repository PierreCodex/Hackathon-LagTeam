import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Inter sustituye a Swis721 BT del manual (DESIGN.md · Typography).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Reto 18 · Eventos culturales de Piura",
  description: "Plataforma de eventos culturales de Piura",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#272424",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-surface-base font-sans text-body text-ink-primary">{children}</body>
    </html>
  );
}
