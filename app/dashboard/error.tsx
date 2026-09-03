"use client";

import { useEffect, useRef, useState } from "react";

// Marca de tiempo del último reintento AUTOMÁTICO, a nivel de módulo (no de
// estado): este componente se vuelve a montar en cada error, así que un flag
// en useState se reiniciaría y podría entrar en bucle de reintentos.
let ultimoReintentoAutomatico = 0;
const ESPERA_ENTRE_REINTENTOS_MS = 15_000;
const RETARDO_REINTENTO_MS = 700;

export default function ErrorDashboard({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // No exponemos error.message en producción para evitar filtrar detalles internos
  const isDev = process.env.NODE_ENV === "development";
  const [reintentando, setReintentando] = useState(false);
  const resetRef = useRef(reset);
  resetRef.current = reset;

  // La causa más común de que esta pantalla aparezca es transitoria (la sesión
  // de Supabase se refresca justo al abrir la app tras un rato cerrada), y a
  // la segunda ya carga. Reintentar solo una vez, y como máximo cada 15 s,
  // convierte ese caso en un parpadeo en vez de un muro de error — sin
  // arriesgar un bucle si el fallo resulta ser permanente.
  useEffect(() => {
    const ahora = Date.now();
    if (ahora - ultimoReintentoAutomatico < ESPERA_ENTRE_REINTENTOS_MS) return;
    ultimoReintentoAutomatico = ahora;
    setReintentando(true);
    const t = setTimeout(() => resetRef.current(), RETARDO_REINTENTO_MS);
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
        onClick={reset}
        className="mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white transition-all shadow-lg shadow-emerald-600/25"
      >
        Reintentar
      </button>
    </main>
  );
}
