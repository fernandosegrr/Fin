"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { BalanceResumen } from "@/components/balance-resumen";
import { AnalyticsSummary } from "@/components/analytics-summary";
import { FinancialCharts } from "@/components/financial-charts";
import { PresupuestosProgreso } from "@/components/presupuestos-progreso";
import { TransactionsSection } from "@/components/transactions-section";
import { MonthSelector } from "@/components/month-selector";
import { ExportButton } from "@/components/export-button";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { ShinyText } from "@/components/react-bits/ShinyText";
import { obtenerBalanceMensual, obtenerPresupuestosConGasto, signOut, type BalanceMensual } from "@/app/dashboard/actions";
import { primerDiaDelMes } from "@/lib/dates";
import type { Categoria, PresupuestoConGasto } from "@/lib/types";

interface Props {
  initialBalance: BalanceMensual;
  initialPresupuestos: PresupuestoConGasto[];
  categorias: Categoria[];
}

export function DashboardContainer({ initialBalance, initialPresupuestos, categorias }: Props) {
  const [balance, setBalance] = useState<BalanceMensual>(initialBalance);
  const [presupuestos, setPresupuestos] = useState<PresupuestoConGasto[]>(initialPresupuestos);
  const [anio, setAnio] = useState(initialBalance.actual.anio);
  const [mes, setMes] = useState(initialBalance.actual.mes);
  const [isPending, startTransition] = useTransition();

  function cambiarMes(nuevoAnio: number, nuevoMes: number) {
    setAnio(nuevoAnio);
    setMes(nuevoMes);

    startTransition(async () => {
      try {
        const [nuevoBalance, nuevosPresupuestos] = await Promise.all([
          obtenerBalanceMensual(nuevoAnio, nuevoMes),
          obtenerPresupuestosConGasto(nuevoAnio, nuevoMes),
        ]);
        setBalance(nuevoBalance);
        setPresupuestos(nuevosPresupuestos);
      } catch (err) {
        console.error("Error cambiando de mes:", err);
      }
    });
  }

  const mesISO = primerDiaDelMes(anio, mes);

  return (
    <main className="min-h-dvh max-w-app sm:max-w-desktop mx-auto pb-28 px-3 sm:px-6 bg-[#070a12]">
      {/* Top Navbar responsiva */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-3 sm:px-4 py-2.5 bg-[#070a12]/90 backdrop-blur-xl border-b border-white/10 -mx-3 sm:-mx-6 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white font-black text-lg shadow-lg shadow-emerald-500/25 shrink-0">
            F
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1.5 leading-none">
              Finanzas <ShinyText text="Pro" className="text-[10px] sm:text-xs font-black tracking-widest uppercase" />
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Control Inteligente</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <ExportButton
            transacciones={balance.actual.transacciones}
            nombreMes={balance.actual.nombreMes}
          />
          <form action={signOut}>
            <GlowButton variant="ghost" type="submit" className="!p-2" title="Cerrar sesión">
              <LogOut className="h-4 w-4 text-slate-400 hover:text-rose-400" />
            </GlowButton>
          </form>
        </div>
      </header>

      {/* Selector de Mes */}
      <div className="pt-2">
        <MonthSelector anio={anio} mes={mes} onCambiarMes={cambiarMes} />
      </div>

      {isPending && (
        <div className="mt-2">
          <div className="h-1 w-full bg-emerald-500/20 overflow-hidden rounded-full">
            <div className="h-full bg-emerald-400 animate-pulse w-1/2" />
          </div>
        </div>
      )}

      {/* Dashboard Sections */}
      <BalanceResumen actual={balance.actual} anterior={balance.anterior} />

      <AnalyticsSummary
        transacciones={balance.actual.transacciones}
        totalEgresos={balance.actual.egresos}
      />

      <FinancialCharts
        transacciones={balance.actual.transacciones}
        ingresosTotales={balance.actual.ingresos}
        egresosTotales={balance.actual.egresos}
      />

      <PresupuestosProgreso items={presupuestos} mesISO={mesISO} />

      <TransactionsSection
        key={`${anio}-${mes}`}
        initialTransacciones={balance.actual.transacciones}
        categorias={categorias}
      />
    </main>
  );
}
