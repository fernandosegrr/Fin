"use client";

import { Calendar, PieChart, Receipt, Activity, Users } from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { formatearMonto } from "@/lib/format";
import { diasTranscurridosEnMes } from "@/lib/dates";
import type { EgresoPorCategoria, IngresoPorCliente } from "@/lib/types";

interface Props {
  /** Ya agregados en el servidor sobre TODO el mes (no sobre la lista recortada a 200 filas). */
  egresosFijos: number;
  egresosVariables: number;
  egresosPorCategoria: EgresoPorCategoria[];
  totalEgresos: number;
  ingresosPorCliente?: IngresoPorCliente[];
  anio: number;
  mes: number;
}

export function AnalyticsSummary({
  egresosFijos,
  egresosVariables,
  egresosPorCategoria,
  totalEgresos,
  ingresosPorCliente = [],
  anio,
  mes,
}: Props) {
  // Promedio diario: días transcurridos DEL MES QUE SE ESTÁ VIENDO, no de hoy
  // (si no, ver enero muestra el gasto total de enero dividido entre el día
  // de hoy en agosto).
  const diasTranscurridos = diasTranscurridosEnMes(anio, mes);
  const promedioDiario = totalEgresos > 0 ? Math.round(totalEgresos / Math.max(1, diasTranscurridos)) : 0;

  // `egresosPorCategoria` ya llega ordenado de mayor a menor desde el servidor.
  const topCategoria = egresosPorCategoria[0] ?? { nombre: "Sin egresos", monto: 0 };

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
          <p className="mt-0.5 text-xs text-slate-400 truncate">por día del mes</p>
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
          <p className="mt-0.5 text-xs text-indigo-300 font-bold tabular-nums">
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
            <span className="text-xs font-bold text-slate-200">
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

          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" /> Fijo: {formatearMonto(egresosFijos)}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" /> Var: {formatearMonto(egresosVariables)}
            </span>
          </div>
        </SpotlightCard>
      </div>

      {ingresosPorCliente.length > 0 && (
        <SpotlightCard className="mt-2.5 p-3 sm:p-4 bg-slate-900/60 border-white/10 rounded-2xl">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold mb-2">
            <Users className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            Ingresos por cliente / proyecto
          </div>
          <div className="space-y-1.5">
            {ingresosPorCliente.slice(0, 8).map((c) => (
              <div key={c.cliente_id ?? "sin"} className="flex items-center justify-between text-xs">
                <span className="truncate text-slate-300">{c.nombre}</span>
                <span className="font-semibold tabular-nums text-emerald-400 shrink-0 pl-2">{formatearMonto(c.monto)}</span>
              </div>
            ))}
          </div>
        </SpotlightCard>
      )}
    </section>
  );
}
