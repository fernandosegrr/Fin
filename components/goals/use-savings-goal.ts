"use client";

import { useState } from "react";
import { parsearMonto, redondearMonto } from "@/lib/format";
import { useEscapeKey } from "@/lib/use-escape-key";
import { eliminarMetaAhorro, guardarMetaAhorro } from "@/app/dashboard/actions";
import type { MetaAhorro } from "@/lib/types";

interface Options {
  meta: MetaAhorro | null;
  saldoActual: number;
  onCambio: (mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => void;
}

export function useSavingsGoal({ meta, saldoActual, onCambio }: Options) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nombre, setNombre] = useState(meta?.nombre ?? "");
  const [montoTexto, setMontoTexto] = useState(meta ? String(meta.monto_objetivo) : "");
  const [fecha, setFecha] = useState(meta?.fecha_limite ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(modalAbierto, () => setModalAbierto(false));

  function abrir() {
    setNombre(meta?.nombre ?? "");
    setMontoTexto(meta ? String(meta.monto_objetivo) : "");
    setFecha(meta?.fecha_limite ?? "");
    setError(null);
    setModalAbierto(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const monto = parsearMonto(montoTexto);
    setGuardando(true);
    setError(null);
    try {
      const resultado = await guardarMetaAhorro({
        nombre,
        monto_objetivo: monto,
        fecha_limite: fecha || null,
      });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setModalAbierto(false);
      onCambio({ texto: "Meta de ahorro guardada.", tipo: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la meta.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!confirm("¿Quitar la meta de ahorro?")) return;
    try {
      await eliminarMetaAhorro();
      onCambio({ texto: "Meta de ahorro eliminada.", tipo: "info" });
    } catch (err) {
      onCambio({
        texto: err instanceof Error ? err.message : "No se pudo eliminar la meta.",
        tipo: "error",
      });
    }
  }

  const objetivo = meta?.monto_objetivo ?? 0;
  const porcentaje = objetivo > 0 ? Math.min(100, Math.round((Math.max(0, saldoActual) / objetivo) * 100)) : 0;
  const restante = redondearMonto(objetivo - saldoActual);

  return {
    modalAbierto, setModalAbierto, nombre, setNombre, montoTexto, setMontoTexto, fecha, setFecha,
    guardando, error, abrir, guardar, borrar, objetivo, porcentaje, restante,
  };
}
