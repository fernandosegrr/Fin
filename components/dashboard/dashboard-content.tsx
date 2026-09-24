"use client";

import dynamic from "next/dynamic";
import { BalanceResumen } from "@/components/balance-resumen";
import { AnalyticsSummary } from "@/components/analytics-summary";
import { PresupuestosProgreso } from "@/components/presupuestos-progreso";
import { TransactionsSection } from "@/components/transactions-section";
import { RecurringExpenses } from "@/components/recurring-expenses";
import { MonthInsights } from "@/components/month-insights";
import { SavingsGoalCard } from "@/components/savings-goal-card";
import { primerDiaDelMes } from "@/lib/dates";
import type { RecurringExpensesProps } from "@/components/recurring/use-recurring-expenses";
import type { TabId } from "@/components/dashboard-navigation";
import type { useDashboardData } from "./use-dashboard-data";

const FinancialCharts = dynamic(() => import("../financial-charts").then(m => m.FinancialCharts), { loading: () => <p role="status" className="p-6 text-[#5E7165]">Cargando gráficas…</p> });
const AsesorChat = dynamic(() => import("../asesor-chat").then(m => m.AsesorChat), { loading: () => <p role="status" className="p-6 text-[#5E7165]">Abriendo asesor…</p> });

interface Props {
  tabActiva: TabId;
  asesorVisitado: boolean;
  data: ReturnType<typeof useDashboardData>;
  registrarGastoRecurrente: RecurringExpensesProps["onRegistrarTransaccion"];
}

export function DashboardContent({ tabActiva, asesorVisitado, data, registrarGastoRecurrente }: Props) {
  const { categorias, balance, presupuestos, gastosRecurrentes, clientes, meta, isPending, recargarDatos } = data;
  const mesISO = primerDiaDelMes(balance.actual.anio, balance.actual.mes);
  return (
      <div id="contenido" tabIndex={-1} aria-busy={isPending} className="mt-1">
        {/* Pestaña 1: INICIO (Saldo Total + Movimientos del Mes) */}
        {tabActiva === "inicio" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <MonthInsights actual={balance.actual} />
            <div className="overview-grid">
            <BalanceResumen
              actual={balance.actual}
              onTransferenciaRealizada={recargarDatos}
            />
            <SavingsGoalCard
              meta={meta}
              saldoActual={balance.actual.saldoTotalDisponible}
              onCambio={recargarDatos}
            />
            </div>
            <TransactionsSection
              // Se llavea con el mes YA CARGADO, no con el solicitado: entre
              // el clic y la respuesta del servidor, `anio`/`mes` ya cambiaron
              // pero `balance` todavía es del mes anterior, así que llavear
              // con el solicitado remontaba la lista sembrándola con los
              // movimientos del mes viejo (parpadeo de datos equivocados).
              key={`${balance.actual.anio}-${balance.actual.mes}`}
              initialTransacciones={balance.actual.transacciones}
              totalTransacciones={balance.actual.totalTransaccionesMes}
              categorias={categorias}
              clientes={clientes}
              onTransaccionCambiada={recargarDatos}
            />
          </div>
        )}

        {/* Pestaña 2: SUSCRIPCIONES (Gastos Recurrentes + Cobro en 1 clic) */}
        {tabActiva === "suscripciones" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <RecurringExpenses
              categorias={categorias}
              initialGastosRecurrentes={gastosRecurrentes}
              recurrentesCobrados={balance.actual.recurrentesCobrados}
              anio={balance.actual.anio}
              mes={balance.actual.mes}
              onRegistrarTransaccion={registrarGastoRecurrente}
              onListaCambiada={recargarDatos}
            />
          </div>
        )}

        {/* Pestaña 3: ESTADÍSTICAS (Métricas + Gráficas de Dona y Flujo) */}
        {tabActiva === "estadisticas" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <AnalyticsSummary
              egresosFijos={balance.actual.egresosFijos}
              egresosVariables={balance.actual.egresosVariables}
              egresosPorCategoria={balance.actual.egresosPorCategoria}
              totalEgresos={balance.actual.egresos}
              ingresosPorCliente={balance.actual.ingresosPorCliente}
              anio={balance.actual.anio}
              mes={balance.actual.mes}
            />
            <FinancialCharts
              egresosPorCategoria={balance.actual.egresosPorCategoria}
              ingresosTotales={balance.actual.ingresos}
              egresosTotales={balance.actual.egresos}
            />
          </div>
        )}

        {/* Pestaña 4: PRESUPUESTOS (Barras de Salud Financiera y Límites) */}
        {tabActiva === "presupuestos" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <PresupuestosProgreso items={presupuestos} mesISO={mesISO} onPresupuestosGuardados={recargarDatos} />
          </div>
        )}

        {/* Pestaña 5: ASESOR — se monta la primera vez que se abre y se queda
            vivo (hidden) para no perder el borrador, el "pensando…" ni recargar
            el historial cada vez que se cambia de pestaña. */}
        {asesorVisitado && (
          <div className={tabActiva === "asesor" ? "space-y-4 animate-in fade-in duration-300" : "hidden"}>
            <AsesorChat anio={balance.actual.anio} mes={balance.actual.mes} />
          </div>
        )}
      </div>

  );
}
