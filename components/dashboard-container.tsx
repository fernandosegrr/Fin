"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AsesorChat } from "@/components/asesor-chat";
import { BalanceResumen } from "@/components/balance-resumen";
import { AnalyticsSummary } from "@/components/analytics-summary";
import { FinancialCharts } from "@/components/financial-charts";
import { PresupuestosProgreso } from "@/components/presupuestos-progreso";
import { TransactionsSection } from "@/components/transactions-section";
import { RecurringExpenses } from "@/components/recurring-expenses";
import { MonthSelector } from "@/components/month-selector";
import { ExportButton } from "@/components/export-button";
import { ToastNotification, type ToastMessage } from "@/components/toast-notification";
import { BottomNavigationBar, type TabId } from "@/components/bottom-navigation-bar";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { ShinyText } from "@/components/react-bits/ShinyText";
import { obtenerBalanceMensual, obtenerPresupuestosConGasto, obtenerGastosRecurrentes, crearTransaccion, signOut, type BalanceMensual } from "@/app/dashboard/actions";
import { primerDiaDelMes } from "@/lib/dates";
import type { Categoria, GastoRecurrente, MetodoPago, PresupuestoConGasto } from "@/lib/types";

interface Props {
  initialBalance: BalanceMensual;
  initialPresupuestos: PresupuestoConGasto[];
  initialGastosRecurrentes: GastoRecurrente[];
  categorias: Categoria[];
}

