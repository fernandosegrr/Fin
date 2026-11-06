"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "./brand-logo";
import { DashboardNavigation, sections } from "./dashboard-navigation";
import { MonthSelector } from "@/components/month-selector";
import { ToastNotification } from "@/components/toast-notification";
import { BottomNavigationBar, type TabId } from "@/components/bottom-navigation-bar";
import { crearTransaccion } from "@/app/dashboard/actions";
import type { MetodoPago } from "@/lib/types";
import { useDashboardData, type DashboardInitialData } from "./dashboard/use-dashboard-data";
import { useDashboardRealtime } from "./dashboard/use-dashboard-realtime";
import { HistorialModal } from "@/components/historial-modal";
import { DashboardContent } from "./dashboard/dashboard-content";
import { HeaderTools } from "./dashboard/header-tools";
import { AccountTransactionForm } from "./finance/transaction-form";
import type { FiltrosLibro } from "@/lib/dashboard/ledger";

export function DashboardContainer({
  initialBalance,
  initialPresupuestos,
  initialGastosRecurrentes,
  categorias: initialCategorias,
  initialClientes,
  initialMeta,
}: DashboardInitialData) {
  const [tabActiva, setTabActiva] = useState<TabId>("inicio");
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [tabActiva]);
  const [asesorVisitado, setAsesorVisitado] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [capturaAbierta, setCapturaAbierta] = useState(false);
  const [filtrosHistorial, setFiltrosHistorial] = useState<FiltrosLibro>({});
  const data = useDashboardData({
    initialBalance,
    initialPresupuestos,
    initialGastosRecurrentes,
    categorias: initialCategorias,
    initialClientes,
    initialMeta,
  });
  const { balance, anio, mes, isPending, toast, cerrarToast, mostrarToast, recargarDatos, cambiarMes } = data;
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

  const section = sections.find((item) => item.id === tabActiva)!;
  function verHistorial(filtros: FiltrosLibro = {}) { setFiltrosHistorial(filtros); setHistorialAbierto(true); }
  function cambiarTab(tab: TabId) {
    if (tab === "asesor") setAsesorVisitado(true);
    setTabActiva(tab);
  }

  return (
    <main className={`dashboard-shell${tabActiva === "asesor" ? " dashboard-shell--advisor" : ""}`}>
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <DashboardNavigation active={tabActiva} onChange={cambiarTab} />
      {/* Toast Banner Flotante con animación */}
      <ToastNotification toast={toast} onCerrar={cerrarToast} />

      <header className="dashboard-header">
        <div className="header-identity">
          <BrandLogo variant="compact" withLink className="lg:hidden" />
          <span className="hidden lg:block text-sm font-semibold">Mi espacio financiero</span>
          <p className="connection-status" role="status">
            <span className={estadoConexion === "vivo" ? "connection-dot is-live" : "connection-dot"} />
            {estadoConexion === "vivo" ? "Sincronizado" : estadoConexion === "conectando" ? "Conectando…" : "Reconectando…"}
          </p>
        </div>
        <HeaderTools anio={balance.actual.anio} mes={balance.actual.mes} nombreMes={balance.actual.nombreMes} cuentas={balance.actual.finanzas?.cuentas} pendientes={balance.actual.finanzas?.pendientes ?? 0} onBuscar={() => verHistorial()} onRevisar={() => verHistorial({ soloRevision: true })} onNuevo={tabActiva !== "asesor" && balance.actual.finanzas ? () => setCapturaAbierta(true) : undefined} />
      </header>

      <div className="page-heading">
        <div><h1>{section.label}</h1><p>{section.description}</p></div>
        <div className="month-control"><MonthSelector anio={anio} mes={mes} onCambiarMes={cambiarMes} /></div>
      </div>

      {isPending && (
        <div role="status" aria-label="Actualizando datos" className="mt-2">
          <div className="h-1 w-full bg-emerald-500/20 overflow-hidden rounded-full">
            <div className="h-full bg-emerald-400 animate-pulse w-1/2" />
          </div>
        </div>
      )}

      <DashboardContent
        tabActiva={tabActiva}
        asesorVisitado={asesorVisitado}
        data={data}
        registrarGastoRecurrente={registrarGastoRecurrente}
        onCambiarTab={cambiarTab}
        onVerDetalle={verHistorial}
      />

      {/* Navegación por Pestañas Inferior (Bottom Nav Bar) */}
      <HistorialModal abierto={historialAbierto} onCerrar={() => setHistorialAbierto(false)} inicial={filtrosHistorial} cuentas={balance.actual.finanzas?.cuentas} categorias={data.categorias} clientes={data.clientes} onCambio={recargarDatos} />
      {capturaAbierta && balance.actual.finanzas && <AccountTransactionForm categorias={data.categorias} clientes={data.clientes} cuentas={balance.actual.finanzas.cuentas} onCerrar={() => setCapturaAbierta(false)} onGuardado={recargarDatos} />}

      <BottomNavigationBar
        tabActiva={tabActiva}
        onCambiarTab={cambiarTab}
      />
    </main>
  );
}
