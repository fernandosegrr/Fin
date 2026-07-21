"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BalanceResumen } from "@/components/balance-resumen";
import { AnalyticsSummary } from "@/components/analytics-summary";
import { FinancialCharts } from "@/components/financial-charts";
import { PresupuestosProgreso } from "@/components/presupuestos-progreso";
import { TransactionsSection } from "@/components/transactions-section";
import { RecurringExpenses } from "@/components/recurring-expenses";
import { MonthSelector } from "@/components/month-selector";
import { ExportButton } from "@/components/export-button";
import { ToastNotification, type ToastMessage } from "@/components/toast-notification";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { ShinyText } from "@/components/react-bits/ShinyText";
import { obtenerBalanceMensual, obtenerPresupuestosConGasto, crearTransaccion, signOut, type BalanceMensual } from "@/app/dashboard/actions";
import { primerDiaDelMes } from "@/lib/dates";
import type { Categoria, MetodoPago, PresupuestoConGasto } from "@/lib/types";

interface Props {
  initialBalance: BalanceMensual;
  initialPresupuestos: PresupuestoConGasto[];
  categorias: Categoria[];
}

export function DashboardContainer({ initialBalance, initialPresupuestos, categorias }: Props) {
  const [balance, setBalance] = useState<BalanceMensual>(initialBalance);
  const [presupuestos, setPresupuestos] = useState<PresupuestoConGasto[]>(initialPresupuestos);
  const [anio, setAnio] = useState(initialBalance.actual.anio);
  const [mes, setMes] = useState(initialBalance.actual.mes);
  const [isPending, startTransition] = useTransition();

  // Notificaciones Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Recarga silenciosa en tiempo real (invocada por WebSockets o Server Actions)
  const recargarDatos = useCallback((mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => {
    if (mensajeToast) {
      setToast({
        id: String(Date.now()),
        texto: mensajeToast.texto,
        tipo: mensajeToast.tipo ?? "success",
      });
    }

    startTransition(async () => {
      try {
        const [nuevoBalance, nuevosPresupuestos] = await Promise.all([
          obtenerBalanceMensual(anio, mes),
          obtenerPresupuestosConGasto(anio, mes),
        ]);
        setBalance(nuevoBalance);
        setPresupuestos(nuevosPresupuestos);
      } catch (err) {
        console.error("Error recargando datos del dashboard:", err);
      }
    });
  }, [anio, mes]);

  // SUSCRIPCIÓN EN TIEMPO REAL VÍA SUPABASE WEBSOCKETS ⚡
  useEffect(() => {
    const supabase = createClient();

    const canalTransacciones = supabase
      .channel(`realtime_dashboard_${anio}_${mes}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transacciones",
        },
        () => {
          recargarDatos();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presupuestos",
        },
        () => {
          recargarDatos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalTransacciones);
    };
  }, [anio, mes, recargarDatos]);

  function cambiarMes(nuevoAnio: number, nuevoMes: number) {
    setAnio(nuevoAnio);
    setMes(nuevoMes);

    startTransition(async () => {
      try {
        const [nuevoBalance, nuevosPresupuestos] = await Promise.all([
          obtenerBalanceMensual(nuevoAnio, nuevoMes),
          obtenerPresupuestosConGasto(nuevoAnio, nuevoMes),
        ]);
        setBalance(nuevoBalance);
        setPresupuestos(nuevosPresupuestos);
      } catch (err) {
        console.error("Error cambiando de mes:", err);
      }
    });
  }

  function registrarGastoRecurrente(datos: {
    categoria_id: string;
    monto: number;
    descripcion: string;
    metodo_pago: MetodoPago;
  }) {
    startTransition(async () => {
      try {
        await crearTransaccion({
          categoria_id: datos.categoria_id,
          monto: datos.monto,
          descripcion: datos.descripcion,
          metodo_pago: datos.metodo_pago,
        });
        recargarDatos({
          texto: `¡Cobro de ${datos.descripcion} registrado con éxito! ⚡`,
          tipo: "success",
        });
      } catch (err) {
        setToast({
          id: String(Date.now()),
          texto: err instanceof Error ? err.message : "Error registrando cobro.",
          tipo: "error",
        });
      }
    });
  }

  const mesISO = primerDiaDelMes(anio, mes);

  return (
    <main className="min-h-dvh max-w-app sm:max-w-desktop mx-auto pb-28 px-3 sm:px-6 bg-[#070a12] relative">
      {/* Toast Banner Flotante con animación */}
      <ToastNotification toast={toast} onCerrar={() => setToast(null)} />

      {/* Top Navbar responsiva */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-3 sm:px-4 pb-3 bg-[#070a12]/95 backdrop-blur-xl border-b border-white/10 -mx-3 sm:-mx-6 mb-2"
        style={{
          paddingTop: "max(0.75rem, calc(0.5rem + env(safe-area-inset-top, 0px)))",
        }}
      >
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="NexFin Logo"
            className="h-9 w-9 rounded-xl object-cover shadow-lg shadow-emerald-500/25 border border-white/10 shrink-0"
          />
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1.5 leading-none">
              NexFin <ShinyText text="Pro" className="text-[10px] sm:text-xs font-black tracking-widest uppercase" />
            </h1>
            <p className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              En Vivo (WebSocket)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <ExportButton
            transacciones={balance.actual.transacciones}
            nombreMes={balance.actual.nombreMes}
          />
          <form action={signOut}>
            <GlowButton variant="ghost" type="submit" className="!p-2" title="Cerrar sesión">
              <LogOut className="h-4 w-4 text-slate-400 hover:text-rose-400" />
            </GlowButton>
          </form>
        </div>
      </header>

      {/* Selector de Mes */}
      <div className="pt-2">
        <MonthSelector anio={anio} mes={mes} onCambiarMes={cambiarMes} />
      </div>

      {isPending && (
        <div className="mt-2">
          <div className="h-1 w-full bg-emerald-500/20 overflow-hidden rounded-full">
            <div className="h-full bg-emerald-400 animate-pulse w-1/2" />
          </div>
        </div>
      )}

      {/* 1. Resumen de Balance Neto & Cuentas */}
      <BalanceResumen actual={balance.actual} anterior={balance.anterior} />

      {/* 2. Movimientos del Mes (REORDENADO ARRIBA COMO SE SOLICITÓ) */}
      <TransactionsSection
        key={`${anio}-${mes}`}
        initialTransacciones={balance.actual.transacciones}
        categorias={categorias}
        onTransaccionCambiada={recargarDatos}
      />

      {/* 3. Suscripciones & Gastos Recurrentes (NUEVO MÓDULO) */}
      <RecurringExpenses
        categorias={categorias}
        onRegistrarTransaccion={registrarGastoRecurrente}
      />

      {/* 4. Métricas e Insights Financieros */}
      <AnalyticsSummary
        transacciones={balance.actual.transacciones}
        totalEgresos={balance.actual.egresos}
      />

      {/* 5. Gráficas Interactivas */}
      <FinancialCharts
        transacciones={balance.actual.transacciones}
        ingresosTotales={balance.actual.ingresos}
        egresosTotales={balance.actual.egresos}
      />

      {/* 6. Barras de Progreso de Presupuestos */}
      <PresupuestosProgreso items={presupuestos} mesISO={mesISO} />
    </main>
  );
}
