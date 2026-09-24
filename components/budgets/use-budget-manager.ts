"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { guardarPresupuestosMultiples } from "@/app/dashboard/actions";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { PresupuestoConGasto } from "@/lib/types";

interface Options {
  abierto: boolean;
  onCerrar: () => void;
  items: PresupuestoConGasto[];
  mesISO: string;
  onGuardado?: () => void;
}

function limitesDesdeItems(items: PresupuestoConGasto[]): Record<string, string> {
  const mapa: Record<string, string> = {};
  items.forEach((item) => {
    mapa[item.categoria.id] = item.presupuesto?.monto_limite
      ? String(item.presupuesto.monto_limite)
      : "";
  });
  return mapa;
}

export function useBudgetManager({ abierto, onCerrar, items, mesISO, onGuardado }: Options) {
  const [limites, setLimites] = useState<Record<string, string>>(() => limitesDesdeItems(items));

  const [isPending, startTransition] = useTransition();
  const [mensajeExito, setMensajeExito] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cierreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vistaActualRef = useRef({ abierto, mesISO });
  vistaActualRef.current = { abierto, mesISO };

  useEffect(() => {
    if (cierreTimeoutRef.current) clearTimeout(cierreTimeoutRef.current);
    cierreTimeoutRef.current = null;
    setMensajeExito(false);
    setError(null);
  }, [abierto, mesISO]);

  useEffect(() => () => {
    if (cierreTimeoutRef.current) clearTimeout(cierreTimeoutRef.current);
  }, []);

  // El `useState(inicializador)` de arriba solo corre en el primer montaje, y
  // este modal nunca se desmonta (el `return null` de abajo va después de los
  // hooks). Sin esto, al cambiar de mes y volver a abrir "Ajustar Límites" se
  // seguían viendo los límites del PRIMER mes cargado — y "Guardar Cambios"
  // los escribía sobre el mes nuevo. Se resincroniza al abrir y al cambiar de
  // mes; mientras está abierto no se toca, para no borrar lo que se escribe.
  useEffect(() => {
    if (abierto) setLimites(limitesDesdeItems(items));
    // `items` a propósito fuera de las dependencias: cambia de identidad en
    // cada recarga en vivo y reescribiría el formulario mientras se teclea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, mesISO]);

  useEscapeKey(abierto, onCerrar);

  function manejarCambio(categoriaId: string, valor: string) {
    setLimites((prev) => ({ ...prev, [categoriaId]: valor }));
  }

  function guardarTodos() {
    setError(null);
    setMensajeExito(false);

    startTransition(async () => {
      try {
        const payload = items.map((item) => {
          const valStr = limites[item.categoria.id] ?? "";
          const num = Number(valStr);
          const montoLimite = Number.isFinite(num) && num > 0 ? num : 0;
          return { categoria_id: item.categoria.id, monto_limite: montoLimite };
        });
        await guardarPresupuestosMultiples(mesISO, payload);
        if (!vistaActualRef.current.abierto || vistaActualRef.current.mesISO !== mesISO) return;
        onGuardado?.();
        setMensajeExito(true);
        cierreTimeoutRef.current = setTimeout(() => {
          cierreTimeoutRef.current = null;
          setMensajeExito(false);
          onCerrar();
        }, 1200);
      } catch (err) {
        if (vistaActualRef.current.abierto && vistaActualRef.current.mesISO === mesISO) {
          setError(err instanceof Error ? err.message : "Error al guardar los presupuestos.");
        }
      }
    });
  }

  return { limites, isPending, mensajeExito, error, manejarCambio, guardarTodos };
}
