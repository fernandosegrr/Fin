"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PiggyBank,
  CreditCard,
  Banknote,
  History,
  ArrowRightLeft,
  X,
  Loader2,
} from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { AnimatedNumber } from "@/components/react-bits/AnimatedNumber";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { formatearMonto } from "@/lib/format";
import { formatearFechaCorta, hoyISOEnMexico } from "@/lib/dates";
import { crearTransferencia, type BalanceMensual } from "@/app/dashboard/actions";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { MetodoPago } from "@/lib/types";

interface Props {
  actual: BalanceMensual["actual"];
  anterior: BalanceMensual["anterior"];
  onTransferenciaRealizada?: (mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => void;
}

const NOMBRE_METODO: Record<MetodoPago, string> = {
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
};

export function BalanceResumen({ actual, anterior, onTransferenciaRealizada }: Props) {
  const saldoPositivo = actual.saldoTotalDisponible >= 0;

  // Tasa de ahorro (%)
  const tasaAhorro = actual.ingresos > 0
    ? Math.max(0, Math.round(((actual.ingresos - actual.egresos) / actual.ingresos) * 100))
    : 0;

  const [modalAbierto, setModalAbierto] = useState(false);
  const [montoTexto, setMontoTexto] = useState("");
  const [origen, setOrigen] = useState<MetodoPago>("tarjeta");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const destino: MetodoPago = origen === "tarjeta" ? "efectivo" : "tarjeta";

  useEscapeKey(modalAbierto, () => setModalAbierto(false));

  function abrirModalTransferencia() {
    setMontoTexto("");
    setDescripcion("");
    setOrigen("tarjeta");
    setFecha(hoyISOEnMexico());
    setErrorForm(null);
    setModalAbierto(true);
  }

  async function manejarEnvioTransferencia(e: React.FormEvent) {
    e.preventDefault();
    const monto = Number.parseFloat(montoTexto.replace(",", "."));
    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorForm("Ingresa un monto válido mayor a 0.");
      return;
    }

    setIsSaving(true);
    setErrorForm(null);
    try {
      await crearTransferencia({ monto, origen, destino, descripcion: descripcion.trim() || null, fecha });
      setModalAbierto(false);
      onTransferenciaRealizada?.({
        texto: `¡Traspaso de ${formatearMonto(monto)} de ${NOMBRE_METODO[origen]} a ${NOMBRE_METODO[destino]} registrado! ⇄`,
        tipo: "success",
      });
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "Error al registrar el traspaso.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
    <section className="pt-3">
      <SpotlightCard
        spotlightColor={saldoPositivo ? "rgba(16, 185, 129, 0.2)" : "rgba(244, 63, 94, 0.2)"}
        className="relative overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#090d16] border border-white/10 p-4 sm:p-6 rounded-3xl"
      >
        {/* Glow tenue de fondo */}
        <div
          className={`absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl opacity-25 pointer-events-none ${
            saldoPositivo ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />

        {/* Encabezado del Balance */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block leading-none">
                Saldo Total Disponible
              </span>
              <span className="text-[9px] text-slate-400 font-medium">
                (Acumulado histórico + Flujo del mes)
              </span>
            </div>
          </div>

          {/* Badge de Tasa de Ahorro */}
          <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-semibold text-emerald-400 backdrop-blur-md shrink-0">
            <PiggyBank className="h-3.5 w-3.5" />
            <span>{tasaAhorro}% ahorrado</span>
          </div>
        </div>

        {/* Monto principal: Saldo Total Disponible Acumulado */}
        <div className="mt-3 flex items-baseline gap-2">
          <div
            className={`text-3xl sm:text-5xl font-black tracking-tight tabular-nums ${
              saldoPositivo ? "text-slate-100" : "text-rose-400"
            }`}
          >
            <AnimatedNumber value={actual.saldoTotalDisponible} />
          </div>
        </div>

        {/* Linea de Arrastre de Meses Anteriores */}
        {actual.saldoInicial !== 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-300">
            <History className="h-3.5 w-3.5 text-indigo-400" />
            <span>Arrastre meses anteriores: <strong>{formatearMonto(actual.saldoInicial)}</strong></span>
          </div>
        )}

        {/* Grid de Egresos e Ingresos del Mes */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 pt-3 border-t border-white/10">
          {/* Egresos */}
          <div className="rounded-2xl border border-rose-500/20 bg-rose-950/30 p-2.5 sm:p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-rose-400">
              <ArrowDownRight className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="truncate">Egresos del Mes</span>
            </div>
            <p className="mt-1 text-base sm:text-xl font-bold tabular-nums text-slate-100 truncate">
              <AnimatedNumber value={actual.egresos} />
            </p>
          </div>

          {/* Ingresos */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/30 p-2.5 sm:p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-emerald-400">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">Ingresos del Mes</span>
            </div>
            <p className="mt-1 text-base sm:text-xl font-bold tabular-nums text-slate-100 truncate">
              <AnimatedNumber value={actual.ingresos} />
            </p>
          </div>
        </div>

        {/* Desglose por Método de Pago: Efectivo vs Tarjeta / Banco (saldo acumulado real) */}
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Saldo por método de pago
            </span>
            <button
              type="button"
              onClick={abrirModalTransferencia}
              className="flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 transition-colors"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Transferir
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-white/5">
              <span className="flex items-center gap-1.5 text-slate-400 font-medium truncate">
                <Banknote className="h-3.5 w-3.5 text-amber-400 shrink-0" /> Efectivo:
              </span>
              <span className="font-bold tabular-nums text-slate-200">
                {formatearMonto(actual.totalesEfectivo.saldo)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-white/5">
              <span className="flex items-center gap-1.5 text-slate-400 font-medium truncate">
                <CreditCard className="h-3.5 w-3.5 text-cyan-400 shrink-0" /> Tarjeta/Banco:
              </span>
              <span className="font-bold tabular-nums text-slate-200">
                {formatearMonto(actual.totalesTarjeta.saldo)}
              </span>
            </div>
          </div>
        </div>

        {/* Referencia del mes anterior */}
        {anterior.balance !== 0 && (
          <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Mes anterior ({anterior.nombreMes}):</span>
            <span className="font-semibold tabular-nums text-slate-300">
              {formatearMonto(anterior.balance)}
            </span>
          </div>
        )}
      </SpotlightCard>
    </section>

    {/* Modal de Traspaso entre métodos de pago */}
    {modalAbierto && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalAbierto(false);
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-traspaso"
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 id="titulo-traspaso" className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-indigo-400" />
              Traspasar entre cuentas
            </h3>
            <button
              type="button"
              onClick={() => setModalAbierto(false)}
              aria-label="Cerrar"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={manejarEnvioTransferencia} className="mt-4 space-y-3.5">
            {/* Origen -> Destino */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Desde</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrigen("tarjeta")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border transition-all text-xs font-semibold ${
                    origen === "tarjeta"
                      ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                      : "bg-slate-950/60 border-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <CreditCard className="h-4 w-4 text-cyan-400" />
                  Tarjeta
                </button>
                <button
                  type="button"
                  onClick={() => setOrigen("efectivo")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border transition-all text-xs font-semibold ${
                    origen === "efectivo"
                      ? "bg-amber-600/20 border-amber-500 text-amber-300"
                      : "bg-slate-950/60 border-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <Banknote className="h-4 w-4 text-amber-400" />
                  Efectivo
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Disponible en {NOMBRE_METODO[origen]}:{" "}
                <span className="font-semibold text-slate-300">
                  {formatearMonto(origen === "efectivo" ? actual.totalesEfectivo.saldo : actual.totalesTarjeta.saldo)}
                </span>
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span>{NOMBRE_METODO[origen]}</span>
              <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-400" />
              <span>{NOMBRE_METODO[destino]}</span>
            </div>

            {/* Monto */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Monto a traspasar</label>
              <div className="relative flex items-center rounded-2xl bg-slate-950/80 border border-white/10 px-4 py-2.5 focus-within:border-indigo-400/60">
                <span className="text-lg font-bold text-slate-400 mr-2">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={montoTexto}
                  onChange={(e) => setMontoTexto(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent text-xl font-bold text-slate-100 placeholder:text-slate-700 focus:outline-none tabular-nums"
                />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Descripción (opcional)</label>
              <input
                type="text"
                placeholder="Ej. Retiro de cajero, Depósito..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400/60 focus:outline-none"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 focus:border-indigo-400/60 focus:outline-none"
              />
            </div>

            {errorForm && (
              <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
                {errorForm}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <GlowButton type="button" variant="secondary" onClick={() => setModalAbierto(false)}>
                Cancelar
              </GlowButton>
              <GlowButton type="submit" variant="primary" disabled={isSaving} className="flex-1">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                Traspasar
              </GlowButton>
            </div>

            {actual.transferencias.length > 0 && (
              <div className="pt-3 border-t border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Traspasos este mes
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                  {actual.transferencias.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-950/50 border border-white/5"
                    >
                      <span className="text-slate-400">
                        {formatearFechaCorta(t.fecha)} · {NOMBRE_METODO[t.origen]} → {NOMBRE_METODO[t.destino]}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-200">
                        {formatearMonto(t.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    )}
    </>
  );
}
