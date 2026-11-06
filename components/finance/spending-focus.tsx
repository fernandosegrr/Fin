"use client";

import { useState, type CSSProperties } from "react";
import { ArrowDown, Heart, UserRound, X } from "lucide-react";
import { formatearMonto } from "@/lib/format";
import { formatearFechaCorta } from "@/lib/dates";
import { NOMBRES_DESTINO, type DestinoGasto } from "@/lib/finance/spending";
import type { ResumenFinanciero } from "@/lib/finance/types";

export function SpendingFocus({ resumen, nombreMes }: { resumen: NonNullable<ResumenFinanciero["gastosDestino"]>; nombreMes: string }) {
  const [periodo, setPeriodo] = useState<"mes" | "historico">("mes");
  const [detalle, setDetalle] = useState<DestinoGasto | null>(null);
  const [limite, setLimite] = useState(8);
  const grupos = resumen[periodo];
  function elegir(d: DestinoGasto) { setDetalle(detalle === d ? null : d); setLimite(8); }
  return <section className="finance-card spending-focus" aria-labelledby="gastos-destino-titulo">
    <div className="section-toolbar">
      <div><h2 id="gastos-destino-titulo">¿En quién gasto?</h2><p>{periodo === "mes" ? nombreMes : `Historial hasta ${nombreMes}`}</p></div>
      <div className="segmented-control" aria-label="Periodo de gastos">
        <button type="button" aria-pressed={periodo === "mes"} onClick={() => { setPeriodo("mes"); setDetalle(null); }}>Este mes</button>
        <button type="button" aria-pressed={periodo === "historico"} onClick={() => { setPeriodo("historico"); setDetalle(null); }}>Histórico</button>
      </div>
    </div>
    <div className={`spending-primary${[grupos.pareja.total, grupos.personal.total].some(total => formatearMonto(total).length > 10) ? " has-large-amount" : ""}`}>
      {(["pareja", "personal"] as const).map(d => {
        const Icon = d === "pareja" ? Heart : UserRound;
        return <button type="button" key={d} className={`spending-tile spending-tile--${d}`} aria-expanded={detalle === d} onClick={() => elegir(d)}>
          <span className="spending-label"><Icon size={18} />{NOMBRES_DESTINO[d]}</span>
          <strong style={{ "--amount-length": formatearMonto(grupos[d].total).length } as CSSProperties}>{formatearMonto(grupos[d].total)}</strong>
          <span className="spending-caption">{grupos[d].cantidad} gastos <ArrowDown size={14} /></span>
        </button>;
      })}
    </div>
    {(grupos.otros.cantidad > 0 || grupos.sin_clasificar.cantidad > 0) && <div className="spending-secondary">
      {(["otros", "sin_clasificar"] as const).filter(d => grupos[d].cantidad > 0).map(d => <button key={d} type="button" aria-expanded={detalle === d} onClick={() => elegir(d)}><span>{NOMBRES_DESTINO[d]}</span><strong>{formatearMonto(grupos[d].total)}</strong><ArrowDown size={14} /></button>)}
    </div>}
    <p className="spending-note">Lo que pagaste de tu dinero, sin dividirlo entre dos. Ahorro, deudas y ajustes van aparte.</p>
    {detalle && <div className="spending-detail">
      <div className="flex items-center justify-between gap-3"><h3>{NOMBRES_DESTINO[detalle]} · {grupos[detalle].cantidad} gastos</h3><button type="button" className="icon-button" onClick={() => setDetalle(null)} aria-label="Cerrar detalle de gastos"><X size={18} /></button></div>
      {grupos[detalle].cantidad === 0 ? <p className="py-4 text-sm text-[#5E7165]">No hay gastos en este grupo para el periodo elegido.</p> : <ul>{grupos[detalle].movimientos.slice(0, limite).map(m => <li key={m.id}><div><p>{m.concepto}</p><span>{formatearFechaCorta(m.fecha)} · {m.categoria}</span></div><strong>{formatearMonto(m.monto)}</strong></li>)}</ul>}
      {grupos[detalle].cantidad > limite && <button type="button" className="finance-action w-full mt-3" onClick={() => setLimite(n => n + 20)}>Ver más gastos</button>}
    </div>}
  </section>;
}
