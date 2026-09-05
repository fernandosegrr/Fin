import Image from "next/image";
import Link from "next/link";

interface BrandLogoProps {
  variant?: "icon" | "compact" | "full" | "hero";
  className?: string;
  withGlow?: boolean;
  withLink?: boolean;
}

export function BrandLogo({
  variant = "compact",
  className = "",
  withGlow = true,
  withLink = false,
}: BrandLogoProps) {
  const content = (
    <div className={`relative inline-flex items-center gap-3 select-none ${className}`}>
      {/* Resplandor neón ambiental inspirado en la gama esmeralda y púrpura del logo */}
      {withGlow && (
        <div
          className="absolute -inset-1 rounded-2xl opacity-60 blur-md pointer-events-none transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at 30% 50%, rgba(16, 244, 177, 0.35), rgba(139, 92, 246, 0.3) 70%, transparent 90%)",
          }}
          aria-hidden="true"
        />
      )}

      {/* Ícono de la marca */}
      <div
        className={`relative shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-lg shadow-emerald-500/5 transition-transform duration-300 group-hover:scale-105 ${
          variant === "icon"
            ? "h-10 w-10 p-1"
            : variant === "hero"
            ? "h-14 w-14 p-1.5"
            : variant === "full"
            ? "h-11 w-11 p-1"
            : "h-9 w-9 p-0.5"
        }`}
      >
        <Image
          src="/icon.png"
          alt="NexFin Logo"
          width={variant === "hero" ? 56 : variant === "full" ? 44 : 36}
          height={variant === "hero" ? 56 : variant === "full" ? 44 : 36}
          className="h-full w-full object-contain rounded-xl"
          priority
        />
      </div>

      {/* Tipografía de la marca */}
      {variant !== "icon" && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-tight text-white ${
                variant === "hero"
                  ? "text-3xl sm:text-4xl"
                  : variant === "full"
                  ? "text-xl sm:text-2xl"
                  : "text-base sm:text-lg"
              }`}
            >
              Nex<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-300">Fin</span>
            </span>
            <span className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-extrabold tracking-widest text-emerald-300 uppercase shadow-sm shadow-emerald-500/20">
              PRO
            </span>
          </div>
          {variant === "hero" && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 mt-1">
              Control Financiero Inteligente
            </span>
          )}
          {variant === "full" && (
            <span className="text-[10px] font-medium tracking-wider text-slate-400 mt-0.5">
              Finanzas Personales
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (withLink) {
    return (
      <Link href="/dashboard" className="group inline-flex items-center focus-visible:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
