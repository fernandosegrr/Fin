"use client";

import { LayoutDashboard, Repeat2, ChartNoAxesCombined, Target, Sparkles, ArrowUpRight } from "lucide-react";
import type { TabId } from "./bottom-navigation-bar";

export const sections = [
  { id: "inicio", label: "Resumen", description: "Tu dinero, en perspectiva.", icon: LayoutDashboard },
  { id: "suscripciones", label: "Pagos recurrentes", description: "Anticipa tus próximos compromisos.", icon: Repeat2 },
  { id: "estadisticas", label: "Estadísticas", description: "Entiende en qué se mueve tu dinero.", icon: ChartNoAxesCombined },
  { id: "presupuestos", label: "Presupuestos", description: "Dale un propósito a cada peso.", icon: Target },
  { id: "asesor", label: "Asesor", description: "Un espacio para resolver tus dudas.", icon: Sparkles },
] as const;

export function DashboardNavigation({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return <aside className="desktop-sidebar">
    <a href="/dashboard" className="sidebar-brand"><span className="brand-mark">n.</span> nexfin<span className="brand-tag">PRO</span></a>
    <p className="sidebar-caption">TU ESPACIO FINANCIERO</p>
    <nav aria-label="Navegación principal" className="space-y-2">
      {sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={active === id ? "page" : undefined} onClick={() => onChange(id)} className={`sidebar-link ${active === id ? "is-active" : ""}`}><Icon size={19} /><span>{label}</span>{active === id && <ArrowUpRight size={16} className="ml-auto" />}</button>)}
    </nav>
    <div className="sidebar-note"><span className="text-emerald-400 text-sm">Un paso a la vez.</span><p className="mt-2 text-sm text-slate-400 leading-relaxed">Pequeños hábitos. Más claridad para tu futuro.</p></div>
    <p className="text-xs text-slate-500 mt-6">NexFin · Finanzas personales</p>
  </aside>;
}
