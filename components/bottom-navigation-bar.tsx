"use client";

import { sections, type TabId } from "./dashboard-navigation";

export type { TabId };

interface Props {
  tabActiva: TabId;
  onCambiarTab: (tab: TabId) => void;
}

export function BottomNavigationBar({ tabActiva, onCambiarTab }: Props) {
  return (
    <nav
      aria-label="Navegación móvil"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070a12]/95 backdrop-blur-2xl border-t border-white/[0.08] shadow-[0_-8px_24px_rgba(0,0,0,0.6)]"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="max-w-app mx-auto flex items-center justify-around px-2 py-1.5">
        {sections.map((tab) => {
          const Icon = tab.icon;
          const esActiva = tabActiva === tab.id;

          return (
            <button
              aria-current={esActiva ? "page" : undefined}
              key={tab.id}
              type="button"
              onClick={() => onCambiarTab(tab.id)}
              className={`relative min-w-0 min-h-12 flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all duration-200 ${
                esActiva
                  ? "text-emerald-300 font-bold"
                  : "text-slate-400 hover:text-slate-200 font-medium"
              }`}
            >
              {/* Indicador superior con brillo neón */}
              {esActiva && (
                <span className="absolute -top-1.5 h-1 w-8 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_12px_rgba(16,244,177,0.7)]" />
              )}

              <div
                className={`p-1.5 rounded-xl transition-all ${
                  esActiva
                    ? "bg-emerald-500/15 text-emerald-400 scale-105 shadow-sm shadow-emerald-500/10"
                    : "text-slate-400"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>

              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                {tab.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
