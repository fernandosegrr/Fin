"use client";

import { Copy, Loader2, SlidersHorizontal, Target } from "lucide-react";
import { BudgetProgressBar } from "./budget-progress-bar";
import { BudgetManagerModal } from "./budget-manager-modal";
import { GlowButton } from "@/components/react-bits/GlowButton";
import type { PresupuestoConGasto } from "@/lib/types";
import { formatearMonto, redondearMonto } from "@/lib/format";
import { useBudgetOverview } from "./budgets/use-budget-overview";

interface Props {
  items: PresupuestoConGasto[];
  mesISO: string;
  onPresupuestosGuardados?: () => void;
}

export function PresupuestosProgreso({ items, mesISO, onPresupuestosGuardados }: Props) {
  const {
    modalAbierto, setModalAbierto, copiando, mensajeCopia, errorCopia,
    hayAlgunLimite, conLimite, limiteTotal, gastoTotal, copiarDelMesAnterior,
  } = useBudgetOverview({ items, mesISO, onPresupuestosGuardados });

  return (
    <>
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
          <div className="rounded-2xl border border-[#DCE4DB] bg-white p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-black/5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[#5E7165]">Presupuesto Asignado</p>
              <Target className="h-4 w-4 text-[#317D7D]" />
            </div>
            <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-2 text-[#1C3028]">
              {formatearMonto(limiteTotal)}
            </p>
            <p className="text-[11px] text-[#7A897D] mt-1">En {conLimite.length} categorías con límite</p>
          </div>

          <div className="rounded-2xl border border-[#DCE4DB] bg-white p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-black/5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[#5E7165]">Total Gastado</p>
              <span className="text-xs font-bold text-[#AA524A] tabular-nums">
                {limiteTotal > 0 ? `${Math.round((gastoTotal / limiteTotal) * 100)}%` : "0%"}
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-2 text-[#1C3028]">
              {formatearMonto(gastoTotal)}
            </p>
            <p className="text-[11px] text-[#7A897D] mt-1">En categorías con límite fijado</p>
          </div>

          <div className={`rounded-2xl border p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-black/5 ${
            limiteTotal < gastoTotal
              ? "border-rose-500/20 bg-[#FCF0ED]"
              : "border-emerald-500/20 bg-[#EDF5EF]"
          }`}>
            <div className="flex items-center justify-between">
              <p className={`text-xs font-bold uppercase tracking-wider ${
                limiteTotal < gastoTotal ? "text-[#AA524A]" : "text-[#286F50]"
              }`}>
                Margen Disponible
              </p>
              <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                limiteTotal < gastoTotal ? "bg-rose-500/20 text-[#AA524A]" : "bg-emerald-500/20 text-[#286F50]"
              }`}>
                {limiteTotal < gastoTotal ? "Excedido" : "Bajo control"}
              </span>
            </div>
            <p className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-2 ${
              limiteTotal < gastoTotal ? "text-[#AA524A]" : "text-[#286F50]"
            }`}>
              {formatearMonto(redondearMonto(limiteTotal - gastoTotal))}
            </p>
            <p className="text-[11px] text-[#7A897D] mt-1">Colchón antes de exceder el límite</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="h-4 w-4 text-[#286F50] shrink-0" />
            <h2 className="text-base sm:text-lg font-black text-[#1C3028]">Límites por categoría</h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <GlowButton
              variant="secondary"
              onClick={copiarDelMesAnterior}
              disabled={copiando}
              className="!py-1.5 !px-2.5 !text-xs"
              title="Copia los límites del mes anterior que todavía no tienes este mes"
            >
              {copiando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Copiar mes anterior</span>
            </GlowButton>
            <GlowButton
              variant="primary"
              onClick={() => setModalAbierto(true)}
              className="!py-1.5 !px-3 !text-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Ajustar Límites
            </GlowButton>
          </div>
        </div>

        {mensajeCopia && (
          <p className="mb-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-[#286F50]">
            {mensajeCopia}
          </p>
        )}
        {errorCopia && (
          <p className="mb-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-[#AA524A]">
            {errorCopia}
          </p>
        )}
        {!hayAlgunLimite && !mensajeCopia && (
          <p className="mb-3 text-[11px] text-[#7A897D]">
            Tip: usa “Copiar mes anterior” para no armar los límites desde cero cada mes.
          </p>
        )}

        {items.length === 0 ? (
          <p className="text-xs text-[#5E7165]">No hay categorías de egreso configuradas.</p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {items.map((item) => (
              <BudgetProgressBar key={item.categoria.id} {...item} />
            ))}
          </div>
        )}
      </section>

      <BudgetManagerModal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        items={items}
        mesISO={mesISO}
        onGuardado={onPresupuestosGuardados}
      />
    </>
  );
}
