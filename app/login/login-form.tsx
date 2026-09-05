"use client";

import { useState } from "react";
import { AuthForm } from "./auth-form";
import { Wallet, PieChart, Target, Sparkles, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export function LoginForm() {
  const [modo, setModo] = useState<"login" | "signup">("login");

  return (
    <div className="login-layout relative min-h-dvh flex items-center justify-center p-4 sm:p-8">
      {/* Fondo con resplandores atmosféricos neón */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
        {/* Story / Hero de la marca (Desktop) */}
        <section className="login-story hidden lg:flex flex-col justify-center select-none pr-4">
          <div>
            <BrandLogo variant="hero" />
          </div>

          <div className="mt-12">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">
              Control Financiero de Nueva Generación
            </span>
            <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.1] mt-3 text-slate-100">
              Tu dinero. Tus metas.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300">
                Con certeza total.
              </span>
            </h1>
            <p className="text-slate-400 text-sm xl:text-base leading-relaxed mt-4 max-w-md">
              Un espacio privado, rápido y sofisticado para entender cada movimiento, automatizar compromisos fijos y potenciar tu ahorro.
            </p>
          </div>

          {/* Badges de características */}
          <div className="flex flex-wrap gap-3 mt-8">
            {[
              { icon: Wallet, label: "Control de Cuentas" },
              { icon: PieChart, label: "Métricas en Vivo" },
              { icon: Target, label: "Metas y Presupuestos" },
              { icon: Sparkles, label: "Asesor Financiero IA" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-300 backdrop-blur-md shadow-sm"
              >
                <Icon size={15} className="text-emerald-400" />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Encriptación integral y acceso seguro verificado.</span>
          </div>
        </section>

        {/* Panel del Formulario (Móvil y Desktop) */}
        <section
          className="w-full max-w-md mx-auto rounded-3xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-950/90 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-black/50"
          aria-label="Acceso a NexFin"
        >
          {/* Cabecera con BrandLogo para móvil */}
          <div className="flex flex-col items-center lg:items-start mb-6">
            <BrandLogo variant="compact" className="mb-4 lg:hidden" />
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-100">
              {modo === "login" ? "Bienvenido de nuevo" : "Crea tu espacio"}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {modo === "login"
                ? "Ingresa a tu plataforma de finanzas personales"
                : "Comienza a gestionar tu patrimonio con total claridad"}
            </p>
          </div>

          {/* Switch de modo segmentado */}
          <div className="flex rounded-2xl bg-slate-950/80 p-1.5 border border-white/[0.06] text-xs font-bold mb-6 shadow-inner">
            <button
              type="button"
              onClick={() => setModo("login")}
              aria-pressed={modo === "login"}
              className={`flex-1 rounded-xl py-2.5 transition-all duration-200 ${
                modo === "login"
                  ? "bg-slate-800 text-white shadow-md shadow-black/40 border border-white/10"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => setModo("signup")}
              aria-pressed={modo === "signup"}
              className={`flex-1 rounded-xl py-2.5 transition-all duration-200 ${
                modo === "signup"
                  ? "bg-slate-800 text-white shadow-md shadow-black/40 border border-white/10"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          <AuthForm key={modo} modo={modo} />

          <div className="mt-6 pt-4 border-t border-white/[0.08] text-center text-xs text-slate-500">
            <span>NexFin Pro · Diseñado para tu libertad financiera</span>
          </div>
        </section>
      </div>
    </div>
  );
}
