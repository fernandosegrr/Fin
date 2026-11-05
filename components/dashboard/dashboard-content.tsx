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
import { AccountsSection } from "../finance/accounts-section";
import type { FiltrosLibro } from "@/lib/dashboard/ledger";
import { rangoDelMes } from "@/lib/dates";
import { formatearMonto } from "@/lib/format";
import { calcularMargenRegistrado } from "@/lib/finance/planning";
import { hoyISOEnMexico } from "@/lib/dates";

const FinancialCharts = dynamic(() => import("../financial-charts").then(m => m.FinancialCharts), { loading: () => <p role="status" className="p-6 text-[#5E7165]">Cargando gráficas…</p> });
const AsesorChat = dynamic(() => import("../asesor-chat").then(m => m.AsesorChat), { loading: () => <p role="status" className="p-6 text-[#5E7165]">Abriendo asesor…</p> });

interface Props {
  tabActiva: TabId;
  asesorVisitado: boolean;
  data: ReturnType<typeof useDashboardData>;
  registrarGastoRecurrente: RecurringExpensesProps["onRegistrarTransaccion"];
  onCambiarTab?: (tab: TabId) => void;
  onVerDetalle?: (filtros: FiltrosLibro) => void;
}

export function DashboardContent({ tabActiva, asesorVisitado, data, registrarGastoRecurrente, onCambiarTab, onVerDetalle }: Props) {
  const { categorias, balance, presupuestos, gastosRecurrentes, clientes, meta, isPending, recargarDatos } = data;
  const mesISO = primerDiaDelMes(balance.actual.anio, balance.actual.mes);
  const rango = rangoDelMes(balance.actual.anio, balance.actual.mes);
  const ultimoDia = new Date(`${rango.finExclusivo}T12:00:00Z`); ultimoDia.setUTCDate(ultimoDia.getUTCDate() - 1);
  const periodo = { desde: rango.inicio, hasta: ultimoDia.toISOString().slice(0, 10) };
  const margen = calcularMargenRegistrado(balance.actual.saldoTotalDisponible, gastosRecurrentes, balance.actual.recurrentesCobrados, balance.actual.anio, balance.actual.mes, hoyISOEnMexico());
  return (
      <div id="contenido" tabIndex={-1} aria-busy={isPending} className="mt-1">
        {/* Pestaña 1: INICIO (Saldo Total + Movimientos del Mes) */}
        {tabActiva === "inicio" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <MonthInsights actual={balance.actual} />
            {margen && balance.actual.finanzas && <section className="finance-card p-4 flex flex-wrap items-center justify-between gap-3" aria-label="Plan para el resto del mes"><div><p className="text-xs font-semibold text-[#5E7165]">Ritmo orientativo para los próximos {Math.min(7, margen.diasRestantes)} días</p><p className="text-2xl font-bold text-[#286F50] mt-1">{formatearMonto(margen.ritmo7Dias)}</p><p className="text-[11px] text-[#5E7165] mt-1">Apartando {formatearMonto(margen.comprometido)} para pagos registrados pendientes y distribuyendo el resto hasta fin de mes.</p></div><button className="finance-action" onClick={() => onCambiarTab?.("presupuestos")}>Revisar mis límites</button></section>}
            <div className="overview-grid">
            <BalanceResumen
              actual={balance.actual}
              onTransferenciaRealizada={recargarDatos}
              onVerCuentas={() => onCambiarTab?.("cuentas")}
            />
            <SavingsGoalCard
              meta={meta}
              saldoActual={balance.actual.finanzas?.ahorro ?? balance.actual.saldoTotalDisponible}
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
              cuentas={balance.actual.finanzas?.cuentas}
              onTransaccionCambiada={recargarDatos}
            />
          </div>
        )}

        {tabActiva === "cuentas" && balance.actual.finanzas && <AccountsSection finanzas={balance.actual.finanzas} transferencias={balance.actual.transferencias} onCambio={recargarDatos} />}

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
            {balance.actual.finanzas && <section className="finance-card p-5"><p className="eyebrow">DESDE QUE EMPEZASTE A REGISTRAR</p><h3 className="text-3xl font-bold mt-2">{formatearMonto(balance.actual.finanzas.historicoIngresos.total)}</h3><p className="text-xs text-[#5E7165] mt-2">Ingresos históricos hasta el cierre del periodo: trabajo {formatearMonto(balance.actual.finanzas.historicoIngresos.trabajo)}, apoyos {formatearMonto(balance.actual.finanzas.historicoIngresos.apoyos)} y rendimientos {formatearMonto(balance.actual.finanzas.historicoIngresos.rendimientos)}. Préstamos, reembolsos y ajustes se muestran aparte.</p><button className="finance-action mt-3" onClick={() => onVerDetalle?.({ tipo: "ingreso", hasta: periodo.hasta })}>Ver movimientos de ingresos</button></section>}
            <AnalyticsSummary
              egresosFijos={balance.actual.egresosFijos}
              egresosVariables={balance.actual.egresosVariables}
              egresosPorCategoria={balance.actual.egresosPorCategoria}
              totalEgresos={balance.actual.finanzas?.consumo ?? balance.actual.egresos}
              ingresosPorCliente={balance.actual.ingresosPorCliente}
              anio={balance.actual.anio}
              mes={balance.actual.mes}
              onVerCategoria={id => onVerDetalle?.({ ...periodo, categoriaId: id })}
              onVerCliente={nombre => onVerDetalle?.({ ...periodo, busqueda: nombre, tipo: "ingreso" })}
            />
            <FinancialCharts
              egresosPorCategoria={balance.actual.egresosPorCategoria}
              ingresosTotales={balance.actual.ingresos}
              egresosTotales={balance.actual.finanzas?.consumo ?? balance.actual.egresos}
              onVerCategoria={id => onVerDetalle?.({ ...periodo, categoriaId: id })}
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
          <div className={tabActiva === "asesor" ? "advisor-host" : "hidden"}>
            <AsesorChat activo={tabActiva === "asesor"} anio={balance.actual.anio} mes={balance.actual.mes} onDatosCambiados={recargarDatos} />
          </div>
        )}
      </div>

  );
}
