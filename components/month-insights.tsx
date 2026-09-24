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
      <div className="rounded-2xl border border-[#DCE4DB] bg-white p-3.5 sm:p-4 backdrop-blur-xl shadow-lg shadow-black/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* El arrastre cubre un gasto mayor que los ingresos del mes. */}
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${
                color === "rose" ? "bg-rose-500/15 border-rose-500/30 text-[#AA524A]" :
                  color === "amber" ? "bg-amber-500/15 border-amber-500/30 text-[#A66E31]" :
                    "bg-emerald-500/15 border-emerald-500/30 text-[#286F50]"
              }`}
            >
              {faltaDinero ? <TrendingDown className="h-5 w-5" /> : usoArrastre ? <History className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E7165]">
                  {faltaDinero ? "Saldo por cubrir" : usoArrastre ? "Usado del saldo anterior" : "Variación del mes"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    color === "rose" ? "bg-rose-500/20 text-[#AA524A] border border-rose-500/30" :
                      color === "amber" ? "bg-amber-500/20 text-[#A66E31] border border-amber-500/30" :
                        "bg-emerald-500/20 text-[#286F50] border border-emerald-500/30"
                  }`}
                >
                  {faltaDinero ? "Faltante" : usoArrastre ? "Cubierto" : flujoNeto > 0 ? "A favor" : "Sin cambio"}
                </span>
              </div>
              <p
                className={`text-lg sm:text-xl font-black tabular-nums tracking-tight mt-0.5 ${
                  color === "rose" ? "text-[#AA524A]" : color === "amber" ? "text-[#A66E31]" : "text-[#286F50]"
                }`}
              >
                {!faltaDinero && !usoArrastre && flujoNeto > 0 ? "+" : ""}
                {formatearMonto(importe)}
              </p>
            </div>
          </div>

          {/* Métricas rápidas: Ratio de gasto y Fijo vs Variable */}
          <div className="flex items-center gap-2 sm:gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#DCE4DB] text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F4F7F2] border border-[#DCE4DB]">
              <Activity className="h-3.5 w-3.5 text-[#317D7D] shrink-0" />
              <div>
                <p className="text-[10px] text-[#5E7165] leading-none">Fondos utilizados</p>
                <p className="font-bold text-[#263D33] tabular-nums mt-0.5">
                  {ratioGasto === null ? actual.egresos > 0 ? "Sin fondos" : "0% utilizado" : `${ratioGasto}% utilizado`}
                </p>
              </div>
            </div>

            {actual.egresos > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F4F7F2] border border-[#DCE4DB]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#62688B] shrink-0" />
                <div>
                  <p className="text-[10px] text-[#5E7165] leading-none">Gastos fijos</p>
                  <p className="font-bold text-[#263D33] tabular-nums mt-0.5">
                    {formatearMonto(actual.egresosFijos)}
                  </p>
                </div>
              </div>
            )}

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F4F7F2] border border-[#DCE4DB]">
              <Zap className="h-3.5 w-3.5 text-[#A66E31] shrink-0" />
              <div>
                <p className="text-[10px] text-[#5E7165] leading-none">Movimientos</p>
                <p className="font-bold text-[#263D33] tabular-nums mt-0.5">
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
