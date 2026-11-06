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
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#DCE4DB] bg-white/95 backdrop-blur-xl shadow-[0_-8px_24px_rgba(27,52,35,0.06)]"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-1.5">
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
                  ? "text-[#286F50] font-bold"
                  : "text-[#5E7165] hover:text-[#263D33] font-medium"
              }`}
            >
              {/* Indicador de la sección activa */}
              {esActiva && (
                <span className="absolute -top-1.5 h-1 w-8 rounded-full bg-[#245C42]" />
              )}

              <div
                className={`p-1.5 rounded-xl transition-all ${
                  esActiva
                    ? "bg-[#E7F1E8] text-[#245C42]"
                    : "text-[#5E7165]"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>

              <span className="text-[11px] mt-0.5 truncate max-w-full">
                {tab.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
