"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RecargarDatos } from "./use-dashboard-data";

export type EstadoConexion = "conectando" | "vivo" | "caido";

/** Mantiene la suscripción activa y recupera datos tras volver del segundo plano. */
export function useDashboardRealtime(recargarDatos: RecargarDatos): EstadoConexion {
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexion>("conectando");

  useEffect(() => {
    const supabase = createClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;
    let estabaConectado = true;
    let algunaVezVivo = false;
    let ultimoFoco = Date.now();
    let buscandoSesion = false;

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
        .on("postgres_changes", { event: "*", schema: "public", table: "cuentas_financieras", filter: filtro }, () => recargarDatos())
        .subscribe((status) => {
          if (cancelado) return;
          const conectado = status === "SUBSCRIBED";
          setEstadoConexion(conectado ? "vivo" : algunaVezVivo ? "caido" : "conectando");
          if (conectado) algunaVezVivo = true;
          if (conectado && !estabaConectado) recargarDatos();
          estabaConectado = conectado;
        });
    }

    async function restablecerSuscripcion() {
      if (cancelado || buscandoSesion) return;
      buscandoSesion = true;
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (cancelado) return;
        if (error || !session?.user) {
          estabaConectado = false;
          setEstadoConexion("caido");
          if (error) console.warn("No se pudo recuperar la sesión de Realtime:", error);
          return;
        }
        suscribir(session.user.id);
      } catch (error) {
        if (!cancelado) {
          estabaConectado = false;
          setEstadoConexion("caido");
          console.warn("No se pudo iniciar la suscripción de Realtime:", error);
        }
      } finally {
        buscandoSesion = false;
      }
    }
    void restablecerSuscripcion();

    function alRecuperarActividad() {
      if (cancelado || document.visibilityState !== "visible") return;
      const ahora = Date.now();
      const requiereRecarga = ahora - ultimoFoco >= 30_000;
      ultimoFoco = ahora;
      if (requiereRecarga) recargarDatos();
      if (!canal || !estabaConectado) void restablecerSuscripcion();
    }
    document.addEventListener("visibilitychange", alRecuperarActividad);
    window.addEventListener("focus", alRecuperarActividad);
    window.addEventListener("online", alRecuperarActividad);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", alRecuperarActividad);
      window.removeEventListener("focus", alRecuperarActividad);
      window.removeEventListener("online", alRecuperarActividad);
      if (canal) supabase.removeChannel(canal);
    };
  }, [recargarDatos]);

  return estadoConexion;
}
