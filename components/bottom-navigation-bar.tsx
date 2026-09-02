"use client";

import { Home, Zap, BarChart3, Target, Sparkles } from "lucide-react";

export type TabId = "inicio" | "suscripciones" | "estadisticas" | "presupuestos" | "asesor";

interface Props {
  tabActiva: TabId;
  onCambiarTab: (tab: TabId) => void;
}

export function BottomNavigationBar({ tabActiva, onCambiarTab }: Props) {
  const tabs = [
    { id: "inicio" as TabId, label: "Inicio", icon: Home },
    { id: "suscripciones" as TabId, label: "Suscripciones", icon: Zap },
    { id: "estadisticas" as TabId, label: "Estadísticas", icon: BarChart3 },
    { id: "presupuestos" as TabId, label: "Presupuestos", icon: Target },
    { id: "asesor" as TabId, label: "Asesor", icon: Sparkles },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#070a12]/95 backdrop-blur-2xl border-t border-white/10"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="max-w-app sm:max-w-desktop mx-auto flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const esActiva = tabActiva === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onCambiarTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all relative ${
                esActiva
                  ? "text-emerald-400 font-bold"
                  : "text-slate-400 hover:text-slate-200 font-medium"
              }`}
            >
              {esActiva && (
                <span className="absolute -top-2 h-1 w-8 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
              )}
              <div
                className={`p-1 rounded-xl transition-all ${
                  esActiva ? "bg-emerald-500/10 scale-110" : ""
                }`}
              >
                <Icon className={`h-5 w-5 ${esActiva ? "text-emerald-400" : "text-slate-400"}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
