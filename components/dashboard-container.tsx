"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import dynamic from "next/dynamic";
import { DashboardNavigation, sections } from "./dashboard-navigation";
import { MonthInsights } from "./month-insights";
import { LogOut, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BalanceResumen } from "@/components/balance-resumen";
import { AnalyticsSummary } from "@/components/analytics-summary";
import { PresupuestosProgreso } from "@/components/presupuestos-progreso";
import { TransactionsSection } from "@/components/transactions-section";
import { RecurringExpenses } from "@/components/recurring-expenses";
import { MonthSelector } from "@/components/month-selector";
import { ExportButton } from "@/components/export-button";
import { ToastNotification, type ToastMessage } from "@/components/toast-notification";
import { BottomNavigationBar, type TabId } from "@/components/bottom-navigation-bar";
import { GlowButton } from "@/components/react-bits/GlowButton";
import {
  obtenerCategorias,
  obtenerBalanceMensual,
  obtenerPresupuestosConGasto,
  obtenerGastosRecurrentes,
  obtenerClientes,
  obtenerMetaAhorro,
  crearTransaccion,
  signOut,
  type BalanceMensual,
} from "@/app/dashboard/actions";
import { primerDiaDelMes } from "@/lib/dates";
import type { Categoria, Cliente, GastoRecurrente, MetaAhorro, MetodoPago, PresupuestoConGasto } from "@/lib/types";
import { SavingsGoalCard } from "@/components/savings-goal-card";
import { HistorialModal } from "@/components/historial-modal";

const FinancialCharts = dynamic(() => import("./financial-charts").then(m => m.FinancialCharts), { loading: () => <p role="status" className="p-6 text-slate-400">Cargando gráficas…</p> });
const AsesorChat = dynamic(() => import("./asesor-chat").then(m => m.AsesorChat), { loading: () => <p role="status" className="p-6 text-slate-400">Abriendo asesor…</p> });

interface Props {
  initialBalance: BalanceMensual;
  initialPresupuestos: PresupuestoConGasto[];
  initialGastosRecurrentes: GastoRecurrente[];
  categorias: Categoria[];
  initialClientes: Cliente[];
  initialMeta: MetaAhorro | null;
}

