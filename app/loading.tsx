import { BrandLogo } from "@/components/brand-logo";

export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#06080f] px-4 select-none">
      {/* Resplandor ambiental de fondo */}
      <div className="absolute h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />

      <div className="relative flex flex-col items-center gap-5">
        {/* Logo oficial animado */}
        <div className="relative animate-bounce duration-1000">
          <div className="absolute -inset-3 rounded-full bg-emerald-400/20 blur-xl animate-pulse" />
          <BrandLogo variant="hero" withGlow />
        </div>

        {/* Barra de progreso de carga estilizada */}
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-900 border border-white/[0.08] relative mt-2">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 animate-[pulse_1.2s_ease-in-out_infinite] shadow-[0_0_12px_rgba(16,244,177,0.8)]" />
        </div>

        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase mt-1">
          Sincronizando espacio financiero…
        </p>
      </div>
    </div>
  );
}
