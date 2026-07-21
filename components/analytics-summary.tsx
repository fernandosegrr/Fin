"use client";

import { Calendar, PieChart, Receipt, Activity } from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { formatearMonto } from "@/lib/format";
import type { TransaccionConCategoria } from "@/lib/types";

interface Props {
  transacciones: TransaccionConCategoria[];
  totalEgresos: number;
}

export function AnalyticsSummary({ transacciones, totalEgresos }: Props) {
  // Calculo de gastos Fijos vs Variables
  let egresosFijos = 0;
  let egresosVariables = 0;

  for (const t of transacciones) {
    if (t.categoria?.tipo === "egreso") {
      if (t.categoria.grupo === "fijo") egresosFijos += t.monto;
      else if (t.categoria.grupo === "variable") egresosVariables += t.monto;
    }
  }

  // Promedio diario (asumiendo días transcurridos)
  const hoyDia = new Date().getDate();
  const promedioDiario = totalEgresos > 0 ? Math.round(totalEgresos / Math.max(1, hoyDia)) : 0;

  // Categoria de mayor gasto
  const gastoPorCat = new Map<string, { nombre: string; monto: number }>();
  for (const t of transacciones) {
    if (t.categoria?.tipo === "egreso") {
      const actual = gastoPorCat.get(t.categoria_id) ?? {
        nombre: t.categoria.nombre,
        monto: 0,
      };
      gastoPorCat.set(t.categoria_id, {
        nombre: t.categoria.nombre,
        monto: actual.monto + t.monto,
      });
    }
  }

  let topCategoria = { nombre: "Sin egresos", monto: 0 };
  for (const item of gastoPorCat.values()) {
    if (item.monto > topCategoria.monto) {
      topCategoria = item;
    }
  }

  const porcentajeFijo = totalEgresos > 0 ? Math.round((egresosFijos / totalEgresos) * 100) : 0;
  const porcentajeVariable = totalEgresos > 0 ? Math.round((egresosVariables / totalEgresos) * 100) : 0;

  return (
    <section className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          Métricas Financieras
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {/* Promedio Diario */}
        <SpotlightCard className="p-3 sm:p-4 bg-slate-900/60 border-white/10 rounded-2xl">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold">
            <Calendar className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">Promedio Diario</span>
          </div>
          <p className="mt-1.5 text-base sm:text-lg font-bold text-slate-100 tabular-nums">
            {formatearMonto(promedioDiario)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400 truncate">por día del mes</p>
        </SpotlightCard>

        {/* Categoria Top */}
        <SpotlightCard className="p-3 sm:p-4 bg-slate-900/60 border-white/10 rounded-2xl">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold">
            <Receipt className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">Mayor Gasto</span>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm font-bold text-slate-100 truncate" title={topCategoria.nombre}>
            {topCategoria.nombre}
          </p>
          <p className="mt-0.5 text-[10px] text-indigo-300 font-bold tabular-nums">
            {formatearMonto(topCategoria.monto)}
          </p>
        </SpotlightCard>

        {/* Fijo vs Variable */}
        <SpotlightCard className="p-3 sm:p-4 bg-slate-900/60 border-white/10 rounded-2xl col-span-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5">
              <PieChart className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              Gastos Fijos vs Variables
            </span>
            <span className="text-[10px] font-bold text-slate-200">
              {porcentajeFijo}% Fijo / {porcentajeVariable}% Var.
            </span>
          </div>

          {/* Progress bar dual */}
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex mt-2">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${porcentajeFijo}%` }}
              title={`Fijos: ${formatearMonto(egresosFijos)}`}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${porcentajeVariable}%` }}
              title={`Variables: ${formatearMonto(egresosVariables)}`}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" /> Fijo: {formatearMonto(egresosFijos)}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" /> Var: {formatearMonto(egresosVariables)}
            </span>
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}
