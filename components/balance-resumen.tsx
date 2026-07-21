"use client";

import { ArrowUpRight, ArrowDownRight, Wallet, PiggyBank } from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { AnimatedNumber } from "@/components/react-bits/AnimatedNumber";
import { formatearMonto } from "@/lib/format";
import type { BalanceMensual } from "@/app/dashboard/actions";

interface Props {
  actual: BalanceMensual["actual"];
  anterior: BalanceMensual["anterior"];
}

export function BalanceResumen({ actual, anterior }: Props) {
  const balancePositivo = actual.balance >= 0;
  
  // Tasa de ahorro (%)
  const tasaAhorro = actual.ingresos > 0 
    ? Math.max(0, Math.round(((actual.ingresos - actual.egresos) / actual.ingresos) * 100))
    : 0;

  // Comparación contra el mes anterior
  const diferenciaEgresos = actual.egresos - anterior.egresos;
  const variacionEgresosPorcentaje = anterior.egresos > 0
    ? Math.round((diferenciaEgresos / anterior.egresos) * 100)
    : 0;

  return (
    <section className="pt-3">
      <SpotlightCard
        spotlightColor={balancePositivo ? "rgba(16, 185, 129, 0.2)" : "rgba(244, 63, 94, 0.2)"}
        className="relative overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#090d16] border border-white/10 p-4 sm:p-6 rounded-3xl"
      >
        {/* Glow tenue de fondo */}
        <div
          className={`absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl opacity-25 pointer-events-none ${
            balancePositivo ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Balance Neto
            </span>
          </div>

          {/* Badge de Tasa de Ahorro */}
          <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-semibold text-emerald-400 backdrop-blur-md shrink-0">
            <PiggyBank className="h-3.5 w-3.5" />
            <span>{tasaAhorro}% ahorrado</span>
          </div>
        </div>

        {/* Monto principal animado */}
        <div className="mt-3 flex items-baseline gap-2">
          <div
            className={`text-3xl sm:text-5xl font-black tracking-tight tabular-nums ${
              balancePositivo ? "text-slate-100" : "text-rose-400"
            }`}
          >
            <AnimatedNumber value={actual.balance} />
          </div>
        </div>

        {/* Egresos vs Ingresos en grid */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 pt-3 border-t border-white/10">
          {/* Egresos */}
          <div className="rounded-2xl border border-rose-500/20 bg-rose-950/30 p-2.5 sm:p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-rose-400">
              <ArrowDownRight className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="truncate">Egresos Mes</span>
            </div>
            <p className="mt-1 text-base sm:text-xl font-bold tabular-nums text-slate-100 truncate">
              <AnimatedNumber value={actual.egresos} />
            </p>
            {anterior.egresos > 0 && (
              <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                {variacionEgresosPorcentaje > 0 ? (
                  <span className="text-rose-400 font-medium">+{variacionEgresosPorcentaje}% vs mes ant.</span>
                ) : (
                  <span className="text-emerald-400 font-medium">{variacionEgresosPorcentaje}% vs mes ant.</span>
                )}
              </p>
            )}
          </div>

          {/* Ingresos */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/30 p-2.5 sm:p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-emerald-400">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">Ingresos Mes</span>
            </div>
            <p className="mt-1 text-base sm:text-xl font-bold tabular-nums text-slate-100 truncate">
              <AnimatedNumber value={actual.ingresos} />
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 truncate">
              Total percibido
            </p>
          </div>
        </div>

        {/* Referencia del mes anterior */}
        <div className="mt-3 flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
          <span>Mes anterior ({anterior.nombreMes}):</span>
          <span className="font-semibold tabular-nums text-slate-300">
            {formatearMonto(anterior.balance)}
          </span>
        </div>
      </SpotlightCard>
    </section>
  );
}
