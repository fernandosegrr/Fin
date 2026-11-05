"use client";

import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet, Landmark, ArrowRight } from "lucide-react";
import { formatearMonto } from "@/lib/format";
import type { BalanceMensual } from "@/lib/dashboard/balance";

export function FinancialOverview({ actual, onVerCuentas }: { actual: BalanceMensual["actual"]; onVerCuentas?: () => void }) {
  const f = actual.finanzas!;
  return <section className="finance-card p-5 sm:p-6" aria-label="Tu dinero y patrimonio">
    <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">TU DINERO</p><h3 className="mt-1 text-lg font-bold">Disponible para gastar</h3><p className="text-xs text-[#5E7165] mt-1">Saldo registrado; el ahorro está separado.</p></div><Wallet className="h-6 w-6 text-[#286F50]" /></div>
    <p className={`my-4 text-4xl sm:text-5xl font-bold tracking-tight tabular-nums ${f.disponible < 0 ? "text-[#AA524A]" : "text-[#1C3028]"}`}>{formatearMonto(f.disponible)}</p>
    <div className="grid grid-cols-2 gap-3 border-y border-[#DCE4DB] py-4">
      <div><p className="flex gap-1 items-center text-xs text-[#5E7165]"><PiggyBank size={14} /> Ahorro e inversión</p><p className="text-xl font-bold text-[#286F50] mt-1 tabular-nums">{formatearMonto(f.ahorro)}</p></div>
      <div><p className="flex gap-1 items-center text-xs text-[#5E7165]"><Landmark size={14} /> Patrimonio neto</p><p className="text-xl font-bold mt-1 tabular-nums">{formatearMonto(f.patrimonio)}</p>{f.deuda > 0 && <p className="text-xs text-[#A66E31]">Deuda registrada: {formatearMonto(f.deuda)}</p>}</div>
    </div>
    <div className="grid grid-cols-2 gap-3 mt-4">
      <div className="rounded-2xl bg-[#EDF5EF] p-3"><p className="text-xs font-semibold text-[#286F50] flex gap-1 items-center"><ArrowUpRight size={14} /> Ingresos del mes</p><p className="text-xl font-bold tabular-nums mt-1">{formatearMonto(actual.ingresos)}</p><p className="text-[11px] mt-1 text-[#5E7165]">Trabajo {formatearMonto(f.ingresosTrabajo)} · apoyos {formatearMonto(f.apoyos)} · rendimientos {formatearMonto(f.rendimientosNetos)}</p></div>
      <div className="rounded-2xl bg-[#FCF0ED] p-3"><p className="text-xs font-semibold text-[#AA524A] flex gap-1 items-center"><ArrowDownRight size={14} /> Consumo del mes</p><p className="text-xl font-bold tabular-nums mt-1">{formatearMonto(f.consumo)}</p><p className="text-[11px] mt-1 text-[#5E7165]">Reembolsos: {formatearMonto(f.reembolsos)} · ahorro y préstamos separados</p></div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#475C50]">
      <span className="rounded-lg border border-[#DCE4DB] bg-[#F7F9F5] px-2.5 py-1.5">Aportado al ahorro: <strong>{formatearMonto(f.aportacionesAhorro)}</strong></span>
      {f.retenciones > 0 && <span className="rounded-lg border border-[#DCE4DB] px-2.5 py-1.5">Retenciones: {formatearMonto(f.retenciones)}</span>}
      {(f.entradasPorIdentificar > 0 || f.salidasPorIdentificar > 0) && <span className="rounded-lg bg-[#FAF5E9] px-2.5 py-1.5 text-[#795725]">Por identificar: +{formatearMonto(f.entradasPorIdentificar)} / −{formatearMonto(f.salidasPorIdentificar)}</span>}
    </div>
    {onVerCuentas && <button type="button" onClick={onVerCuentas} className="mt-4 flex w-full items-center justify-between rounded-xl bg-[#F4F7F2] px-3 py-2.5 text-xs font-semibold text-[#286F50]">Ver cuentas, rendimientos y traspasos <ArrowRight size={15} /></button>}
  </section>;
}
