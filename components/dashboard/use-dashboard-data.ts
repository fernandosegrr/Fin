"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  obtenerBalanceMensual,
  obtenerDatosDashboard,
  obtenerPresupuestosConGasto,
  type BalanceMensual,
} from "@/app/dashboard/actions";
import type {
  Categoria,
  Cliente,
  GastoRecurrente,
  MetaAhorro,
  PresupuestoConGasto,
} from "@/lib/types";
import type { ToastMessage } from "@/components/toast-notification";

export interface DashboardInitialData {
  initialBalance: BalanceMensual;
  initialPresupuestos: PresupuestoConGasto[];
  initialGastosRecurrentes: GastoRecurrente[];
  categorias: Categoria[];
  initialClientes: Cliente[];
  initialMeta: MetaAhorro | null;
}

export type DashboardToast = { texto: string; tipo?: "success" | "error" | "info" };

/**
 * Las props del servidor solo siembran el primer render. Revalidaciones pueden
 * traer el mes actual mientras el usuario ve otro; las recargas explícitas
 * mantienen los datos alineados con el mes seleccionado.
 */
export function useDashboardData(initial: DashboardInitialData) {
  const [categorias, setCategorias] = useState(initial.categorias);
  const [balance, setBalance] = useState(initial.initialBalance);
  const [presupuestos, setPresupuestos] = useState(initial.initialPresupuestos);
  const [gastosRecurrentes, setGastosRecurrentes] = useState(initial.initialGastosRecurrentes);
  const [clientes, setClientes] = useState(initial.initialClientes);
  const [meta, setMeta] = useState(initial.initialMeta);
  const [anio, setAnio] = useState(initial.initialBalance.actual.anio);
  const [mes, setMes] = useState(initial.initialBalance.actual.mes);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const solicitudIdRef = useRef(0);
  const recargaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mesVistaRef = useRef({ anio, mes });
  const balanceCargadoRef = useRef(balance);
  mesVistaRef.current = { anio, mes };
  balanceCargadoRef.current = balance;

  const mostrarToast = useCallback((mensaje: DashboardToast) => {
    setToast({ id: String(Date.now()), texto: mensaje.texto, tipo: mensaje.tipo ?? "success" });
  }, []);
  const cerrarToast = useCallback(() => setToast(null), []);

  const cancelarRecargaPendiente = useCallback(() => {
    if (recargaTimeoutRef.current) {
      clearTimeout(recargaTimeoutRef.current);
      recargaTimeoutRef.current = null;
    }
  }, []);

  const recargarDatos = useCallback((mensajeToast?: DashboardToast) => {
    if (mensajeToast) mostrarToast(mensajeToast);
    cancelarRecargaPendiente();
    // Una mutación y su evento Realtime suelen llegar casi juntos.
    recargaTimeoutRef.current = setTimeout(() => {
      recargaTimeoutRef.current = null;
      const idSolicitud = ++solicitudIdRef.current;
      const { anio: anioActual, mes: mesActual } = mesVistaRef.current;
      startTransition(async () => {
        try {
          const datos = await obtenerDatosDashboard(anioActual, mesActual);
          if (solicitudIdRef.current !== idSolicitud) return;
          setBalance(datos.balance);
          setPresupuestos(datos.presupuestos);
          setGastosRecurrentes(datos.gastosRecurrentes);
          setClientes(datos.clientes);
          setMeta(datos.meta);
          setCategorias(datos.categorias);
        } catch (error) {
          if (solicitudIdRef.current !== idSolicitud) return;
          console.error("Error recargando datos del dashboard:", error);
          mostrarToast({
            texto: "No se pudieron actualizar los datos. Los que ves en pantalla podrían no ser los más recientes.",
            tipo: "error",
          });
        }
      });
    }, 300);
  }, [cancelarRecargaPendiente, mostrarToast]);

  useEffect(() => cancelarRecargaPendiente, [cancelarRecargaPendiente]);

  function cambiarMes(nuevoAnio: number, nuevoMes: number) {
    if (nuevoAnio === anio && nuevoMes === mes) return;
    setAnio(nuevoAnio);
    setMes(nuevoMes);
    mesVistaRef.current = { anio: nuevoAnio, mes: nuevoMes };
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
      } catch (error) {
        if (solicitudIdRef.current !== idSolicitud) return;
        const { anio: anioCargado, mes: mesCargado } = balanceCargadoRef.current.actual;
        setAnio(anioCargado);
        setMes(mesCargado);
        mesVistaRef.current = { anio: anioCargado, mes: mesCargado };
        console.error("Error cambiando de mes:", error);
        mostrarToast({ texto: "No se pudo cargar ese mes. Intenta de nuevo.", tipo: "error" });
      }
    });
  }

  return {
    categorias,
    balance,
    presupuestos,
    gastosRecurrentes,
    clientes,
    meta,
    anio,
    mes,
    isPending,
    toast,
    cerrarToast,
    mostrarToast,
    recargarDatos,
    cambiarMes,
  };
}

export type RecargarDatos = ReturnType<typeof useDashboardData>["recargarDatos"];
