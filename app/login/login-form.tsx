"use client";

import { useState } from "react";
import { AuthForm } from "./auth-form";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { ShinyText } from "@/components/react-bits/ShinyText";
import { ShieldCheck } from "lucide-react";

export function LoginForm() {
  const [modo, setModo] = useState<"login" | "signup">("login");

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      {/* Fondo tenue */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-slate-950 to-indigo-950/20 pointer-events-none" />

      <SpotlightCard className="w-full max-w-md bg-slate-900/80 border-white/10 p-8 rounded-3xl backdrop-blur-2xl shadow-2xl relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white font-extrabold text-2xl shadow-lg shadow-emerald-500/30">
              F
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-1.5">
                Finanzas <ShinyText text="Pro" className="text-xs font-black tracking-widest uppercase" />
              </h1>
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
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Autenticación cifrada & segura con Supabase</span>
        </div>
      </SpotlightCard>
    </div>
  );
}
