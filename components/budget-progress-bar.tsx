"use client";

import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { formatearMonto } from "@/lib/format";
import type { PresupuestoConGasto } from "@/lib/types";

export function BudgetProgressBar({ categoria, presupuesto, gastado }: PresupuestoConGasto) {
  if (!presupuesto || presupuesto.monto_limite <= 0) {
    return (
      <div className="flex items-center justify-between p-4 rounded-2xl bg-[#F7F9F5] border border-[#DCE4DB] hover:border-[#CBD6CA] transition-colors">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-slate-500" />
          <span className="text-xs sm:text-sm font-semibold text-[#475C50]">{categoria.nombre}</span>
        </div>
        <div className="text-right">
          <span className="text-xs sm:text-sm font-bold tabular-nums text-[#263D33]">{formatearMonto(gastado)}</span>
          <p className="text-[10px] text-[#7A897D]">Sin límite fijado</p>
        </div>
      </div>
    );
  }

  const porcentaje = Math.max(0, Math.round((gastado / presupuesto.monto_limite) * 100));
  const excedido = gastado > presupuesto.monto_limite;
  const cercaDelLimite = porcentaje >= 80 && !excedido;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9F5] border border-[#DCE4DB] hover:border-[#CBD6CA] hover:bg-white transition-all space-y-3.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl border shrink-0 ${
              excedido
                ? "bg-rose-500/10 border-rose-500/30 text-[#AA524A]"
                : cercaDelLimite
                ? "bg-amber-500/10 border-amber-500/30 text-[#A66E31]"
                : "bg-emerald-500/10 border-emerald-500/30 text-[#286F50]"
            }`}
          >
            {excedido ? (
              <ShieldAlert className="h-4 w-4" />
            ) : cercaDelLimite ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </div>
          <span className="text-xs sm:text-sm font-bold text-[#263D33]">{categoria.nombre}</span>
        </div>

        <div className="text-right">
          <span className={`text-xs sm:text-sm font-black tabular-nums ${excedido ? "text-[#AA524A]" : "text-[#1C3028]"}`}>
            {formatearMonto(gastado)}{" "}
          </span>
          <span className="text-[11px] text-[#7A897D] font-medium">/ {formatearMonto(presupuesto.monto_limite)}</span>
        </div>
      </div>

      {/* Avance del presupuesto */}
      <div
        role="progressbar"
        aria-label={`Presupuesto de ${categoria.nombre}`}
        aria-valuenow={Math.min(100, porcentaje)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${porcentaje}% del límite gastado`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-[#F7F9F5] border border-[#DCE4DB] p-0.5"
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            excedido
              ? "bg-[#B8675D]"
              : cercaDelLimite
              ? "bg-[#B8864B]"
              : "bg-[#2B7353]"
          }`}
          style={{ width: `${Math.min(100, porcentaje)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#5E7165]">
        <span className="font-semibold">{porcentaje}% del límite</span>
        {excedido ? (
          <span className="font-bold text-[#AA524A]">¡Excedido por {formatearMonto(gastado - presupuesto.monto_limite)}!</span>
        ) : cercaDelLimite ? (
          <span className="font-bold text-[#A66E31]">Cerca del límite ({formatearMonto(presupuesto.monto_limite - gastado)} rest.)</span>
        ) : (
          <span className="text-[#475C50] font-medium">Disponible: {formatearMonto(presupuesto.monto_limite - gastado)}</span>
        )}
      </div>
    </div>
  );
}
