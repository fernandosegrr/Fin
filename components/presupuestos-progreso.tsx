"use client";

import { useState } from "react";
import { SlidersHorizontal, Target } from "lucide-react";
import { BudgetProgressBar } from "./budget-progress-bar";
import { BudgetManagerModal } from "./budget-manager-modal";
import { GlowButton } from "@/components/react-bits/GlowButton";
import type { PresupuestoConGasto } from "@/lib/types";

interface Props {
  items: PresupuestoConGasto[];
  mesISO: string;
}

export function PresupuestosProgreso({ items, mesISO }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <>
      <section className="mt-8 px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-200">Presupuestos Mensuales</h2>
          </div>

          <GlowButton
            variant="secondary"
            onClick={() => setModalAbierto(true)}
            className="!py-1.5 !px-3 !text-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Ajustar Límites
          </GlowButton>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-slate-400">No hay categorías de egreso configuradas.</p>
        ) : (
          <div className="space-y-3">
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
      />
    </>
  );
}
