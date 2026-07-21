"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { PieChart as PieIcon, BarChart3 } from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { formatearMonto } from "@/lib/format";
import type { TransaccionConCategoria } from "@/lib/types";

interface Props {
  transacciones: TransaccionConCategoria[];
  ingresosTotales: number;
  egresosTotales: number;
}

const PALETTE = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // emerald
];

export function FinancialCharts({ transacciones, ingresosTotales, egresosTotales }: Props) {
  const [activeTab, setActiveTab] = useState<"pie" | "bar">("pie");

  // Agrupar egresos por categoría
  const egresosPorCategoriaMap = new Map<string, number>();
  for (const t of transacciones) {
    if (t.categoria?.tipo === "egreso") {
      const nombre = t.categoria.nombre;
      egresosPorCategoriaMap.set(nombre, (egresosPorCategoriaMap.get(nombre) ?? 0) + t.monto);
    }
  }

  const pieData = Array.from(egresosPorCategoriaMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Datos para comparativa Flujo de Efectivo
  const barData = [
    { name: "Ingresos", monto: ingresosTotales, fill: "#10b981" },
    { name: "Egresos", monto: egresosTotales, fill: "#f43f5e" },
  ];

  return (
    <section className="px-4 mt-6">
      <SpotlightCard className="bg-slate-900/60 border-white/10 p-5 rounded-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              {activeTab === "pie" ? <PieIcon className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                {activeTab === "pie" ? "Distribución de Egresos" : "Comparativa Flujo de Efectivo"}
              </h3>
              <p className="text-xs text-slate-400">Análisis visual interactivo</p>
            </div>
          </div>

          {/* Switch de pestaña */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab("pie")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "pie"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Categorías
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bar")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "bar"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Flujo
            </button>
          </div>
        </div>

        {activeTab === "pie" ? (
          pieData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-slate-400">
              No hay egresos registrados en este periodo.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(val: any) => [
                        formatearMonto(Number(val) || 0),
                        "Monto",
                      ]}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Leyenda estructurada */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {pieData.map((entry, index) => {
                  const pct = egresosTotales > 0 ? Math.round((entry.value / egresosTotales) * 100) : 0;
                  return (
                    <div
                      key={entry.name}
                      className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/40 border border-white/5"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
                        />
                        <span className="truncate text-slate-300 font-medium">{entry.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-400">{pct}%</span>
                        <span className="font-semibold text-slate-200 tabular-nums">
                          {formatearMonto(entry.value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(val: any) => [
                    formatearMonto(Number(val) || 0),
                    "Monto",
                  ]}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="monto" radius={[12, 12, 0, 0]} barSize={40}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-bar-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SpotlightCard>
    </section>
  );
}
