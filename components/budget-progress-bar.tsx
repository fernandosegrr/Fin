"use client";

import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { formatearMonto } from "@/lib/format";
import type { PresupuestoConGasto } from "@/lib/types";

export function BudgetProgressBar({ categoria, presupuesto, gastado }: PresupuestoConGasto) {
  if (!presupuesto || presupuesto.monto_limite <= 0) {
    return (
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/40 border border-white/[0.05] hover:border-white/[0.12] transition-colors">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-slate-500" />
          <span className="text-xs sm:text-sm font-semibold text-slate-300">{categoria.nombre}</span>
        </div>
        <div className="text-right">
          <span className="text-xs sm:text-sm font-bold tabular-nums text-slate-200">{formatearMonto(gastado)}</span>
          <p className="text-[10px] text-slate-500">Sin límite fijado</p>
        </div>
      </div>
    );
  }

  const porcentaje = Math.max(0, Math.round((gastado / presupuesto.monto_limite) * 100));
  const excedido = gastado > presupuesto.monto_limite;
  const cercaDelLimite = porcentaje >= 80 && !excedido;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-white/[0.06] hover:border-white/[0.16] hover:bg-slate-900/60 transition-all space-y-3.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl border shrink-0 ${
              excedido
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : cercaDelLimite
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
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
          <span className="text-xs sm:text-sm font-bold text-slate-200">{categoria.nombre}</span>
        </div>

        <div className="text-right">
          <span className={`text-xs sm:text-sm font-black tabular-nums ${excedido ? "text-rose-400" : "text-slate-100"}`}>
            {formatearMonto(gastado)}{" "}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">/ {formatearMonto(presupuesto.monto_limite)}</span>
        </div>
      </div>

      {/* Progress Bar con Glow */}
      <div
        role="progressbar"
        aria-label={`Presupuesto de ${categoria.nombre}`}
        aria-valuenow={Math.min(100, porcentaje)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${porcentaje}% del límite gastado`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-white/[0.05] p-0.5"
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            excedido
              ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
              : cercaDelLimite
              ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
              : "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,244,177,0.5)]"
          }`}
          style={{ width: `${Math.min(100, porcentaje)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-semibold">{porcentaje}% del límite</span>
        {excedido ? (
          <span className="font-bold text-rose-400">¡Excedido por {formatearMonto(gastado - presupuesto.monto_limite)}!</span>
        ) : cercaDelLimite ? (
          <span className="font-bold text-amber-400">Cerca del límite ({formatearMonto(presupuesto.monto_limite - gastado)} rest.)</span>
        ) : (
          <span className="text-slate-300 font-medium">Disponible: {formatearMonto(presupuesto.monto_limite - gastado)}</span>
        )}
      </div>
    </div>
  );
}
