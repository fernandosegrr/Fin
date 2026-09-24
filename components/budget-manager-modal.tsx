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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14251D]/45 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-gestion-presupuestos"
          className="w-full max-w-lg rounded-3xl border border-[#DCE4DB] bg-white p-6 shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#DCE4DB]">
            <div>
              <h2 id="titulo-gestion-presupuestos" className="text-base sm:text-lg font-black text-[#1C3028] flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#286F50]" />
                Gestión de Presupuestos
              </h2>
              <p className="text-xs text-[#5E7165] mt-0.5">
                Establece límites de gasto para cada categoría de egreso.
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="rounded-xl p-1.5 text-[#5E7165] hover:bg-[#F4F7F2] hover:text-[#1C3028] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-[#AA524A]">
              {error}
            </div>
          )}

          {mensajeExito && (
            <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-[#286F50] flex items-center gap-2 font-bold">
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
                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#F7F9F5] border border-[#DCE4DB] hover:border-[#CBD6CA] transition-colors"
                >
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-[#263D33]">{item.categoria.nombre}</p>
                    <p className="text-[11px] text-[#5E7165] mt-0.5">
                    Gastado este mes:{" "}
                    <span className="font-semibold text-[#475C50]">{formatearMonto(item.gastado)}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-[#E8EEE7] border border-[#DCE4DB] rounded-xl px-3 py-1.5 focus-within:border-emerald-400/60">
                  <span className="text-xs text-[#5E7165] font-semibold">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Sin límite"
                    value={valorInput}
                    onChange={(e) => manejarCambio(item.categoria.id, e.target.value)}
                    className="w-24 bg-transparent text-sm text-right font-medium text-[#1C3028] placeholder:text-[#96A399] focus:outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#DCE4DB] flex items-center justify-end gap-3">
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
