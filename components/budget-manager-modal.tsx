"use client";

import { X, Save, ShieldCheck, Check } from "lucide-react";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { formatearMonto } from "@/lib/format";
import type { PresupuestoConGasto } from "@/lib/types";
import { useBudgetManager } from "./budgets/use-budget-manager";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  items: PresupuestoConGasto[];
  mesISO: string;
  onGuardado?: () => void;
}

export function BudgetManagerModal(props: Props) {
  const { abierto, onCerrar, items } = props;
  const { limites, isPending, mensajeExito, error, manejarCambio, guardarTodos } = useBudgetManager(props);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-gestion-presupuestos"
          className="w-full max-w-lg rounded-3xl border border-white/[0.08] bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div>
              <h2 id="titulo-gestion-presupuestos" className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Gestión de Presupuestos
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Establece límites de gasto para cada categoría de egreso.
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="rounded-xl p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
              {error}
            </div>
          )}

          {mensajeExito && (
            <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 flex items-center gap-2 font-bold">
              <Check className="h-4 w-4" /> Presupuestos actualizados con éxito.
            </div>
          )}

          {/* Lista de categorías con inputs */}
          <div className="mt-4 flex-1 overflow-y-auto space-y-2.5 pr-1">
            {items.map((item) => {
              const valorInput = limites[item.categoria.id] ?? "";
              return (
                <div
                  key={item.categoria.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                >
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-slate-200">{item.categoria.nombre}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                    Gastado este mes:{" "}
                    <span className="font-semibold text-slate-300">{formatearMonto(item.gastado)}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-slate-800/80 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-emerald-400/60">
                  <span className="text-xs text-slate-400 font-semibold">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Sin límite"
                    value={valorInput}
                    onChange={(e) => manejarCambio(item.categoria.id, e.target.value)}
                    className="w-24 bg-transparent text-sm text-right font-medium text-slate-100 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-end gap-3">
          <GlowButton variant="secondary" onClick={onCerrar} disabled={isPending}>
            Cancelar
          </GlowButton>
          <GlowButton variant="primary" onClick={guardarTodos} disabled={isPending}>
            <Save className="h-4 w-4" />
            {isPending ? "Guardando..." : "Guardar Cambios"}
          </GlowButton>
        </div>
      </div>
    </div>
  );
}
