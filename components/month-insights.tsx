"use client";

import React from "react";
import { TrendingUp, TrendingDown, ShieldCheck, Zap, Activity, History } from "lucide-react";
import type { BalanceMensual } from "@/app/dashboard/actions";
import { formatearMonto } from "@/lib/format";

export function MonthInsights({ actual }: { actual: BalanceMensual["actual"] }) {
  const flujoNeto = actual.balance;
  const faltaDinero = actual.saldoTotalDisponible < 0;
  const usoArrastre = flujoNeto < 0 && actual.saldoInicial > 0 && !faltaDinero;
  const fondosDelMes = Math.max(0, actual.saldoInicial + actual.ingresos);
  const ratioGasto = fondosDelMes > 0 ? Math.round((actual.egresos / fondosDelMes) * 100) : null;
  const color = faltaDinero ? "rose" : usoArrastre ? "amber" : "emerald";
  const importe = faltaDinero ? Math.abs(actual.saldoTotalDisponible) : usoArrastre ? Math.abs(flujoNeto) : flujoNeto;

  return (
    <section aria-label="Resumen de salud financiera del mes" className="mb-4">
      <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950/80 p-3.5 sm:p-4 backdrop-blur-xl shadow-lg shadow-black/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* El arrastre cubre un gasto mayor que los ingresos del mes. */}
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${
                color === "rose" ? "bg-rose-500/15 border-rose-500/30 text-rose-400" :
                  color === "amber" ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
                    "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              }`}
            >
              {faltaDinero ? <TrendingDown className="h-5 w-5" /> : usoArrastre ? <History className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {faltaDinero ? "Saldo por cubrir" : usoArrastre ? "Usado del saldo anterior" : "Variación del mes"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    color === "rose" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" :
                      color === "amber" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                        "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {faltaDinero ? "Faltante" : usoArrastre ? "Cubierto" : flujoNeto > 0 ? "A favor" : "Sin cambio"}
                </span>
              </div>
              <p
                className={`text-lg sm:text-xl font-black tabular-nums tracking-tight mt-0.5 ${
                  color === "rose" ? "text-rose-400" : color === "amber" ? "text-amber-300" : "text-emerald-300"
                }`}
              >
                {!faltaDinero && !usoArrastre && flujoNeto > 0 ? "+" : ""}
                {formatearMonto(importe)}
              </p>
            </div>
          </div>

          {/* Métricas rápidas: Ratio de gasto y Fijo vs Variable */}
          <div className="flex items-center gap-2 sm:gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06] text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Activity className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 leading-none">Fondos utilizados</p>
                <p className="font-bold text-slate-200 tabular-nums mt-0.5">
                  {ratioGasto === null ? actual.egresos > 0 ? "Sin fondos" : "0% utilizado" : `${ratioGasto}% utilizado`}
                </p>
              </div>
            </div>

            {actual.egresos > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 leading-none">Gastos fijos</p>
                  <p className="font-bold text-slate-200 tabular-nums mt-0.5">
                    {formatearMonto(actual.egresosFijos)}
                  </p>
                </div>
              </div>
            )}

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 leading-none">Movimientos</p>
                <p className="font-bold text-slate-200 tabular-nums mt-0.5">
                  {actual.totalTransaccionesMes} este mes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
