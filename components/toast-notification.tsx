"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  texto: string;
  tipo?: "success" | "error" | "info";
}

interface Props {
  toast: ToastMessage | null;
  onCerrar: () => void;
}

export function ToastNotification({ toast, onCerrar }: Props) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onCerrar();
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast, onCerrar]);

  if (!toast) return null;

  const esExito = toast.tipo === "success" || !toast.tipo;
  const esError = toast.tipo === "error";

  return (
    <div
      className="fixed z-50 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all duration-300 animate-in fade-in slide-in-from-top-4"
      style={{
        top: "calc(1rem + env(safe-area-inset-top, 0px))",
        backgroundColor: esExito ? "rgba(6, 78, 59, 0.95)" : esError ? "rgba(136, 19, 55, 0.95)" : "rgba(15, 23, 42, 0.95)",
        borderColor: esExito ? "rgba(52, 211, 153, 0.4)" : esError ? "rgba(251, 113, 133, 0.4)" : "rgba(148, 163, 184, 0.4)",
      }}
    >
      {esExito ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0" />
      ) : esError ? (
        <AlertCircle className="h-5 w-5 text-rose-300 shrink-0" />
      ) : (
        <Info className="h-5 w-5 text-slate-300 shrink-0" />
      )}

      <span className="text-xs sm:text-sm font-semibold text-white tracking-wide">
        {toast.texto}
      </span>

      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar notificación"
        className="ml-2 p-1 text-slate-300 hover:text-white rounded-lg transition-all"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
