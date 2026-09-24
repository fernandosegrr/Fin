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
      className="fixed z-50 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-[#DCE4DB] border-l-4 bg-white px-4 py-3 shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-top-4"
      style={{
        top: "calc(1rem + env(safe-area-inset-top, 0px))",
        borderLeftColor: esExito ? "#286F50" : esError ? "#AA524A" : "#62688B",
      }}
    >
      {esExito ? (
        <CheckCircle2 className="h-5 w-5 text-[#286F50] shrink-0" />
      ) : esError ? (
        <AlertCircle className="h-5 w-5 text-[#AA524A] shrink-0" />
      ) : (
        <Info className="h-5 w-5 text-[#475C50] shrink-0" />
      )}

      <span className="text-xs sm:text-sm font-semibold text-[#1C3028]">
        {toast.texto}
      </span>

      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar notificación"
        className="ml-2 p-1 text-[#475C50] hover:text-[#1C3028] rounded-lg transition-all"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
