"use client";

import { useState } from "react";
import { BrandLogo } from "./brand-logo";
import { DashboardNavigation, sections } from "./dashboard-navigation";
import { LogOut, Search } from "lucide-react";
import { MonthSelector } from "@/components/month-selector";
import { ExportButton } from "@/components/export-button";
import { ToastNotification } from "@/components/toast-notification";
import { BottomNavigationBar, type TabId } from "@/components/bottom-navigation-bar";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { crearTransaccion, signOut } from "@/app/dashboard/actions";
import type { MetodoPago } from "@/lib/types";
import { useDashboardData, type DashboardInitialData } from "./dashboard/use-dashboard-data";
import { useDashboardRealtime } from "./dashboard/use-dashboard-realtime";
import { HistorialModal } from "@/components/historial-modal";
import { DashboardContent } from "./dashboard/dashboard-content";
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
  const [asesorVisitado, setAsesorVisitado] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
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

      {/* Top Navbar responsiva */}
      <header
        className="dashboard-header sticky top-0 z-30 flex items-center justify-between pb-4 bg-[#F4F6F0]/95 backdrop-blur-xl border-b border-[#DCE4DB]"
        style={{
          paddingTop: "max(0.75rem, calc(0.5rem + env(safe-area-inset-top, 0px)))",
        }}
      >
        <div className="flex items-center gap-3">
          <BrandLogo variant="compact" withLink className="lg:hidden" />
          <div>
            <h1 className="hidden lg:flex items-center gap-2 text-sm font-bold text-[#263D33] leading-none">
              <span>Mi espacio financiero</span>
            </h1>
            <p
              className={`text-[10px] mt-0.5 lg:mt-1 flex items-center gap-1.5 font-semibold ${
                estadoConexion === "vivo" ? "text-[#286F50]" : "text-[#7A897D]"
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
            onClick={() => verHistorial()}
          >
            <Search className="h-4 w-4 text-[#5E7165] hover:text-[#286F50]" />
          </GlowButton>
          <ExportButton
            anio={balance.actual.anio}
            mes={balance.actual.mes}
            nombreMes={balance.actual.nombreMes}
            cuentas={balance.actual.finanzas?.cuentas}
          />
          {!!balance.actual.finanzas?.pendientes && <button type="button" onClick={() => verHistorial({ soloRevision: true })} className="finance-action !px-2 !py-1.5" aria-label={`Revisar ${balance.actual.finanzas.pendientes} movimientos`}><span className="hidden sm:inline">Por revisar</span> {balance.actual.finanzas.pendientes}</button>}
          <form action={signOut}>
            <GlowButton variant="ghost" type="submit" className="!p-2" title="Cerrar sesión" aria-label="Cerrar sesión">
              <LogOut className="h-4 w-4 text-[#5E7165] hover:text-[#AA524A]" />
            </GlowButton>
          </form>
        </div>
      </header>

      {/* Selector de Mes */}
      <div className="page-heading">
        <div><p className="eyebrow">TU DINERO, CON CLARIDAD</p><h2>{section.label}</h2><p className="text-sm text-[#5E7165] mt-2">{section.description}</p></div>
        <div className="w-full sm:w-auto sm:min-w-72"><MonthSelector anio={anio} mes={mes} onCambiarMes={cambiarMes} /></div>
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

      <BottomNavigationBar
        tabActiva={tabActiva}
        onCambiarTab={cambiarTab}
      />
    </main>
  );
}
