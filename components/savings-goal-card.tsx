"use client";

import { Flag, Pencil, Trash2, X, Loader2, Target, Check } from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { formatearMonto } from "@/lib/format";
import type { MetaAhorro } from "@/lib/types";
import { useSavingsGoal } from "./goals/use-savings-goal";

interface Props {
  meta: MetaAhorro | null;
  saldoActual: number;
  onCambio: (mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => void;
}

export function SavingsGoalCard({ meta, saldoActual, onCambio }: Props) {
  const {
    modalAbierto, setModalAbierto, nombre, setNombre, montoTexto, setMontoTexto, fecha, setFecha,
    guardando, error, abrir, guardar, borrar, objetivo, porcentaje, restante,
  } = useSavingsGoal({ meta, saldoActual, onCambio });

  return (
    <>
      <SpotlightCard
        spotlightColor="rgba(139, 92, 246, 0.15)"
        className="relative overflow-hidden bg-white border border-[#DCE4DB] p-5 sm:p-6 rounded-3xl shadow-xl shadow-black/5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EDF5EF] border border-[#DCE4DB] text-[#286F50] shrink-0 shadow-sm shadow-violet-500/10">
              <Flag className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-[#286F50] block">
                Meta de ahorro
              </span>
              <h3 className="text-base font-semibold text-[#1C3028] break-words mt-0.5">
                {meta ? meta.nombre : "Define tu meta"}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {meta && (
              <button
                type="button"
                onClick={borrar}
                className="p-2 rounded-xl text-[#5E7165] hover:text-[#AA524A] hover:bg-rose-500/10 transition-colors"
                title="Quitar meta"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={abrir}
              className="p-2 rounded-xl text-[#5E7165] hover:text-[#1C3028] hover:bg-[#F4F7F2] transition-colors"
              title={meta ? "Editar meta" : "Crear meta"}
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        </div>

        {meta ? (
          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-semibold tracking-tight tabular-nums text-[#1C3028]">
                {porcentaje}%
              </span>
              <span className="text-xs font-semibold text-[#5E7165]">
                Objetivo: <strong className="text-[#263D33]">{formatearMonto(objetivo)}</strong>
              </span>
            </div>

            {/* Avance de la meta */}
            <div
              role="progressbar"
              aria-label="Avance de la meta"
              aria-valuenow={porcentaje}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3.5 h-3 w-full overflow-hidden rounded-full bg-[#F7F9F5] border border-[#DCE4DB] p-0.5"
            >
              <div
                className="h-full rounded-full bg-[#6C8272] transition-all duration-700"
                style={{ width: `${porcentaje}%` }}
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#5E7165]">
              <span className="font-medium">
                {meta.fecha_limite ? `Límite: ${meta.fecha_limite}` : "Sin fecha límite"}
              </span>
              <span className="font-semibold text-[#263D33]">
                {restante >= 0.01 ? `Faltan ${formatearMonto(restante)}` : "¡Meta alcanzada! 🎉"}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 pt-3 border-t border-[#DCE4DB] text-center">
            <p className="text-xs text-[#5E7165] mb-3">
              Vincula un objetivo a tu ahorro separado para medir tu avance.
            </p>
            <button
              type="button"
              onClick={abrir}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-[#CBD6CA] bg-[#F4F7F2] text-xs font-bold text-[#286F50] hover:border-violet-400/40 hover:bg-violet-500/10 transition-all"
            >
              <Target className="h-4 w-4" /> Establecer meta de ahorro
            </button>
          </div>
        )}
      </SpotlightCard>

      {/* Modal de edición de meta */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14251D]/45 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalAbierto(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-3xl border border-[#DCE4DB] bg-white p-6 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE4DB]">
              <h3 className="text-sm font-bold text-[#1C3028] flex items-center gap-2">
                <Flag className="h-4 w-4 text-[#286F50]" /> Meta de ahorro
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                aria-label="Cerrar"
                className="p-1.5 text-[#5E7165] hover:text-[#1C3028] rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={guardar} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="meta-nombre" className="block text-xs font-medium text-[#5E7165] mb-1">Nombre</label>
                <input
                  id="meta-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Fondo de emergencia, Viaje..."
                  className="w-full rounded-2xl border border-[#DCE4DB] bg-[#F7F9F5] px-4 py-2.5 text-sm text-[#1C3028] placeholder:text-[#96A399] focus:border-violet-400/60 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="meta-monto" className="block text-xs font-medium text-[#5E7165] mb-1">Monto objetivo</label>
                <div className="relative flex items-center rounded-2xl bg-[#F7F9F5] border border-[#DCE4DB] px-4 py-2.5 focus-within:border-violet-400/60">
                  <span className="text-lg font-bold text-[#5E7165] mr-2">$</span>
                  <input
                    id="meta-monto"
                    type="text"
                    inputMode="decimal"
                    value={montoTexto}
                    onChange={(e) => setMontoTexto(e.target.value)}
                    placeholder="25000"
                    className="w-full bg-transparent text-xl font-bold text-[#1C3028] placeholder:text-[#9CA99F] focus:outline-none tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="meta-fecha" className="block text-xs font-medium text-[#5E7165] mb-1">
                  Fecha límite (opcional)
                </label>
                <input
                  id="meta-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full rounded-2xl border border-[#DCE4DB] bg-[#F7F9F5] px-4 py-2.5 text-sm text-[#1C3028] focus:border-violet-400/60 focus:outline-none"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-[#AA524A]">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <GlowButton type="button" variant="secondary" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </GlowButton>
                <GlowButton type="submit" variant="primary" disabled={guardando} className="flex-1">
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Guardar meta
                </GlowButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
