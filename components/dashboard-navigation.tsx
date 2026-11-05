"use client";

import { LayoutDashboard, Repeat2, PieChart, Target, Sparkles, ChevronRight, Wallet } from "lucide-react";
import { BrandLogo } from "./brand-logo";

export type TabId = "inicio" | "cuentas" | "suscripciones" | "estadisticas" | "presupuestos" | "asesor";

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
  { id: "cuentas", label: "Cuentas y rendimientos", shortLabel: "Dinero", description: "Tu dinero principal, ahorro, traspasos y ganancias netas.", icon: Wallet },
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
      <div className="px-2 pt-1 pb-6 border-b border-[#DCE4DB]">
        <BrandLogo variant="full" withLink />
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A897D] mt-6 mb-3 px-3">
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
              className={`group relative flex w-full items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-colors duration-200 ${
                isActive
                  ? "bg-[#E7F1E8] text-[#245C42] border border-[#D0E1D1]"
                  : "text-[#5E7165] hover:text-[#263D33] hover:bg-[#F4F7F2] border border-transparent"
              }`}
            >
              {/* Indicador activo izquierdo */}
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-[#245C42]" />}

              <div
                className={`p-1.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-white text-[#245C42]"
                    : "text-[#5E7165] group-hover:text-[#263D33] group-hover:bg-[#E8EEE7]"
                }`}
              >
                <Icon size={17} />
              </div>

              <span className="truncate">{label}</span>

              {isActive ? (
                <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-[#245C42]" />
              ) : (
                <ChevronRight
                  size={14}
                  className="ml-auto opacity-0 -translate-x-1 group-hover:opacity-40 group-hover:translate-x-0 transition-all text-[#5E7165]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Tarjeta inferior de estado / motivación */}
      <div className="mt-auto pt-4">
        <div className="rounded-2xl border border-[#DCE4DB] bg-[#F7F9F5] p-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#245C42]" />
            <span className="text-[11px] font-bold text-[#263D33]">Espacio privado</span>
          </div>
          <p className="mt-1 text-[11px] text-[#5E7165] leading-relaxed">
            Tus números y movimientos, en un mismo lugar.
          </p>
        </div>
      </div>
    </aside>
  );
}
