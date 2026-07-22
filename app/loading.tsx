export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#070a12]">
      <div className="flex flex-col items-center gap-4">
        {/* Logo placeholder animado */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 animate-pulse">
          <span className="text-2xl">💰</span>
        </div>
        {/* Barra de progreso indeterminada */}
        <div className="h-1 w-48 overflow-hidden rounded-full bg-slate-800 relative">
          <div className="h-full w-1/2 rounded-full bg-emerald-400 animate-[pulse_1s_ease-in-out_infinite]" />
        </div>
        <p className="text-xs text-slate-500 font-medium">Cargando...</p>
      </div>
    </div>
  );
}
