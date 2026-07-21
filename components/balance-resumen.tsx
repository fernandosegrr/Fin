"use client";

import { ArrowUpRight, ArrowDownRight, Wallet, PiggyBank, CreditCard, Banknote, History } from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { AnimatedNumber } from "@/components/react-bits/AnimatedNumber";
import { formatearMonto } from "@/lib/format";
import type { BalanceMensual } from "@/app/dashboard/actions";

interface Props {
  actual: BalanceMensual["actual"];
  anterior: BalanceMensual["anterior"];
}

export function BalanceResumen({ actual, anterior }: Props) {
  const saldoPositivo = actual.saldoTotalDisponible >= 0;
  
  // Tasa de ahorro (%)
  const tasaAhorro = actual.ingresos > 0 
    ? Math.max(0, Math.round(((actual.ingresos - actual.egresos) / actual.ingresos) * 100))
    : 0;

  return (
    <section className="pt-3">
      <SpotlightCard
        spotlightColor={saldoPositivo ? "rgba(16, 185, 129, 0.2)" : "rgba(244, 63, 94, 0.2)"}
        className="relative overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#090d16] border border-white/10 p-4 sm:p-6 rounded-3xl"
      >
        {/* Glow tenue de fondo */}
        <div
          className={`absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl opacity-25 pointer-events-none ${
            saldoPositivo ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />

        {/* Encabezado del Balance */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block leading-none">
                Saldo Total Disponible
              </span>
              <span className="text-[9px] text-slate-400 font-medium">
                (Acumulado histórico + Flujo del mes)
              </span>
            </div>
          </div>

          {/* Badge de Tasa de Ahorro */}
          <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-semibold text-emerald-400 backdrop-blur-md shrink-0">
            <PiggyBank className="h-3.5 w-3.5" />
            <span>{tasaAhorro}% ahorrado</span>
          </div>
        </div>

        {/* Monto principal: Saldo Total Disponible Acumulado */}
        <div className="mt-3 flex items-baseline gap-2">
          <div
            className={`text-3xl sm:text-5xl font-black tracking-tight tabular-nums ${
              saldoPositivo ? "text-slate-100" : "text-rose-400"
            }`}
          >
            <AnimatedNumber value={actual.saldoTotalDisponible} />
          </div>
        </div>

        {/* Linea de Arrastre de Meses Anteriores */}
        {actual.saldoInicial !== 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-300">
            <History className="h-3.5 w-3.5 text-indigo-400" />
            <span>Arrastre meses anteriores: <strong>{formatearMonto(actual.saldoInicial)}</strong></span>
          </div>
        )}

        {/* Grid de Egresos e Ingresos del Mes */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 pt-3 border-t border-white/10">
          {/* Egresos */}
          <div className="rounded-2xl border border-rose-500/20 bg-rose-950/30 p-2.5 sm:p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-rose-400">
              <ArrowDownRight className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="truncate">Egresos del Mes</span>
            </div>
            <p className="mt-1 text-base sm:text-xl font-bold tabular-nums text-slate-100 truncate">
              <AnimatedNumber value={actual.egresos} />
            </p>
          </div>

          {/* Ingresos */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/30 p-2.5 sm:p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-emerald-400">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">Ingresos del Mes</span>
            </div>
            <p className="mt-1 text-base sm:text-xl font-bold tabular-nums text-slate-100 truncate">
              <AnimatedNumber value={actual.ingresos} />
            </p>
          </div>
        </div>

        {/* Desglose por Método de Pago: Efectivo vs Tarjeta / Banco */}
        <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px]">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-white/5">
            <span className="flex items-center gap-1.5 text-slate-400 font-medium truncate">
              <Banknote className="h-3.5 w-3.5 text-amber-400 shrink-0" /> Efectivo:
            </span>
            <span className="font-bold tabular-nums text-slate-200">
              {formatearMonto(actual.totalesEfectivo.neto)}
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-white/5">
            <span className="flex items-center gap-1.5 text-slate-400 font-medium truncate">
              <CreditCard className="h-3.5 w-3.5 text-cyan-400 shrink-0" /> Tarjeta/Banco:
            </span>
            <span className="font-bold tabular-nums text-slate-200">
              {formatearMonto(actual.totalesTarjeta.neto)}
            </span>
          </div>
        </div>
      </SpotlightCard>
    </section>
  );
}
