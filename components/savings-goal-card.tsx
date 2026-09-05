"use client";

import { parsearMonto } from "@/lib/format";

import { useState } from "react";
import { Flag, Pencil, Trash2, X, Loader2, Check } from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { formatearMonto } from "@/lib/format";
import { useEscapeKey } from "@/lib/use-escape-key";
import { eliminarMetaAhorro, guardarMetaAhorro } from "@/app/dashboard/actions";
import type { MetaAhorro } from "@/lib/types";

interface Props {
  meta: MetaAhorro | null;
  saldoActual: number;
  onCambio: (mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => void;
}

export function SavingsGoalCard({ meta, saldoActual, onCambio }: Props) {
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
    const resultado = await guardarMetaAhorro({
      nombre,
      monto_objetivo: monto,
      fecha_limite: fecha || null,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setModalAbierto(false);
    onCambio({ texto: "Meta de ahorro guardada.", tipo: "success" });
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
  const restante = objetivo - saldoActual;

  return (
    <>
      <SpotlightCard className="bg-slate-900/60 border-white/10 p-5 rounded-3xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <Flag className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-100 truncate">
                {meta ? meta.nombre : "Meta de ahorro"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {meta
                  ? meta.fecha_limite
                    ? `Objetivo ${formatearMonto(objetivo)} · para el ${meta.fecha_limite}`
                    : `Objetivo ${formatearMonto(objetivo)}`
                  : "Define cuánto quieres reunir."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {meta && (
              <button type="button" onClick={borrar} className="p-1.5 text-slate-500 hover:text-rose-400" title="Quitar meta">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" onClick={abrir} className="p-1.5 text-slate-500 hover:text-emerald-400" title="Editar meta">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {meta ? (
          <>
            <p className="mt-6 text-3xl font-semibold tracking-tight tabular-nums">{porcentaje}<span className="text-lg text-slate-400">% de tu objetivo</span></p>
            <p className="text-xs text-slate-400 mt-2">Referencia con tu saldo disponible; no es dinero apartado.</p>
            <div role="progressbar" aria-label="Avance de la meta" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100} className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-white/5 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span className="tabular-nums font-semibold text-slate-200">{porcentaje}%</span>
              <span>
                {restante > 0
                  ? `Faltan ${formatearMonto(restante)}`
                  : "¡Ya alcanzaste la meta!"}
              </span>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={abrir}
            className="mt-3 w-full rounded-2xl border border-dashed border-white/15 py-2 text-xs font-semibold text-emerald-400 hover:border-emerald-400/40"
          >
            Crear meta
          </button>
        )}
      </SpotlightCard>

      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalAbierto(false);
          }}
        >
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Flag className="h-4 w-4 text-emerald-400" /> Meta de ahorro
              </h3>
              <button type="button" onClick={() => setModalAbierto(false)} aria-label="Cerrar" className="p-1.5 text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={guardar} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Fondo de emergencia"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Monto objetivo</label>
                <div className="flex items-center rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 focus-within:border-emerald-400/60">
                  <span className="text-slate-400 mr-2">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={montoTexto}
                    onChange={(e) => setMontoTexto(e.target.value)}
                    placeholder="15000"
                    className="w-full bg-transparent text-sm font-bold text-slate-100 focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha límite (opcional)</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
                />
              </div>
              {error && (
                <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">{error}</p>
              )}
              <GlowButton type="submit" variant="primary" disabled={guardando} className="w-full">
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Guardar meta
              </GlowButton>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
