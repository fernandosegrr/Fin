"use client";

import { LayoutDashboard, Repeat2, PieChart, Target, Sparkles, ChevronRight } from "lucide-react";
import { BrandLogo } from "./brand-logo";

export type TabId = "inicio" | "suscripciones" | "estadisticas" | "presupuestos" | "asesor";

export interface NavigationSection {
  id: TabId;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof LayoutDashboard;
}

export const sections: readonly NavigationSection[] = [
  {
    id: "inicio",
    label: "Resumen General",
    shortLabel: "Resumen",
    description: "Tu balance global, metas y movimientos recientes.",
    icon: LayoutDashboard,
  },
  {
    id: "suscripciones",
    label: "Pagos Recurrentes",
    shortLabel: "Pagos",
    description: "Controla tus suscripciones y fechas de cobro.",
    icon: Repeat2,
  },
  {
    id: "estadisticas",
    label: "Estadísticas",
    shortLabel: "Gráficos",
    description: "Análisis visual de tus gastos e ingresos.",
    icon: PieChart,
  },
  {
    id: "presupuestos",
    label: "Presupuestos",
    shortLabel: "Límites",
    description: "Límites inteligentes por categoría de gasto.",
    icon: Target,
  },
  {
    id: "asesor",
    label: "Asesor Financiero IA",
    shortLabel: "Asesor",
    description: "Consultas inteligentes basadas en tus finanzas reales.",
    icon: Sparkles,
  },
] as const;

export function DashboardNavigation({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <aside className="desktop-sidebar select-none">
      {/* Brand Logo oficial */}
      <div className="px-2 pt-1 pb-6 border-b border-white/[0.07]">
        <BrandLogo variant="full" withLink />
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mt-6 mb-3 px-3">
        Navegación
      </p>

      {/* Lista de navegación principal */}
      <nav aria-label="Navegación principal" className="space-y-1.5 flex-1">
        {sections.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChange(id)}
              className={`group relative flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent text-emerald-300 border border-emerald-500/20 shadow-sm shadow-emerald-500/5"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              {/* Indicador activo izquierdo */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-emerald-400 shadow-sm shadow-emerald-400" />
              )}

              <div
                className={`p-1.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-slate-400 group-hover:text-slate-200 group-hover:bg-white/5"
                }`}
              >
                <Icon size={17} />
              </div>

              <span className="truncate">{label}</span>

              {isActive ? (
                <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              ) : (
                <ChevronRight
                  size={14}
                  className="ml-auto opacity-0 -translate-x-1 group-hover:opacity-40 group-hover:translate-x-0 transition-all text-slate-400"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Tarjeta inferior de estado / motivación */}
      <div className="mt-auto pt-4">
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-3.5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-200">NexFin Pro</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
            Claridad en cada peso para construir tus metas con certeza.
          </p>
        </div>
      </div>
    </aside>
  );
}
