"use client";

import { useEffect } from "react";

/** Registra el SW de iconos. Falla en silencio si el navegador no lo soporta (Safari viejo, http local). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sin SW la app sigue funcionando; no merece un toast.
    });
  }, []);
  return null;
}
