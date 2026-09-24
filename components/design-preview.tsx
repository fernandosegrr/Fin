"use client";

import { useState } from "react";
import { DashboardNavigation, sections } from "./dashboard-navigation";
import { BottomNavigationBar, type TabId } from "./bottom-navigation-bar";
import { MonthInsights } from "./month-insights";
import { BalanceResumen } from "./balance-resumen";
import { SavingsGoalCard } from "./savings-goal-card";
import { FinancialCharts } from "./financial-charts";
import { TransactionsSection } from "./transactions-section";
import { PresupuestosProgreso } from "./presupuestos-progreso";
import { RecurringExpenses } from "./recurring-expenses";
import { BrandLogo } from "./brand-logo";
import type { BalanceMensual } from "@/app/dashboard/actions";
import type { Categoria } from "@/lib/types";

const categoria: Categoria = { id: "demo", user_id: "demo", nombre: "Alimentación", tipo: "egreso", grupo: "variable" };
const actual: BalanceMensual["actual"] = {
  anio: 2026, mes: 9, nombreMes: "septiembre de 2026", ingresos: 32000, egresos: 12450, balance: 19550, saldoInicial: 5000, saldoTotalDisponible: 24550,
  totalesEfectivo: { ingresos: 2000, egresos: 1450, neto: 550, saldo: 1550 },
  totalesTarjeta: { ingresos: 30000, egresos: 11000, neto: 19000, saldo: 23000 },
  transferencias: [], egresosFijos: 9000, egresosVariables: 3450,
  egresosPorCategoria: [{ categoria_id: "demo", nombre: "Alimentación", monto: 3450 }, { categoria_id: "hogar", nombre: "Hogar", monto: 9000 }],
  ingresosPorCliente: [], recurrentesCobrados: [], totalTransaccionesMes: 1,
  transacciones: [{ id: "demo", user_id: "demo", categoria_id: "demo", monto: 450, fecha: "2026-09-04", descripcion: "Compra semanal", metodo_pago: "tarjeta", creado_en: "2026-09-04", categoria }],
};
const presupuestos = [{ categoria, presupuesto: { id: "demo", user_id: "demo", categoria_id: "demo", monto_limite: 5000, mes: "2026-09-01" }, gastado: 3450 }];

/** Visual fixture: only reachable in development, no account or financial writes. */
export function DesignPreview() {
  const [tab, setTab] = useState<TabId>("inicio");
  const section = sections.find(s => s.id === tab)!;
  return <main className="dashboard-shell">
    <DashboardNavigation active={tab} onChange={setTab} />
    <header className="dashboard-header flex items-center justify-between gap-3 border-b border-[#DCE4DB] py-4"><BrandLogo variant="compact" className="lg:hidden" /><span className="hidden text-sm font-bold text-[#263D33] lg:block">Mi espacio financiero</span><a className="text-xs font-semibold text-[#286F50] underline" href="/login">Ir al inicio de sesión</a></header>
    <div className="page-heading"><div><p className="eyebrow">TU DINERO, CON CLARIDAD</p><h2>{section.label}</h2><p className="text-sm text-[#5E7165] mt-2">{section.description}</p></div><span className="rounded-xl border border-[#DCE4DB] px-5 py-3 text-sm">Septiembre 2026</span></div>
    <p role="note" className="mb-5 rounded-xl border border-[#DFD4BE] bg-[#FAF5E9] p-3 text-xs text-[#795725]">Vista de diseño con datos ficticios. Los controles que guardan datos están desactivados.</p>
    {tab === "inicio" && <><MonthInsights actual={actual} /><div inert className="overview-grid mb-5"><BalanceResumen actual={actual} /><SavingsGoalCard meta={{ id: "demo", nombre: "Mi próximo viaje", monto_objetivo: 40000, fecha_limite: "2026-12-01" }} saldoActual={24550} onCambio={() => {}} /></div><div inert><TransactionsSection initialTransacciones={actual.transacciones} totalTransacciones={1} categorias={[categoria]} /></div></>}
    {tab === "estadisticas" && <FinancialCharts egresosPorCategoria={actual.egresosPorCategoria} ingresosTotales={actual.ingresos} egresosTotales={actual.egresos} />}
    {tab === "presupuestos" && <div inert><PresupuestosProgreso items={presupuestos} mesISO="2026-09-01" onPresupuestosGuardados={() => {}} /></div>}
    {tab === "suscripciones" && <div inert><RecurringExpenses categorias={[categoria]} initialGastosRecurrentes={[]} recurrentesCobrados={[]} anio={2026} mes={9} onRegistrarTransaccion={async () => {}} onListaCambiada={() => {}} /></div>}
    {tab === "asesor" && <div className="metric-card"><h3 className="text-xl">Tu espacio para preguntar</h3><p className="text-[#5E7165] mt-3">El asesor está disponible al iniciar sesión. Esta vista de ejemplo no envía consultas.</p></div>}
    <BottomNavigationBar tabActiva={tab} onCambiarTab={setTab} />
  </main>;
}
