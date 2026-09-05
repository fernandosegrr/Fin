"use client";

import { useState } from "react";
import { Copy, Loader2, SlidersHorizontal, Target } from "lucide-react";
import { BudgetProgressBar } from "./budget-progress-bar";
import { BudgetManagerModal } from "./budget-manager-modal";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { copiarPresupuestosMesAnterior } from "@/app/dashboard/actions";
import type { PresupuestoConGasto } from "@/lib/types";
import { formatearMonto } from "@/lib/format";

interface Props {
  items: PresupuestoConGasto[];
  mesISO: string;
  onPresupuestosGuardados?: () => void;
}

export function PresupuestosProgreso({ items, mesISO, onPresupuestosGuardados }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [mensajeCopia, setMensajeCopia] = useState<string | null>(null);
  const [errorCopia, setErrorCopia] = useState<string | null>(null);

  const hayAlgunLimite = items.some((i) => i.presupuesto);
  const conLimite = items.filter(item => item.presupuesto);
  const limiteTotal = conLimite.reduce((total, item) => total + Number(item.presupuesto!.monto_limite), 0);
  const gastoTotal = conLimite.reduce((total, item) => total + item.gastado, 0);

  async function copiarDelMesAnterior() {
    if (copiando) return;
    setCopiando(true);
    setErrorCopia(null);
    setMensajeCopia(null);
    const resultado = await copiarPresupuestosMesAnterior(mesISO);
    if (resultado.ok) {
      setMensajeCopia(
        resultado.copiados === 1
          ? "Se copió 1 presupuesto del mes anterior."
          : `Se copiaron ${resultado.copiados} presupuestos del mes anterior.`,
      );
      onPresupuestosGuardados?.();
    } else {
      setErrorCopia(resultado.error);
    }
    setCopiando(false);
  }

  return (
    <>
      <section>
        <div className="budget-overview mb-7">
          <div><p className="eyebrow">TU PLAN DEL MES</p><p className="text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight mt-3">{formatearMonto(limiteTotal)}</p><p className="text-sm text-slate-400 mt-2">en {conLimite.length} categorías con límite</p></div>
          <div><p className="text-sm text-slate-400">Gastado en esas categorías</p><p className="text-2xl font-semibold tabular-nums mt-2">{formatearMonto(gastoTotal)}</p></div>
          <div><p className="text-sm text-slate-400">Margen total</p><p className={`text-2xl font-semibold tabular-nums mt-2 ${limiteTotal < gastoTotal ? "text-rose-300" : "text-emerald-300"}`}>{formatearMonto(limiteTotal - gastoTotal)}</p></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="h-4 w-4 text-emerald-400 shrink-0" />
            <h2 className="text-lg font-semibold text-slate-200">Límites por categoría</h2>
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
          <p className="mb-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400">
            {mensajeCopia}
          </p>
        )}
        {errorCopia && (
          <p className="mb-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
            {errorCopia}
          </p>
        )}
        {!hayAlgunLimite && !mensajeCopia && (
          <p className="mb-3 text-[11px] text-slate-500">
            Tip: usa “Copiar mes anterior” para no armar los límites desde cero cada mes.
          </p>
        )}

        {items.length === 0 ? (
          <p className="text-xs text-slate-400">No hay categorías de egreso configuradas.</p>
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
