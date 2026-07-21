import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Finanzas personales",
};

// viewportFit: "cover" habilita env(safe-area-inset-*) en dispositivos con
// notch/home-indicator — lo usa el botón flotante de captura rápida.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      {/* bg-slate-100 detrás de la columna: en pantallas anchas se nota que
          el layout mobile-first (max-w-app) sigue centrado a propósito,
          en vez de verse como contenido roto pegado a la izquierda. */}
      <body className="bg-slate-100 text-slate-900 antialiased">
        <div className="mx-auto min-h-dvh w-full max-w-app bg-white shadow-sm">{children}</div>
      </body>
    </html>
  );
}
