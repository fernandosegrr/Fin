"use client";

export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // No exponemos error.message en producción para evitar filtrar detalles internos
  const isDev = process.env.NODE_ENV === "development";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#070a12] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
        <span className="text-3xl">⚠️</span>
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-slate-100">Algo salió mal</p>
        <p className="text-sm text-slate-400">
          Ocurrió un error inesperado. Por favor intenta de nuevo.
        </p>
        {isDev && error.message && (
          <p className="mt-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400 text-left font-mono">
            {error.message}
          </p>
        )}
      </div>
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
