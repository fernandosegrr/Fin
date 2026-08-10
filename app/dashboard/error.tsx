"use client";

export default function ErrorDashboard({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // No exponemos error.message en producción para evitar filtrar detalles internos
  const isDev = process.env.NODE_ENV === "development";

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