export function DashboardContainer({ initialBalance, initialPresupuestos, initialGastosRecurrentes, categorias }: Props) {
  const [tabActiva, setTabActiva] = useState<TabId>("inicio");
  const [balance, setBalance] = useState<BalanceMensual>(initialBalance);
  const [presupuestos, setPresupuestos] = useState<PresupuestoConGasto[]>(initialPresupuestos);
  const [gastosRecurrentes, setGastosRecurrentes] = useState<GastoRecurrente[]>(initialGastosRecurrentes);
  const [anio, setAnio] = useState(initialBalance.actual.anio);
  const [mes, setMes] = useState(initialBalance.actual.mes);
  const [isPending, startTransition] = useTransition();
  const [conexionEnVivo, setConexionEnVivo] = useState(false);

  // NOTA: `initial*` (props) solo se usan para sembrar el estado en el primer
  // render (SSR). NO se re-sincronizan en un useEffect: cada revalidatePath()
  // de un Server Action re-renderiza DashboardPage con el MES ACTUAL (sin
  // saber qué mes está viendo este cliente), así que un efecto que copie esas
  // props a este estado pisaría el mes seleccionado con datos de otro mes.
  // A partir del primer render, este componente es la única fuente de verdad
  // para balance/presupuestos/gastosRecurrentes; se refrescan explícitamente
  // vía recargarDatos()/cambiarMes() (disparados por mutaciones locales,
  // Realtime, o al recuperar el foco — ver los efectos más abajo).

  // Notificaciones Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Evita que una respuesta vieja (p. ej. una recarga disparada por Realtime
  // justo antes de cambiar de mes) sobreescriba con datos obsoletos el
  // resultado de una solicitud más reciente que ya resolvió.
  const solicitudIdRef = useRef(0);

  // Agrupa recargas que llegan casi juntas (p. ej. una mutación local que
  // llama a recargarDatos() Y el evento Realtime del mismo INSERT que esa
  // mutación acaba de generar, que llega ~100-200ms después) en una sola
  // solicitud de red, en vez de repetir el mismo Promise.all de 3 consultas
  // dos veces seguidas por cada acción del usuario.
  const recargaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recarga silenciosa en tiempo real (invocada por WebSockets, Server Actions
  // locales, o al recuperar el foco/conexión)
  const recargarDatos = useCallback((mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => {
    if (mensajeToast) {
      setToast({
        id: String(Date.now()),
        texto: mensajeToast.texto,
        tipo: mensajeToast.tipo ?? "success",
      });
    }

    if (recargaTimeoutRef.current) clearTimeout(recargaTimeoutRef.current);
    recargaTimeoutRef.current = setTimeout(() => {
      const idSolicitud = ++solicitudIdRef.current;

      startTransition(async () => {
        try {
          const [nuevoBalance, nuevosPresupuestos, nuevosRecurrentes] = await Promise.all([
            obtenerBalanceMensual(anio, mes),
            obtenerPresupuestosConGasto(anio, mes),
            obtenerGastosRecurrentes(),
          ]);
          if (solicitudIdRef.current !== idSolicitud) return;
          setBalance(nuevoBalance);
          setPresupuestos(nuevosPresupuestos);
          setGastosRecurrentes(nuevosRecurrentes);
        } catch (err) {
          if (solicitudIdRef.current !== idSolicitud) return;
          console.error("Error recargando datos del dashboard:", err);
          setToast({
            id: String(Date.now()),
            texto: "No se pudieron actualizar los datos. Los que ves en pantalla podrían no ser los más recientes.",
            tipo: "error",
          });
        }
      });
    }, 300);
  }, [anio, mes]);

  useEffect(() => {
    return () => {
      if (recargaTimeoutRef.current) clearTimeout(recargaTimeoutRef.current);
    };
  }, []);

  // Siempre apunta a la versión más reciente de recargarDatos (con el
  // anio/mes vigente). El canal de Realtime de abajo la usa a través de esta
  // ref en vez de tenerla como dependencia directa, para poder suscribirse
  // una sola vez por sesión sin importar cuántas veces cambie el mes.
  const recargarDatosRef = useRef(recargarDatos);
  useEffect(() => {
    recargarDatosRef.current = recargarDatos;
  }, [recargarDatos]);

  // SUSCRIPCIÓN EN TIEMPO REAL VÍA SUPABASE WEBSOCKETS ⚡
  // A propósito NO depende de [anio, mes]: el filtro por user_id no cambia
  // con el mes que se está viendo, así que recrear el canal en cada cambio
  // de mes solo tiraba la conexión WebSocket y forzaba un nuevo handshake de
  // reconexión (se sentía como lentitud notoria al usar "mes siguiente/
  // anterior"). Ahora se suscribe una sola vez por sesión del componente.
  //
  // Este mismo efecto maneja recuperar visibilidad/foco/reconexión a
  // internet (antes vivía en un efecto aparte): la app es una PWA sin
  // Service Worker, así que si se manda a segundo plano (o el celular se
  // bloquea) por un rato, el WebSocket puede quedar en un estado "zombie" —
  // ni conectado ni reconectando — sin que la librería lo note sola (se
  // reportó como el indicador quedándose en "Reconectando..." indefinidamente).
  // Por eso, al recuperar visibilidad, si el canal no quedó SUBSCRIBED, se
  // resuscribe desde cero en vez de confiar en que se recupere solo.
  useEffect(() => {
    const supabase = createClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;
    // Empieza en `true` para no tratar la primera conexión como una
    // "reconexión" (evitaría una recarga redundante justo tras el SSR inicial).
    let estabaConectado = true;

    function suscribir(userId: string) {
      if (canal) supabase.removeChannel(canal);
      const filtro = `user_id=eq.${userId}`;

      canal = supabase
        .channel(`realtime_dashboard_${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "transacciones", filter: filtro }, () => recargarDatosRef.current())
        .on("postgres_changes", { event: "*", schema: "public", table: "presupuestos", filter: filtro }, () => recargarDatosRef.current())
        .on("postgres_changes", { event: "*", schema: "public", table: "gastos_recurrentes", filter: filtro }, () => recargarDatosRef.current())
        .on("postgres_changes", { event: "*", schema: "public", table: "transferencias", filter: filtro }, () => recargarDatosRef.current())
        .subscribe((status) => {
          if (cancelado) return;
          const conectado = status === "SUBSCRIBED";
          setConexionEnVivo(conectado);
          // Si el canal se había caído (celular en background, red inestable)
          // y se reconecta, pudimos perder eventos mientras estuvo caído:
          // refrescamos para no quedarnos con datos desfasados.
          if (conectado && !estabaConectado) {
            recargarDatosRef.current();
          }
          estabaConectado = conectado;
        });
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelado || !session?.user) return;
      suscribir(session.user.id);
    });

    function alRecuperarActividad() {
      if (cancelado || document.visibilityState !== "visible") return;
      recargarDatosRef.current();
      if (!estabaConectado) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!cancelado && session?.user) suscribir(session.user.id);
        });
      }
    }
    document.addEventListener("visibilitychange", alRecuperarActividad);
    window.addEventListener("focus", alRecuperarActividad);
    window.addEventListener("online", alRecuperarActividad);

    return () => {
      cancelado = true;
      setConexionEnVivo(false);
      document.removeEventListener("visibilitychange", alRecuperarActividad);
      window.removeEventListener("focus", alRecuperarActividad);
      window.removeEventListener("online", alRecuperarActividad);
      if (canal) supabase.removeChannel(canal);
    };
  }, []);

  function cambiarMes(nuevoAnio: number, nuevoMes: number) {
    setAnio(nuevoAnio);
    setMes(nuevoMes);

    const idSolicitud = ++solicitudIdRef.current;

    startTransition(async () => {
      try {
        const [nuevoBalance, nuevosPresupuestos] = await Promise.all([
          obtenerBalanceMensual(nuevoAnio, nuevoMes),
          obtenerPresupuestosConGasto(nuevoAnio, nuevoMes),
        ]);
        if (solicitudIdRef.current !== idSolicitud) return;
        setBalance(nuevoBalance);
        setPresupuestos(nuevosPresupuestos);
        // Los gastos recurrentes no cambian con el mes, no hay que recargarlos
      } catch (err) {
        if (solicitudIdRef.current !== idSolicitud) return;
        console.error("Error cambiando de mes:", err);
        setToast({
          id: String(Date.now()),
          texto: "No se pudo cargar ese mes. Intenta de nuevo.",
          tipo: "error",
        });
      }
    });
  }

  // Async y devuelve la promesa (no se envuelve en startTransition: eso ya
  // lo hace recargarDatos internamente) para que RecurringExpenses pueda
  // esperar a que termine y deshabilitar sus botones de "Pagar" mientras
  // tanto — sin eso, un doble clic alcanzaba a disparar dos cobros reales
  // antes de que la UI reflejara que ya se había registrado el primero.
  async function registrarGastoRecurrente(datos: {
    categoria_id: string;
    monto: number;
    descripcion: string;
    metodo_pago: MetodoPago;
    gasto_recurrente_id: string;
  }) {
    try {
      await crearTransaccion({
        categoria_id: datos.categoria_id,
        monto: datos.monto,
        descripcion: datos.descripcion,
        metodo_pago: datos.metodo_pago,
        gasto_recurrente_id: datos.gasto_recurrente_id,
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
      throw err;
    }
  }

  const mesISO = primerDiaDelMes(anio, mes);

  return (
    <main className="min-h-dvh max-w-app sm:max-w-desktop mx-auto pb-24 px-3 sm:px-6 bg-[#070a12] relative">
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
            <p
              className={`text-[10px] mt-0.5 flex items-center gap-1 font-medium ${
                conexionEnVivo ? "text-emerald-400" : "text-slate-500"
              }`}
            >
              <span className="relative flex h-2 w-2">
                {conexionEnVivo && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    conexionEnVivo ? "bg-emerald-500" : "bg-slate-600"
                  }`}
                ></span>
              </span>
              {conexionEnVivo ? "En Vivo (WebSocket)" : "Reconectando…"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <ExportButton anio={anio} mes={mes} nombreMes={balance.actual.nombreMes} />
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

      {/* CONTENIDO DE PESTAÑAS */}
      <div className="mt-1">
        {/* Pestaña 1: INICIO (Saldo Total + Movimientos del Mes) */}
        {tabActiva === "inicio" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <BalanceResumen
              actual={balance.actual}
              anterior={balance.anterior}
              onTransferenciaRealizada={recargarDatos}
            />
            <TransactionsSection
              key={`${anio}-${mes}`}
              initialTransacciones={balance.actual.transacciones}
              totalTransacciones={balance.actual.totalTransaccionesMes}
              categorias={categorias}
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
              transaccionesDelMes={balance.actual.transacciones}
              onRegistrarTransaccion={registrarGastoRecurrente}
            />
          </div>
        )}

        {/* Pestaña 3: ESTADÍSTICAS (Métricas + Gráficas de Dona y Flujo) */}
        {tabActiva === "estadisticas" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <AnalyticsSummary
              transacciones={balance.actual.transacciones}
              totalEgresos={balance.actual.egresos}
              anio={anio}
              mes={mes}
            />
            <FinancialCharts
              transacciones={balance.actual.transacciones}
              ingresosTotales={balance.actual.ingresos}
              egresosTotales={balance.actual.egresos}
            />
          </div>
        )}

        {/* Pestaña 4: PRESUPUESTOS (Barras de Salud Financiera y Límites) */}
        {tabActiva === "presupuestos" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <PresupuestosProgreso items={presupuestos} mesISO={mesISO} />
          </div>
        )}

        {/* Pestaña 5: ASESOR (Chat con IA + memoria persistente) */}
        {tabActiva === "asesor" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <AsesorChat />
          </div>
        )}
      </div>

      {/* Navegación por Pestañas Inferior (Bottom Nav Bar) */}
      <BottomNavigationBar tabActiva={tabActiva} onCambiarTab={setTabActiva} />
    </main>
  );
}
