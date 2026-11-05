import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Outfit } from "next/font/google";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NexFin Pro - Control Financiero Inteligente",
  description: "Plataforma inteligente de finanzas personales y gestión de ingresos/egresos",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NexFin Pro",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sin userScalable:false ni maximumScale:1: bloquear el pinch-to-zoom
  // rompe WCAG 1.4.4 (Resize Text) y afecta a quien necesita agrandar texto.
  maximumScale: 5,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f4f6f0",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={outfit.variable}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="bg-[#f4f6f0] text-[#1c3028] antialiased selection:bg-[#b9d8c0] font-sans">
        <RegisterServiceWorker />
        <div className="min-h-dvh w-full">{children}</div>
      </body>
    </html>
  );
}
