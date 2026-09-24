"use client";

import { type ReactNode } from "react";
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
  Trash2,
  Scale,
} from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { AnimatedNumber } from "@/components/react-bits/AnimatedNumber";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { formatearMonto } from "@/lib/format";
import { formatearFechaCorta } from "@/lib/dates";
import { type BalanceMensual } from "@/app/dashboard/actions";
import type { DesgloseMetodoPago } from "@/lib/types";
import { NOMBRE_METODO, useBalanceActions } from "./balance/use-balance-actions";

interface Props {
  actual: BalanceMensual["actual"];
  onTransferenciaRealizada?: (mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => void;
}


function DesgloseMetodo({
  icono,
  etiqueta,
  desglose,
}: {
  icono: ReactNode;
  etiqueta: string;
  desglose: DesgloseMetodoPago;
}) {
  const arrastre = desglose.saldo - desglose.neto;
  const netoMes = desglose.neto;
  return (
    <div className="p-2 rounded-xl bg-[#F7F9F5] border border-[#DCE4DB] space-y-1">
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1.5 text-[#5E7165] font-medium truncate">
          {icono} {etiqueta}:
        </span>
        <span className="font-bold tabular-nums text-[#263D33]">{formatearMonto(desglose.saldo)}</span>
      </div>
      <p className="text-[10px] text-[#7A897D] leading-tight">
        Arrastre {formatearMonto(arrastre)}
        {" · "}
        <span className={desglose.saldo < 0 ? "text-[#AA524A]/80" : "text-[#5E7165]"}>
          {netoMes > 0 ? `Subió ${formatearMonto(netoMes)} este mes` :
            netoMes < 0 ? `Bajó ${formatearMonto(Math.abs(netoMes))} este mes` : "Sin cambio este mes"}
        </span>
      </p>
    </div>
  );
}

export function BalanceResumen({ actual, onTransferenciaRealizada }: Props) {
  const {
    saldoPositivo, porcentajeDisponible, modalAbierto, setModalAbierto, montoTexto, setMontoTexto,
    origen, setOrigen, descripcion, setDescripcion, fecha, setFecha, isSaving, eliminandoId,
    errorForm, transferenciaEditandoId, modalAjuste, setModalAjuste, ajusteMetodo, setAjusteMetodo,
    ajusteMonto, setAjusteMonto, ajusteError, ajusteSaving, destino, esMesEnCurso,
    abrirModalAjuste, manejarAjuste, abrirModalTransferencia, abrirEdicionTransferencia,
    cancelarEdicionTransferencia, manejarEnvioTransferencia, manejarEliminarTransferencia,
  } = useBalanceActions({ actual, onTransferenciaRealizada });

  return (
    <>
    <section className="pt-2">
      <SpotlightCard
        spotlightColor={saldoPositivo ? "rgba(16, 244, 177, 0.15)" : "rgba(244, 63, 94, 0.15)"}
        className="relative overflow-hidden bg-white border border-[#DCE4DB] p-5 sm:p-7 rounded-3xl shadow-xl shadow-black/5"
      >
        {/* Encabezado del Balance */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-[#286F50] shrink-0 shadow-sm shadow-emerald-500/10">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-semibold leading-tight text-[#1C3028]">
                Saldo disponible
              </span>
              <span className="text-xs text-[#5E7165]">
                Total acumulado hasta este mes
              </span>
            </div>
          </div>

          {/* Porcentaje de fondos que permanece disponible */}
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-[#286F50] backdrop-blur-md shrink-0 shadow-sm shadow-emerald-500/10">
            <PiggyBank className="h-3.5 w-3.5" />
            <span>{porcentajeDisponible}% disponible</span>
          </div>
        </div>

        {/* Monto principal: Saldo Total Disponible Acumulado */}
        <div className="mt-4 flex items-baseline gap-2">
          <div
            className={`text-4xl sm:text-5xl font-bold tracking-tight tabular-nums ${
              saldoPositivo ? "text-[#1C3028]" : "text-[#AA524A]"
            }`}
          >
            <AnimatedNumber value={actual.saldoTotalDisponible} />
          </div>
        </div>

        {/* Linea de Arrastre de Meses Anteriores */}
        {actual.saldoInicial !== 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-[#62688B]">
            <History className="h-3.5 w-3.5 text-[#62688B]" />
            <span>Arrastre meses anteriores: <strong>{formatearMonto(actual.saldoInicial)}</strong></span>
          </div>
        )}

        {/* Grid de Egresos e Ingresos del Mes */}
        <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-[#DCE4DB]">
          {/* Egresos */}
          <div className="rounded-2xl border border-rose-500/20 bg-[#FCF0ED] p-3 sm:p-4 backdrop-blur-sm transition-all hover:border-rose-500/35">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#AA524A]">
              <ArrowDownRight className="h-4 w-4 text-rose-500 shrink-0" />
              <span className="truncate">Egresos del Mes</span>
            </div>
            <p className="mt-1.5 text-lg sm:text-2xl font-black tabular-nums text-[#1C3028] truncate">
              <AnimatedNumber value={actual.egresos} />
            </p>
          </div>

          {/* Ingresos */}
          <div className="rounded-2xl border border-emerald-500/20 bg-[#EDF5EF] p-3 sm:p-4 backdrop-blur-sm transition-all hover:border-emerald-500/35">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#286F50]">
              <ArrowUpRight className="h-4 w-4 text-[#286F50] shrink-0" />
              <span className="truncate">Ingresos del Mes</span>
            </div>
            <p className="mt-1.5 text-lg sm:text-2xl font-black tabular-nums text-[#1C3028] truncate">
              <AnimatedNumber value={actual.ingresos} />
            </p>
          </div>
        </div>

        {/* Desglose por Método de Pago: Efectivo vs Tarjeta / Banco */}
        <div className="mt-4 pt-4 border-t border-[#DCE4DB]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#5E7165]">
              Saldo por método de pago
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={abrirModalAjuste}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-[#A66E31] hover:bg-amber-500/20 hover:text-[#1C3028] transition-all shadow-sm"
              >
                <Scale className="h-3 w-3" /> Ajustar
              </button>
              <button
                type="button"
                onClick={abrirModalTransferencia}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-bold text-[#62688B] hover:bg-indigo-500/20 hover:text-[#1C3028] transition-all shadow-sm"
              >
                <ArrowRightLeft className="h-3 w-3" /> Transferir
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-[11px]">
            <DesgloseMetodo
              icono={<Banknote className="h-3.5 w-3.5 text-[#A66E31] shrink-0" />}
              etiqueta="Efectivo"
              desglose={actual.totalesEfectivo}
            />
            <DesgloseMetodo
              icono={<CreditCard className="h-3.5 w-3.5 text-[#317D7D] shrink-0" />}
              etiqueta="Tarjeta/Banco"
              desglose={actual.totalesTarjeta}
            />
          </div>
        </div>

      </SpotlightCard>
    </section>

    {/* Modal de Traspaso entre métodos de pago */}
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
          aria-labelledby="titulo-traspaso"
          className="w-full max-w-sm rounded-3xl border border-[#DCE4DB] bg-white p-6 shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE4DB]">
            <h3 id="titulo-traspaso" className="text-sm font-bold text-[#1C3028] flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-[#62688B]" />
              {transferenciaEditandoId ? "Editar traspaso" : "Traspasar entre cuentas"}
            </h3>
            <button
              type="button"
              onClick={() => setModalAbierto(false)}
              aria-label="Cerrar"
              className="rounded-full p-1.5 text-[#5E7165] hover:bg-[#E8EEE7] hover:text-[#1C3028]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={manejarEnvioTransferencia} className="mt-4 space-y-3.5">
            {transferenciaEditandoId && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-[11px] text-[#62688B]">
                <span>Corrigiendo un traspaso existente.</span>
                <button
                  type="button"
                  onClick={cancelarEdicionTransferencia}
                  className="font-semibold underline underline-offset-2 hover:text-indigo-200 shrink-0"
                >
                  Cancelar edición
                </button>
              </div>
            )}

            {/* Origen -> Destino */}
            <div>
              <span className="block text-xs font-medium text-[#5E7165] mb-1">Desde</span>
              <div role="group" aria-label="Cuenta de origen" className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={origen === "tarjeta"}
                  onClick={() => setOrigen("tarjeta")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border transition-all text-xs font-semibold ${
                    origen === "tarjeta"
                      ? "bg-indigo-600/20 border-indigo-500 text-[#62688B]"
                      : "bg-[#F7F9F5] border-[#DCE4DB] text-[#5E7165] hover:text-[#1C3028]"
                  }`}
                >
                  <CreditCard className="h-4 w-4 text-[#317D7D]" />
                  Tarjeta
                </button>
                <button
                  type="button"
                  aria-pressed={origen === "efectivo"}
                  onClick={() => setOrigen("efectivo")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border transition-all text-xs font-semibold ${
                    origen === "efectivo"
                      ? "bg-amber-600/20 border-amber-500 text-[#A66E31]"
                      : "bg-[#F7F9F5] border-[#DCE4DB] text-[#5E7165] hover:text-[#1C3028]"
                  }`}
                >
                  <Banknote className="h-4 w-4 text-[#A66E31]" />
                  Efectivo
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-[#7A897D]">
                Disponible en {NOMBRE_METODO[origen]}:{" "}
                <span className="font-semibold text-[#475C50]">
                  {formatearMonto(origen === "efectivo" ? actual.totalesEfectivo.saldo : actual.totalesTarjeta.saldo)}
                </span>
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-[#7A897D] uppercase tracking-wider">
              <span>{NOMBRE_METODO[origen]}</span>
              <ArrowRightLeft className="h-3.5 w-3.5 text-[#62688B]" />
              <span>{NOMBRE_METODO[destino]}</span>
            </div>

            {/* Monto */}
            <div>
              <label htmlFor="traspaso-monto" className="block text-xs font-medium text-[#5E7165] mb-1">Monto a traspasar</label>
              <div className="relative flex items-center rounded-2xl bg-[#F7F9F5] border border-[#DCE4DB] px-4 py-2.5 focus-within:border-indigo-400/60">
                <span className="text-lg font-bold text-[#5E7165] mr-2">$</span>
                <input
                  id="traspaso-monto"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={montoTexto}
                  onChange={(e) => setMontoTexto(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent text-xl font-bold text-[#1C3028] placeholder:text-[#9CA99F] focus:outline-none tabular-nums"
                />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label htmlFor="traspaso-descripcion" className="block text-xs font-medium text-[#5E7165] mb-1">Descripción (opcional)</label>
              <input
                id="traspaso-descripcion"
                type="text"
                placeholder="Ej. Retiro de cajero, Depósito..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full rounded-2xl border border-[#DCE4DB] bg-[#F7F9F5] px-4 py-2.5 text-sm text-[#1C3028] placeholder:text-[#96A399] focus:border-indigo-400/60 focus:outline-none"
              />
            </div>

            {/* Fecha */}
            <div>
              <label htmlFor="traspaso-fecha" className="block text-xs font-medium text-[#5E7165] mb-1">Fecha</label>
              <input
                id="traspaso-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-2xl border border-[#DCE4DB] bg-[#F7F9F5] px-4 py-2.5 text-sm text-[#1C3028] focus:border-indigo-400/60 focus:outline-none"
              />
            </div>

            {errorForm && (
              <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-[#AA524A]">
                {errorForm}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <GlowButton type="button" variant="secondary" onClick={() => setModalAbierto(false)}>
                Cancelar
              </GlowButton>
              <GlowButton type="submit" variant="primary" disabled={isSaving} className="flex-1">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                {transferenciaEditandoId ? "Guardar cambios" : "Traspasar"}
              </GlowButton>
            </div>

            {actual.transferencias.length > 0 && (
              <div className="pt-3 border-t border-[#DCE4DB]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7A897D] mb-1.5">
                  Traspasos este mes · toca uno para corregirlo
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                  {actual.transferencias.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => abrirEdicionTransferencia(t)}
                      title="Editar traspaso"
                      className={`flex w-full items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors text-left ${
                        transferenciaEditandoId === t.id
                          ? "bg-indigo-600/10 border-indigo-500/50"
                          : "bg-[#F7F9F5] border-[#DCE4DB] hover:border-[#CBD6CA]"
                      }`}
                    >
                      <span className="text-[#5E7165] min-w-0 truncate">
                        {formatearFechaCorta(t.fecha)} · {NOMBRE_METODO[t.origen]} → {NOMBRE_METODO[t.destino]}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="font-semibold tabular-nums text-[#263D33]">
                          {formatearMonto(t.monto)}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            manejarEliminarTransferencia(t.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.stopPropagation();
                            e.preventDefault();
                            manejarEliminarTransferencia(t.id);
                          }}
                          aria-label="Eliminar traspaso"
                          aria-disabled={eliminandoId === t.id}
                          className="p-0.5 text-[#7A897D] hover:text-[#AA524A] aria-disabled:opacity-50"
                        >
                          {eliminandoId === t.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    )}

    {modalAjuste && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14251D]/45 backdrop-blur-md"
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalAjuste(false);
        }}
      >
        <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-3xl border border-[#DCE4DB] bg-white p-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE4DB]">
            <h3 className="text-sm font-bold text-[#1C3028] flex items-center gap-2">
              <Scale className="h-4 w-4 text-[#A66E31]" /> Ajustar saldo
            </h3>
            <button type="button" onClick={() => setModalAjuste(false)} aria-label="Cerrar" className="p-1.5 text-[#5E7165] hover:text-[#1C3028]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={manejarAjuste} className="mt-4 space-y-3.5">
            <p className="text-[11px] text-[#5E7165]">
              Pon lo que tienes de verdad hoy. Se crea un ajuste (ingreso o egreso) para cuadrar, sin borrar el historial.
            </p>
            <div role="group" aria-label="Cuenta para ajustar" className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={ajusteMetodo === "efectivo"}
                onClick={() => {
                  setAjusteMetodo("efectivo");
                  if (esMesEnCurso) setAjusteMonto(String(actual.totalesEfectivo.saldo));
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border text-xs font-semibold ${
                  ajusteMetodo === "efectivo"
                    ? "bg-amber-600/20 border-amber-500 text-[#A66E31]"
                    : "bg-[#F7F9F5] border-[#DCE4DB] text-[#5E7165]"
                }`}
              >
                <Banknote className="h-4 w-4" /> Efectivo
              </button>
              <button
                type="button"
                aria-pressed={ajusteMetodo === "tarjeta"}
                onClick={() => {
                  setAjusteMetodo("tarjeta");
                  if (esMesEnCurso) setAjusteMonto(String(actual.totalesTarjeta.saldo));
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border text-xs font-semibold ${
                  ajusteMetodo === "tarjeta"
                    ? "bg-cyan-600/20 border-cyan-500 text-[#317D7D]"
                    : "bg-[#F7F9F5] border-[#DCE4DB] text-[#5E7165]"
                }`}
              >
                <CreditCard className="h-4 w-4" /> Tarjeta
              </button>
            </div>
            <div>
              <label htmlFor="ajuste-saldo" className="block text-xs font-medium text-[#5E7165] mb-1">Saldo real</label>
              <div className="relative flex items-center rounded-2xl bg-[#F7F9F5] border border-[#DCE4DB] px-4 py-2.5 focus-within:border-amber-400/60">
                <span className="text-lg font-bold text-[#5E7165] mr-2">$</span>
                <input
                  id="ajuste-saldo"
                  type="text"
                  inputMode="decimal"
                  value={ajusteMonto}
                  onChange={(e) => setAjusteMonto(e.target.value)}
                  placeholder="3000"
                  className="w-full bg-transparent text-xl font-bold text-[#1C3028] focus:outline-none tabular-nums"
                />
              </div>
            </div>
            {ajusteError && (
              <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-[#AA524A]">{ajusteError}</p>
            )}
            <GlowButton type="submit" variant="primary" disabled={ajusteSaving} className="w-full">
              {ajusteSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
              Cuadrar saldo
            </GlowButton>
          </form>
        </div>
      </div>
    )}
    </>
  );
}
