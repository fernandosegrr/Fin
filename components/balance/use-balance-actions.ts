"use client";

import { useState } from "react";
import { ajustarSaldo, actualizarTransferencia, crearTransferencia, eliminarTransferencia, type BalanceMensual } from "@/app/dashboard/actions";
import { formatearMonto, parsearMonto } from "@/lib/format";
import { hoyEnMexico, hoyISOEnMexico } from "@/lib/dates";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { MetodoPago, Transferencia } from "@/lib/types";

interface Options {
  actual: BalanceMensual["actual"];
  onTransferenciaRealizada?: (mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => void;
}

export const NOMBRE_METODO: Record<MetodoPago, string> = {
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
};

export function useBalanceActions({ actual, onTransferenciaRealizada }: Options) {
  const saldoPositivo = actual.saldoTotalDisponible >= 0;

  // Fondos disponibles del mes: incluye el saldo que llegó de meses anteriores.
  const fondosDelMes = Math.max(0, actual.saldoInicial + actual.ingresos);
  const porcentajeDisponible = fondosDelMes > 0
    ? Math.max(0, Math.round((actual.saldoTotalDisponible / fondosDelMes) * 100))
    : 0;

  const [modalAbierto, setModalAbierto] = useState(false);
  const [montoTexto, setMontoTexto] = useState("");
  const [origen, setOrigen] = useState<MetodoPago>("tarjeta");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [transferenciaEditandoId, setTransferenciaEditandoId] = useState<string | null>(null);
  const [modalAjuste, setModalAjuste] = useState(false);
  const [ajusteMetodo, setAjusteMetodo] = useState<MetodoPago>("efectivo");
  const [ajusteMonto, setAjusteMonto] = useState("");
  const [ajusteError, setAjusteError] = useState<string | null>(null);
  const [ajusteSaving, setAjusteSaving] = useState(false);

  const destino: MetodoPago = origen === "tarjeta" ? "efectivo" : "tarjeta";
  const hoy = hoyEnMexico();
  const esMesEnCurso = actual.anio === hoy.anio && actual.mes === hoy.mes;

  useEscapeKey(modalAbierto, () => setModalAbierto(false));
  useEscapeKey(modalAjuste, () => setModalAjuste(false));

  function abrirModalAjuste() {
    const metodoInicial: MetodoPago = "efectivo";
    setAjusteMetodo(metodoInicial);
    setAjusteMonto(esMesEnCurso ? String(actual.totalesEfectivo.saldo) : "");
    setAjusteError(null);
    setModalAjuste(true);
  }

  async function manejarAjuste(e: React.FormEvent) {
    e.preventDefault();
    const objetivo = parsearMonto(ajusteMonto);
    if (!Number.isFinite(objetivo)) {
      setAjusteError("Ingresa el saldo real que tienes.");
      return;
    }
    setAjusteSaving(true);
    setAjusteError(null);
    const resultado = await ajustarSaldo(ajusteMetodo, objetivo);
    setAjusteSaving(false);
    if (!resultado.ok) {
      setAjusteError(resultado.error);
      return;
    }
    setModalAjuste(false);
    const signo = resultado.diferencia >= 0 ? "+" : "−";
    onTransferenciaRealizada?.({
      texto: `Saldo de ${NOMBRE_METODO[ajusteMetodo]} ajustado (${signo}${formatearMonto(Math.abs(resultado.diferencia))}).`,
      tipo: "success",
    });
  }

  function abrirModalTransferencia() {
    setMontoTexto("");
    setDescripcion("");
    setOrigen("tarjeta");
    setFecha(hoyISOEnMexico());
    setErrorForm(null);
    setTransferenciaEditandoId(null);
    setModalAbierto(true);
  }

  function abrirEdicionTransferencia(t: Transferencia) {
    setMontoTexto(String(t.monto));
    setDescripcion(t.descripcion ?? "");
    setOrigen(t.origen);
    setFecha(t.fecha);
    setErrorForm(null);
    setTransferenciaEditandoId(t.id);
    setModalAbierto(true);
  }

  function cancelarEdicionTransferencia() {
    setTransferenciaEditandoId(null);
    setMontoTexto("");
    setDescripcion("");
    setOrigen("tarjeta");
    setFecha(hoyISOEnMexico());
    setErrorForm(null);
  }

  async function manejarEnvioTransferencia(e: React.FormEvent) {
    e.preventDefault();
    const monto = parsearMonto(montoTexto);
    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorForm("Ingresa un monto válido mayor a 0.");
      return;
    }

    setIsSaving(true);
    setErrorForm(null);
    try {
      if (transferenciaEditandoId) {
        await actualizarTransferencia(transferenciaEditandoId, {
          monto,
          origen,
          destino,
          descripcion: descripcion.trim() || null,
          fecha,
        });
        setModalAbierto(false);
        onTransferenciaRealizada?.({
          texto: `Traspaso corregido: ${formatearMonto(monto)} de ${NOMBRE_METODO[origen]} a ${NOMBRE_METODO[destino]}. ✏️`,
          tipo: "success",
        });
      } else {
        await crearTransferencia({ monto, origen, destino, descripcion: descripcion.trim() || null, fecha });
        setModalAbierto(false);
        onTransferenciaRealizada?.({
          texto: `¡Traspaso de ${formatearMonto(monto)} de ${NOMBRE_METODO[origen]} a ${NOMBRE_METODO[destino]} registrado! ⇄`,
          tipo: "success",
        });
      }
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "Error al registrar el traspaso.");
    } finally {
      setIsSaving(false);
    }
  }

  async function manejarEliminarTransferencia(id: string) {
    if (eliminandoId) return;
    if (!confirm("¿Eliminar este traspaso? El saldo de cada método se revertirá.")) return;
    setEliminandoId(id);
    setErrorForm(null);
    try {
      await eliminarTransferencia(id);
      if (transferenciaEditandoId === id) cancelarEdicionTransferencia();
      onTransferenciaRealizada?.({
        texto: "Traspaso eliminado.",
        tipo: "info",
      });
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo eliminar el traspaso.");
    } finally {
      setEliminandoId(null);
    }
  }

  return {
    saldoPositivo, porcentajeDisponible, modalAbierto, setModalAbierto, montoTexto, setMontoTexto,
    origen, setOrigen, descripcion, setDescripcion, fecha, setFecha, isSaving, eliminandoId,
    errorForm, transferenciaEditandoId, modalAjuste, setModalAjuste, ajusteMetodo, setAjusteMetodo,
    ajusteMonto, setAjusteMonto, ajusteError, ajusteSaving, destino, esMesEnCurso,
    abrirModalAjuste, manejarAjuste, abrirModalTransferencia, abrirEdicionTransferencia,
    cancelarEdicionTransferencia, manejarEnvioTransferencia, manejarEliminarTransferencia,
  };
}
