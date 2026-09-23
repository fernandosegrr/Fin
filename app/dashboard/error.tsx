"use client";

import { useEffect, useState } from "react";

// sessionStorage sobrevive a una recarga de la página: limita el reintento
// automático incluso cuando el error reaparece tras recargar el documento.
const CLAVE_REINTENTO = "nexfin-dashboard-reintento";
const ESPERA_ENTRE_REINTENTOS_MS = 30_000;
const RETARDO_REINTENTO_MS = 900;

export default function ErrorDashboard({
  error,
}: {
  error: Error & { digest?: string };
}) {
  // No exponemos error.message en producción para evitar filtrar detalles internos
  const isDev = process.env.NODE_ENV === "development";
  const [reintentando, setReintentando] = useState(false);

  // Al reabrir la app el navegador hace una petición nueva con las cookies
  // recién actualizadas. Hacemos esa misma recarga una sola vez ante el error.
  useEffect(() => {
    try {
      const ultimo = Number(sessionStorage.getItem(CLAVE_REINTENTO) ?? 0);
      if (Date.now() - ultimo < ESPERA_ENTRE_REINTENTOS_MS) return;
    } catch {
      return;
    }
    setReintentando(true);
    const t = setTimeout(() => {
      try {
        const ahora = Date.now();
        const ultimo = Number(sessionStorage.getItem(CLAVE_REINTENTO) ?? 0);
        if (ahora - ultimo < ESPERA_ENTRE_REINTENTOS_MS) {
          setReintentando(false);
          return;
        }
        sessionStorage.setItem(CLAVE_REINTENTO, String(ahora));
        window.location.reload();
      } catch {
        setReintentando(false);
      }
    }, RETARDO_REINTENTO_MS);
    return () => clearTimeout(t);
  }, []);

  if (reintentando) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#070a12] px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 animate-pulse">
          <span className="text-2xl">💰</span>
        </div>
        <p className="text-xs font-medium text-slate-400">Reconectando…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#070a12] px-6 text-center">
      <p className="text-sm font-medium text-slate-100">No se pudo cargar el dashboard.</p>
      <p className="text-xs text-slate-400">
        Ocurrió un error al leer tus datos. Por favor intenta de nuevo.
      </p>
      {isDev && error.message && (
        <p className="mt-1 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400 text-left font-mono">
          {error.message}
        </p>
      )}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white transition-all shadow-lg shadow-emerald-600/25"
      >
        Reintentar
      </button>
    </main>
  );
}
