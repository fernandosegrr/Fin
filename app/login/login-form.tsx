"use client";

import { useState } from "react";
import { AuthForm } from "./auth-form";
import { Wallet, PieChart, Target } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const beneficios = [
  { icon: Wallet, label: "Cuentas claras" },
  { icon: PieChart, label: "Gastos visibles" },
  { icon: Target, label: "Metas reales" },
];

export function LoginForm() {
  const [modo, setModo] = useState<"login" | "signup">("login");

  return (
    <div className="login-layout flex min-h-dvh items-center justify-center bg-[#F4F6F0] p-4 sm:p-8">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-stretch gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden min-h-[610px] flex-col rounded-[28px] bg-[#1E4635] p-10 text-white lg:flex xl:p-12">
          <div><BrandLogo variant="full" /></div>
          <div className="mt-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B8D8C1]">Tu espacio financiero</p>
            <h1 className="mt-5 max-w-lg text-5xl font-semibold leading-[1.08] tracking-tight xl:text-6xl">
              Entiende tu dinero.<br />Decide con calma.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-[#D6E3D9]">
              Un lugar sencillo para seguir tus ingresos, gastos, compromisos y metas mes a mes.
            </p>
            <div className="mt-12 grid grid-cols-3 gap-3 border-t border-white/20 pt-6">
              {beneficios.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs font-medium text-[#E4EDE5]">
                  <Icon className="h-4 w-4 shrink-0 text-[#B8D8C1]" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="mx-auto flex w-full max-w-md flex-col justify-center rounded-[28px] border border-[#DCE4DB] bg-white p-6 shadow-[0_24px_60px_-48px_rgba(31,67,43,0.3)] sm:p-10 lg:max-w-none"
          aria-label="Acceso a NexFin"
        >
          <div className="mb-8">
            <BrandLogo variant="compact" className="mb-7 lg:hidden" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#286F50]">Bienvenido</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1C3028]">
              {modo === "login" ? "Entra a tu cuenta" : "Crea tu cuenta"}
            </h2>
            <p className="mt-2 text-sm text-[#5E7165]">
              {modo === "login"
                ? "Tus finanzas, con una vista más clara."
                : "Empieza a organizar tus movimientos y metas."}
            </p>
          </div>

          <div className="flex rounded-xl border border-[#DCE4DB] bg-[#F4F7F2] p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setModo("login")}
              aria-pressed={modo === "login"}
              className={`flex-1 rounded-lg py-2.5 transition-colors ${modo === "login" ? "bg-white text-[#1C3028] shadow-sm" : "text-[#5E7165] hover:text-[#1C3028]"}`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => setModo("signup")}
              aria-pressed={modo === "signup"}
              className={`flex-1 rounded-lg py-2.5 transition-colors ${modo === "signup" ? "bg-white text-[#1C3028] shadow-sm" : "text-[#5E7165] hover:text-[#1C3028]"}`}
            >
              Crear cuenta
            </button>
          </div>

          <AuthForm key={modo} modo={modo} />
          <p className="mt-8 border-t border-[#DCE4DB] pt-5 text-center text-xs text-[#7A897D]">
            Un paso a la vez, con tus números en orden.
          </p>
        </section>
      </div>
    </div>
  );
}