export function DashboardContainer({
  initialBalance,
  initialPresupuestos,
  initialGastosRecurrentes,
  categorias: initialCategorias,
  initialClientes,
  initialMeta,
}: Props) {
  const [categorias, setCategorias] = useState(initialCategorias);
  const [tabActiva, setTabActiva] = useState<TabId>("inicio");
  const [asesorVisitado, setAsesorVisitado] = useState(false);
  const [balance, setBalance] = useState<BalanceMensual>(initialBalance);
  const [presupuestos, setPresupuestos] = useState<PresupuestoConGasto[]>(initialPresupuestos);
  const [gastosRecurrentes, setGastosRecurrentes] = useState<GastoRecurrente[]>(initialGastosRecurrentes);
  const [clientes, setClientes] = useState<Cliente[]>(initialClientes);
  const [meta, setMeta] = useState<MetaAhorro | null>(initialMeta);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [anio, setAnio] = useState(initialBalance.actual.anio);
  const [mes, setMes] = useState(initialBalance.actual.mes);
  const [isPending, startTransition] = useTransition();
  const [estadoConexion, setEstadoConexion] = useState<"conectando" | "vivo" | "caido">("conectando");

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
  // Identidad estable: ToastNotification tiene el temporizador de auto-cierre
  // en un efecto que depende de esta función. Pasada en línea (`() =>
  // setToast(null)`) cambiaba en cada render del dashboard, reiniciando la
  // cuenta de 3.5 s una y otra vez — con Realtime activo el toast se quedaba
  // pegado mucho más tiempo del previsto.
  const cerrarToast = useCallback(() => setToast(null), []);

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

  // El mes vigente leído por REF, no por closure. Antes recargarDatos era un
  // useCallback con deps [anio, mes], así que la función agendada en el
  // setTimeout de la recarga se quedaba con el mes que estaba vigente cuando
  // se agendó. Eso rompía el cambio de mes de forma muy visible:
  //   1. el navegador dispara `focus`/`visibilitychange` (pasa SIEMPRE al
  //      volver a la app, y también al primer clic tras recuperar el foco)
  //      → se agenda una recarga del mes M para dentro de 300 ms;
  //   2. el usuario toca "mes siguiente" → cambiarMes pide M+1;
  //   3. a los 300 ms se dispara la recarga vieja, pide M y —al ser más
  //      reciente— invalida la respuesta de M+1 con solicitudIdRef;
  //   4. resultado: el encabezado dice M+1 pero los datos son los de M.
  // Con la ref, cualquier recarga en vuelo apunta siempre al mes actual.
  const mesVistaRef = useRef({ anio, mes });
  mesVistaRef.current = { anio, mes };

  const cancelarRecargaPendiente = useCallback(() => {
    if (recargaTimeoutRef.current) {
      clearTimeout(recargaTimeoutRef.current);
      recargaTimeoutRef.current = null;
    }
  }, []);

  // Recarga silenciosa en tiempo real (invocada por WebSockets, Server Actions
  // locales, o al recuperar el foco/conexión). Identidad estable: no depende
  // de [anio, mes], así que no se recrea en cada cambio de mes.
  const recargarDatos = useCallback((mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => {
    if (mensajeToast) {
      setToast({
        id: String(Date.now()),
        texto: mensajeToast.texto,
        tipo: mensajeToast.tipo ?? "success",
      });
    }

    cancelarRecargaPendiente();
    recargaTimeoutRef.current = setTimeout(() => {
      recargaTimeoutRef.current = null;
      const idSolicitud = ++solicitudIdRef.current;
      const { anio: anioActual, mes: mesActual } = mesVistaRef.current;

      startTransition(async () => {
        try {
          const [nuevoBalance, nuevosPresupuestos, nuevosRecurrentes, nuevosClientes, nuevaMeta, nuevasCategorias] = await Promise.all([
            obtenerBalanceMensual(anioActual, mesActual),
            obtenerPresupuestosConGasto(anioActual, mesActual),
            obtenerGastosRecurrentes(),
            obtenerClientes(),
            obtenerMetaAhorro(),
            obtenerCategorias(),
          ]);
          if (solicitudIdRef.current !== idSolicitud) return;
          setBalance(nuevoBalance);
          setPresupuestos(nuevosPresupuestos);
          setGastosRecurrentes(nuevosRecurrentes);
          setClientes(nuevosClientes);
          setMeta(nuevaMeta);
          setCategorias(nuevasCategorias);
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
  }, [cancelarRecargaPendiente]);

  useEffect(() => cancelarRecargaPendiente, [cancelarRecargaPendiente]);

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
    let algunaVezVivo = false;

    function suscribir(userId: string) {
      if (canal) supabase.removeChannel(canal);
      const filtro = `user_id=eq.${userId}`;

      canal = supabase
        .channel(`realtime_dashboard_${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "categorias", filter: filtro }, () => recargarDatos())
        .on("postgres_changes", { event: "*", schema: "public", table: "transacciones", filter: filtro }, () => recargarDatos())
        .on("postgres_changes", { event: "*", schema: "public", table: "presupuestos", filter: filtro }, () => recargarDatos())
        .on("postgres_changes", { event: "*", schema: "public", table: "gastos_recurrentes", filter: filtro }, () => recargarDatos())
        .on("postgres_changes", { event: "*", schema: "public", table: "transferencias", filter: filtro }, () => recargarDatos())
        .on("postgres_changes", { event: "*", schema: "public", table: "metas_ahorro", filter: filtro }, () => recargarDatos())
        .on("postgres_changes", { event: "*", schema: "public", table: "clientes", filter: filtro }, () => recargarDatos())
        .subscribe((status) => {
          if (cancelado) return;
          const conectado = status === "SUBSCRIBED";
          setEstadoConexion(conectado ? "vivo" : algunaVezVivo ? "caido" : "conectando");
          if (conectado) algunaVezVivo = true;
          // Si el canal se había caído (celular en background, red inestable)
          // y se reconecta, pudimos perder eventos mientras estuvo caído:
          // refrescamos para no quedarnos con datos desfasados.
          if (conectado && !estabaConectado) {
            recargarDatos();
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
      recargarDatos();
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
      setEstadoConexion("conectando");
      document.removeEventListener("visibilitychange", alRecuperarActividad);
      window.removeEventListener("focus", alRecuperarActividad);
      window.removeEventListener("online", alRecuperarActividad);
      if (canal) supabase.removeChannel(canal);
    };
    // recargarDatos tiene identidad estable (no depende de anio/mes), así que
    // este efecto sigue corriendo una sola vez por sesión del componente.
  }, [recargarDatos]);

  function cambiarMes(nuevoAnio: number, nuevoMes: number) {
    if (nuevoAnio === anio && nuevoMes === mes) return;

    setAnio(nuevoAnio);
    setMes(nuevoMes);
    mesVistaRef.current = { anio: nuevoAnio, mes: nuevoMes };

    // Cualquier recarga que quedó agendada (foco recuperado, evento Realtime,
    // una mutación reciente) apuntaba al mes anterior: se cancela aquí para
    // que no pise la petición de este mes al resolver después.
    cancelarRecargaPendiente();

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
        setAnio(balance.actual.anio);
        setMes(balance.actual.mes);
        mesVistaRef.current = { anio: balance.actual.anio, mes: balance.actual.mes };
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
      setToast({
        id: String(Date.now()),
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
        <div className="flex items-center gap-2.5">
          <span className="brand-mark lg:hidden" aria-hidden="true">n.</span>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1.5 leading-none">
              <span className="lg:hidden">NexFin Pro</span><span className="hidden lg:inline text-slate-300 font-medium">Mi espacio financiero</span>
            </h1>
            <p
              className={`text-[10px] mt-0.5 flex items-center gap-1 font-medium ${
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
              anterior={balance.anterior}
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
