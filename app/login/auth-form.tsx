"use client";

import { useActionState, useState } from "react";
import { Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import { signIn, signUp, type EstadoAuth } from "./actions";
import { GlowButton } from "@/components/react-bits/GlowButton";

const estadoInicial: EstadoAuth = { error: null, mensaje: null };

export function AuthForm({ modo }: { modo: "login" | "signup" }) {
  const [visible, setVisible] = useState(false);
  const [estado, formAction, pendiente] = useActionState(
    modo === "login" ? signIn : signUp,
    estadoInicial,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-[#475C50] mb-1">
          Correo Electrónico
        </label>
        <div className="relative flex items-center">
          <Mail className="absolute left-3.5 h-4 w-4 text-[#7A897D]" />
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            required
            className="w-full rounded-2xl border border-[#DCE4DB] bg-[#F7F9F5] pl-10 pr-4 py-3 text-sm text-[#1C3028] placeholder:text-[#96A399] focus:border-emerald-400/60 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-xs font-medium text-[#475C50] mb-1">
          Contraseña
        </label>
        <div className="relative flex items-center">
          <Lock className="absolute left-3.5 h-4 w-4 text-[#7A897D]" />
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete={modo === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
            required
            minLength={6}
            className="w-full rounded-2xl border border-[#DCE4DB] bg-[#F7F9F5] pl-10 pr-12 py-3 text-sm text-[#1C3028] placeholder:text-[#96A399] focus:border-emerald-400/60 focus:outline-none"
          />
          <button type="button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} onClick={() => setVisible(v => !v)} className="absolute right-2 p-2 text-[#5E7165]">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
      </div>

      {estado.error && (
        <p role="alert" className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-[#AA524A]">
          {estado.error}
        </p>
      )}
      {estado.mensaje && (
        <p role="status" className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-[#286F50]">
          {estado.mensaje}
        </p>
      )}

      <GlowButton
        type="submit"
        variant="primary"
        disabled={pendiente}
        className="w-full !py-3 font-bold text-base mt-2"
      >
        {pendiente ? (
          "Un momento…"
        ) : modo === "login" ? (
          <>
            Iniciar Sesión <ArrowRight className="h-4 w-4" />
          </>
        ) : (
          <>
            Crear Mi Cuenta <ArrowRight className="h-4 w-4" />
          </>
        )}
      </GlowButton>
    </form>
  );
}
