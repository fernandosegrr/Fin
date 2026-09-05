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
import type { EgresoPorCategoria } from "@/lib/types";

interface Props {
  /** Agregado en el servidor sobre TODO el mes y ya ordenado de mayor a menor. */
  egresosPorCategoria: EgresoPorCategoria[];
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

export function FinancialCharts({ egresosPorCategoria, ingresosTotales, egresosTotales }: Props) {
  const [activeTab, setActiveTab] = useState<"pie" | "bar">("pie");

  const pieData = egresosPorCategoria.map((e) => ({ id: e.categoria_id, name: e.nombre, value: e.monto }));

  // Datos para comparativa Flujo de Efectivo
  const barData = [
    { name: "Ingresos", monto: ingresosTotales, fill: "#10b981" },
    { name: "Egresos", monto: egresosTotales, fill: "#f43f5e" },
  ];

  return (
    <section className="mt-6">
      <SpotlightCard className="bg-slate-900/60 border-white/10 p-5 rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              {activeTab === "pie" ? <PieIcon className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                {activeTab === "pie" ? "¿En qué se fue tu dinero?" : "Lo que entra y lo que sale"}
              </h3>
              <p className="text-sm text-slate-400">Una mirada al mes seleccionado</p>
            </div>
          </div>

          {/* Switch de pestaña */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab("pie")}
              aria-pressed={activeTab === "pie"}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "pie"
                  ? "bg-emerald-300 text-emerald-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Categorías
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bar")}
              aria-pressed={activeTab === "bar"}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "bar"
                  ? "bg-emerald-300 text-emerald-950"
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
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={96}
                      paddingAngle={3}
                      stroke="none"
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
                      key={entry.id}
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
