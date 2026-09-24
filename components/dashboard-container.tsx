"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BrandLogo } from "./brand-logo";
import { DashboardNavigation, sections } from "./dashboard-navigation";
import { MonthInsights } from "./month-insights";
import { LogOut, Search } from "lucide-react";
import { BalanceResumen } from "@/components/balance-resumen";
import { AnalyticsSummary } from "@/components/analytics-summary";
import { PresupuestosProgreso } from "@/components/presupuestos-progreso";
import { TransactionsSection } from "@/components/transactions-section";
import { RecurringExpenses } from "@/components/recurring-expenses";
import { MonthSelector } from "@/components/month-selector";
import { ExportButton } from "@/components/export-button";
import { ToastNotification } from "@/components/toast-notification";
import { BottomNavigationBar, type TabId } from "@/components/bottom-navigation-bar";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { crearTransaccion, signOut } from "@/app/dashboard/actions";
import { primerDiaDelMes } from "@/lib/dates";
import type { MetodoPago } from "@/lib/types";
import { useDashboardData, type DashboardInitialData } from "./dashboard/use-dashboard-data";
import { useDashboardRealtime } from "./dashboard/use-dashboard-realtime";
import { SavingsGoalCard } from "@/components/savings-goal-card";
import { HistorialModal } from "@/components/historial-modal";

const FinancialCharts = dynamic(() => import("./financial-charts").then(m => m.FinancialCharts), { loading: () => <p role="status" className="p-6 text-slate-400">Cargando gráficas…</p> });
const AsesorChat = dynamic(() => import("./asesor-chat").then(m => m.AsesorChat), { loading: () => <p role="status" className="p-6 text-slate-400">Abriendo asesor…</p> });

export function DashboardContainer({
  initialBalance,
  initialPresupuestos,
  initialGastosRecurrentes,
  categorias: initialCategorias,
  initialClientes,
  initialMeta,
}: DashboardInitialData) {
  const [tabActiva, setTabActiva] = useState<TabId>("inicio");
  const [asesorVisitado, setAsesorVisitado] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const {
    categorias, balance, presupuestos, gastosRecurrentes, clientes, meta,
    anio, mes, isPending, toast, cerrarToast, mostrarToast,
    recargarDatos, cambiarMes,
  } = useDashboardData({
    initialBalance,
    initialPresupuestos,
    initialGastosRecurrentes,
    categorias: initialCategorias,
    initialClientes,
    initialMeta,
  });
  const estadoConexion = useDashboardRealtime(recargarDatos);

  async function registrarGastoRecurrente(datos: {
    categoria_id: string;
    monto: number;
    descripcion: string;
    metodo_pago: MetodoPago;
    gasto_recurrente_id: string;
    fecha: string;
  }) {
    try {
      await crearTransaccion({
        categoria_id: datos.categoria_id,
        monto: datos.monto,
        descripcion: datos.descripcion,
        metodo_pago: datos.metodo_pago,
        gasto_recurrente_id: datos.gasto_recurrente_id,
        fecha: datos.fecha,
      });
      recargarDatos({
        texto: `¡Cobro de ${datos.descripcion} registrado con éxito! ⚡`,
        tipo: "success",
      });
    } catch (err) {
      mostrarToast({
        texto: err instanceof Error ? err.message : "Error registrando cobro.",
        tipo: "error",
      });
      throw err;
    }
  }

  // El mes del presupuesto debe ser el que YA está cargado en pantalla, no el
  // que se acaba de pedir: entre el clic de "mes siguiente" y la respuesta,
  // `anio`/`mes` ya cambiaron pero `presupuestos` sigue siendo del mes viejo.
  const mesISO = primerDiaDelMes(balance.actual.anio, balance.actual.mes);

  const section = sections.find((item) => item.id === tabActiva)!;
  function cambiarTab(tab: TabId) {
    if (tab === "asesor") setAsesorVisitado(true);
    setTabActiva(tab);
  }

  return (
    <main className="dashboard-shell">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <DashboardNavigation active={tabActiva} onChange={cambiarTab} />
      {/* Toast Banner Flotante con animación */}
      <ToastNotification toast={toast} onCerrar={cerrarToast} />

      {/* Top Navbar responsiva */}
      <header
        className="dashboard-header sticky top-0 z-30 flex items-center justify-between pb-4 bg-[#070a12]/95 backdrop-blur-xl border-b border-white/10"
        style={{
          paddingTop: "max(0.75rem, calc(0.5rem + env(safe-area-inset-top, 0px)))",
        }}
      >
        <div className="flex items-center gap-3">
          <BrandLogo variant="compact" withLink className="lg:hidden" />
          <div>
            <h1 className="hidden lg:flex items-center gap-2 text-sm font-bold text-slate-200 leading-none">
              <span>Mi espacio financiero</span>
            </h1>
            <p
              className={`text-[10px] mt-0.5 lg:mt-1 flex items-center gap-1.5 font-semibold ${
                estadoConexion === "vivo" ? "text-emerald-400" : "text-slate-500"
              }`}
            >
              <span className="relative flex h-2 w-2">
                {estadoConexion === "vivo" && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    estadoConexion === "vivo" ? "bg-emerald-500" : "bg-slate-600"
                  }`}
                ></span>
              </span>
              {estadoConexion === "vivo"
                ? "Sincronizado"
                : estadoConexion === "conectando"
                  ? "Conectando…"
                  : "Reconectando…"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Los tres valores salen del mismo balance cargado: así el archivo
              exportado nunca lleva el nombre de un mes y el contenido de otro
              durante los milisegundos en que se está cambiando de mes. */}
          <GlowButton
            variant="ghost"
            type="button"
            className="!p-2"
            title="Buscar en todo el historial"
            aria-label="Buscar en todo el historial"
            onClick={() => setHistorialAbierto(true)}
          >
            <Search className="h-4 w-4 text-slate-400 hover:text-emerald-400" />
          </GlowButton>
          <ExportButton
            anio={balance.actual.anio}
            mes={balance.actual.mes}
            nombreMes={balance.actual.nombreMes}
          />
          <form action={signOut}>
            <GlowButton variant="ghost" type="submit" className="!p-2" title="Cerrar sesión" aria-label="Cerrar sesión">
              <LogOut className="h-4 w-4 text-slate-400 hover:text-rose-400" />
            </GlowButton>
          </form>
        </div>
      </header>

      {/* Selector de Mes */}
      <div className="page-heading">
        <div><p className="eyebrow">TU DINERO, CON CLARIDAD</p><h2>{section.label}</h2><p className="text-sm text-slate-400 mt-2">{section.description}</p></div>
        <div className="w-full sm:w-auto sm:min-w-72"><MonthSelector anio={anio} mes={mes} onCambiarMes={cambiarMes} /></div>
      </div>

      {isPending && (
        <div role="status" aria-label="Actualizando datos" className="mt-2">
          <div className="h-1 w-full bg-emerald-500/20 overflow-hidden rounded-full">
            <div className="h-full bg-emerald-400 animate-pulse w-1/2" />
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑAS */}
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

      {/* Navegación por Pestañas Inferior (Bottom Nav Bar) */}
      <HistorialModal abierto={historialAbierto} onCerrar={() => setHistorialAbierto(false)} />

      <BottomNavigationBar
        tabActiva={tabActiva}
        onCambiarTab={cambiarTab}
      />
    </main>
  );
}
