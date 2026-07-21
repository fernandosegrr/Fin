"use client";

export default function ErrorDashboard({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      <p className="text-sm font-medium text-slate-900">No se pudo cargar el dashboard.</p>
      <p className="text-xs text-slate-500">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Reintentar
      </button>
    </main>
  );
}
