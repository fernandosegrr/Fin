"use client";

import { useState } from "react";
import { AuthForm } from "./auth-form";
import { Wallet, ChartNoAxesCombined, Target } from "lucide-react";

export function LoginForm() {
  const [modo, setModo] = useState<"login" | "signup">("login");

  return (
    <div className="login-layout">
      {/* Fondo tenue */}
      <section className="login-story">
        <div className="sidebar-brand"><span className="brand-mark">n.</span> nexfin<span className="brand-tag">PRO</span></div>
        <p className="eyebrow mt-20">MENOS RUIDO. MÁS CLARIDAD.</p>
        <h1 className="text-6xl font-medium tracking-tight leading-[1.08] mt-5">Tu dinero.<br />Tus planes.<br /><span className="text-emerald-300">Tu tranquilidad.</span></h1>
        <p className="text-slate-400 text-lg leading-relaxed mt-6 max-w-sm">Un solo lugar para entender tus gastos, organizar tus pagos y avanzar hacia tus metas.</p>
        <div className="flex gap-4 mt-10">{[Wallet, ChartNoAxesCombined, Target].map((Icon, i) => <div key={i} className="rounded-2xl border border-white/10 p-4 text-emerald-300"><Icon size={24} /></div>)}</div>
      </section>

      <section className="login-panel" aria-label="Acceso a NexFin">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="brand-mark">n.</span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-100">{modo === "login" ? "Todo bajo control." : "Empieza con claridad."}</h2>
              <p className="text-xs text-slate-400">
                {modo === "login" ? "Accede a tu plataforma" : "Comienza a gestionar tu patrimonio"}
              </p>
            </div>
          </div>
        </div>

        {/* Switch de modo */}
        <div className="flex rounded-2xl bg-slate-950 p-1.5 border border-white/5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setModo("login")}
            aria-pressed={modo === "login"}
            className={`flex-1 rounded-xl py-2.5 transition-all ${
              modo === "login"
                ? "bg-slate-800 text-white shadow-md shadow-slate-900/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => setModo("signup")}
            aria-pressed={modo === "signup"}
            className={`flex-1 rounded-xl py-2.5 transition-all ${
              modo === "signup"
                ? "bg-slate-800 text-white shadow-md shadow-slate-900/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        <AuthForm key={modo} modo={modo} />

        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span>Tu próximo paso hacia unas finanzas más organizadas.</span>
        </div>
      </section>
    </div>
  );
}
