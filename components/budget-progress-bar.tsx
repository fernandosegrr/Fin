"use client";

import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { formatearMonto } from "@/lib/format";
import type { PresupuestoConGasto } from "@/lib/types";

export function BudgetProgressBar({ categoria, presupuesto, gastado }: PresupuestoConGasto) {
  if (!presupuesto || presupuesto.monto_limite <= 0) {
    return (
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/40 border border-white/5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-500" />
          <span className="text-sm font-medium text-slate-300">{categoria.nombre}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold tabular-nums text-slate-200">{formatearMonto(gastado)}</span>
          <p className="text-[10px] text-slate-500">Sin límite fijado</p>
        </div>
      </div>
    );
  }

  const porcentaje = Math.max(0, Math.round((gastado / presupuesto.monto_limite) * 100));
  const excedido = gastado > presupuesto.monto_limite;
  const cercaDelLimite = porcentaje >= 80 && !excedido;

  return (
    <div className="p-5 rounded-2xl bg-[#101720] border border-white/10 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {excedido ? (
            <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
          ) : cercaDelLimite ? (
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          )}
          <span className="text-sm font-semibold text-slate-200">{categoria.nombre}</span>
        </div>

        <div className="text-right">
          <span className={`text-sm font-bold tabular-nums ${excedido ? "text-rose-400" : "text-slate-100"}`}>
            {formatearMonto(gastado)}{" "}
          </span>
          <span className="text-xs text-slate-500">/ {formatearMonto(presupuesto.monto_limite)}</span>
        </div>
      </div>

      {/* Progress Bar con Glow */}
      <div role="progressbar" aria-label={`Presupuesto de ${categoria.nombre}`} aria-valuenow={Math.min(100, porcentaje)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${porcentaje}% del límite gastado`} className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            excedido
              ? "bg-rose-400"
              : cercaDelLimite
              ? "bg-amber-300"
              : "bg-emerald-300"
          }`}
          style={{ width: `${Math.min(100, porcentaje)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{porcentaje}% del límite</span>
        {excedido ? (
          <span className="font-semibold text-rose-400">¡Excedido por {formatearMonto(gastado - presupuesto.monto_limite)}!</span>
        ) : cercaDelLimite ? (
          <span className="font-medium text-amber-400">Cerca del límite</span>
        ) : (
          <span className="text-slate-400">Disponible: {formatearMonto(presupuesto.monto_limite - gastado)}</span>
        )}
      </div>
    </div>
  );
}
