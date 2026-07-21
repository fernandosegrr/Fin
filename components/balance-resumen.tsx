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
    <section className="px-4 pt-4">
      <SpotlightCard
        spotlightColor={balancePositivo ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)"}
        className="relative overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-white/10"
      >
        {/* Glow de fondo tenue */}
        <div
          className={`absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl opacity-30 pointer-events-none ${
            balancePositivo ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Balance Neto
            </span>
          </div>

          {/* Badge de Tasa de Ahorro */}
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 backdrop-blur-md">
            <PiggyBank className="h-3.5 w-3.5" />
            <span>{tasaAhorro}% ahorrado</span>
          </div>
        </div>

        {/* Monto principal animado */}
        <div className="mt-3 flex items-baseline gap-2">
          <div
            className={`text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums ${
              balancePositivo ? "text-slate-100" : "text-rose-400"
            }`}
          >
            <AnimatedNumber value={actual.balance} />
          </div>
        </div>

        {/* Egresos vs Ingresos en grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
          {/* Egresos */}
          <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-3 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-xs font-medium text-rose-400">
              <ArrowDownRight className="h-4 w-4 text-rose-500" />
              <span>Egresos del Mes</span>
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-100">
              <AnimatedNumber value={actual.egresos} />
            </p>
            {anterior.egresos > 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                {variacionEgresosPorcentaje > 0 ? (
                  <span className="text-rose-400 font-medium">+{variacionEgresosPorcentaje}% vs mes anterior</span>
                ) : (
                  <span className="text-emerald-400 font-medium">{variacionEgresosPorcentaje}% vs mes anterior</span>
                )}
              </p>
            )}
          </div>

          {/* Ingresos */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-3 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              <span>Ingresos del Mes</span>
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-100">
              <AnimatedNumber value={actual.ingresos} />
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Total percibido
            </p>
          </div>
        </div>

        {/* Referencia del mes anterior */}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>Mes anterior ({anterior.nombreMes}):</span>
          <span className="font-semibold tabular-nums text-slate-300">
            {formatearMonto(anterior.balance)}
          </span>
        </div>
      </SpotlightCard>
    </section>
  );
}
