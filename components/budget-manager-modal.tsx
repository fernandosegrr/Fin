"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Save, ShieldCheck, Check } from "lucide-react";
import { guardarPresupuestosMultiples } from "@/app/dashboard/actions";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { formatearMonto } from "@/lib/format";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { PresupuestoConGasto } from "@/lib/types";

interface Props {
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

export function BudgetManagerModal({ abierto, onCerrar, items, mesISO, onGuardado }: Props) {
  const [limites, setLimites] = useState<Record<string, string>>(() => limitesDesdeItems(items));

  const [isPending, startTransition] = useTransition();
  const [mensajeExito, setMensajeExito] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!abierto) return null;

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
        onGuardado?.();
        setMensajeExito(true);
        setTimeout(() => {
          setMensajeExito(false);
          onCerrar();
        }, 1200);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar los presupuestos.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-gestion-presupuestos"
          className="w-full max-w-lg rounded-3xl border border-white/[0.08] bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div>
              <h2 id="titulo-gestion-presupuestos" className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Gestión de Presupuestos
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Establece límites de gasto para cada categoría de egreso.
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="rounded-xl p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
              {error}
            </div>
          )}

          {mensajeExito && (
            <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 flex items-center gap-2 font-bold">
              <Check className="h-4 w-4" /> Presupuestos actualizados con éxito.
            </div>
          )}

          {/* Lista de categorías con inputs */}
          <div className="mt-4 flex-1 overflow-y-auto space-y-2.5 pr-1">
            {items.map((item) => {
              const valorInput = limites[item.categoria.id] ?? "";
              return (
                <div
                  key={item.categoria.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                >
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-slate-200">{item.categoria.nombre}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                    Gastado este mes:{" "}
                    <span className="font-semibold text-slate-300">{formatearMonto(item.gastado)}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-slate-800/80 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-emerald-400/60">
                  <span className="text-xs text-slate-400 font-semibold">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Sin límite"
                    value={valorInput}
                    onChange={(e) => manejarCambio(item.categoria.id, e.target.value)}
                    className="w-24 bg-transparent text-sm text-right font-medium text-slate-100 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-end gap-3">
          <GlowButton variant="secondary" onClick={onCerrar} disabled={isPending}>
            Cancelar
          </GlowButton>
          <GlowButton variant="primary" onClick={guardarTodos} disabled={isPending}>
            <Save className="h-4 w-4" />
            {isPending ? "Guardando..." : "Guardar Cambios"}
          </GlowButton>
        </div>
      </div>
    </div>
  );
}
