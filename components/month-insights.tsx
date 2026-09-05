import { ArrowDownLeft, ArrowUpRight, Activity } from "lucide-react";
import type { BalanceMensual } from "@/app/dashboard/actions";
import { formatearMonto } from "@/lib/format";

export function MonthInsights({ actual }: { actual: BalanceMensual["actual"] }) {
  const neto = actual.ingresos - actual.egresos;
  const items = [
    { label: "Ingresos del mes", amount: actual.ingresos, detail: "Todo lo que recibiste", icon: ArrowDownLeft, color: "text-emerald-400" },
    { label: "Gastos del mes", amount: actual.egresos, detail: "Todo lo que destinaste", icon: ArrowUpRight, color: "text-rose-400" },
    { label: "Balance del mes", amount: neto, detail: neto < 0 ? "Los gastos superan tus ingresos" : "Ingresos menos gastos", icon: Activity, color: neto < 0 ? "text-rose-400" : "text-sky-300" },
  ];
  return <section aria-label="Indicadores del mes" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">{items.map(({ label, amount, detail, icon: Icon, color }) => <article key={label} className="metric-card"><div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-400">{label}</p><Icon size={18} className={color} /></div><p className="text-2xl lg:text-3xl font-semibold tracking-tight tabular-nums mt-4">{formatearMonto(amount)}</p><p className="text-xs text-slate-400 mt-2">{detail}</p></article>)}</section>;
}
