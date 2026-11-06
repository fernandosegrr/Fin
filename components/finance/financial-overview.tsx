"use client";

import { ArrowDownRight, ArrowUpRight, ArrowRight } from "lucide-react";
import { formatearMonto } from "@/lib/format";
import type { BalanceMensual } from "@/lib/dashboard/balance";

export function FinancialOverview({ actual, onVerCuentas }: { actual: BalanceMensual["actual"]; onVerCuentas?: () => void }) {
  const f = actual.finanzas!;
  return <section className="finance-card money-overview" aria-label="Tu dinero">
    <div className="money-balance">
      <h2>Disponible</h2>
      <p className={`money-amount ${f.disponible < 0 ? "text-[#AA524A]" : ""}`}>{formatearMonto(f.disponible)}</p>
      <p className="money-description">En tus cuentas de uso diario, sin incluir el ahorro.</p>
      <div className="money-savings">
        <div><span>Ahorro separado</span><strong>{formatearMonto(f.ahorro)}</strong></div>
        <div><span>Dinero total</span><strong>{formatearMonto(f.activos)}</strong><small>Disponible + ahorro</small></div>
      </div>
      {f.deuda > 0 && <p className="mt-3 text-sm text-[#795725]">Deuda pendiente: {formatearMonto(f.deuda)} · Te quedan {formatearMonto(f.patrimonio)} después de pagarla.</p>}
      {onVerCuentas && <button type="button" onClick={onVerCuentas} className="money-link">Ver mis cuentas <ArrowRight size={16} /></button>}
    </div>
    <div className="money-month">
      <div className="hidden sm:block"><p className="money-month-label">Este mes</p>
      <div className="money-flow"><span><ArrowUpRight size={18} />Ingresos</span><strong>{formatearMonto(actual.ingresos)}</strong></div>
      <div className="money-flow"><span><ArrowDownRight size={18} />Gastos</span><strong>{formatearMonto(f.consumo)}</strong></div>
      </div><details className="money-details"><summary>Ingresos y gastos del mes</summary><div className="sm:hidden"><div className="money-flow"><span>Ingresos</span><strong>{formatearMonto(actual.ingresos)}</strong></div><div className="money-flow"><span>Gastos</span><strong>{formatearMonto(f.consumo)}</strong></div></div><p className="money-description">El ahorro se mantiene separado de tus gastos.</p><dl>
        <div><dt>Trabajo</dt><dd>{formatearMonto(f.ingresosTrabajo)}</dd></div>
        <div><dt>Apoyos recibidos</dt><dd>{formatearMonto(f.apoyos)}</dd></div>
        <div><dt>Rendimientos netos</dt><dd>{formatearMonto(f.rendimientosNetos)}</dd></div>
        <div><dt>Aportado al ahorro</dt><dd>{formatearMonto(f.aportacionesAhorro)}</dd></div>
        <div><dt>Reembolsos</dt><dd>{formatearMonto(f.reembolsos)}</dd></div>
        {f.retenciones > 0 && <div><dt>Impuestos retenidos</dt><dd>{formatearMonto(f.retenciones)}</dd></div>}
        {f.pagosDeuda > 0 && <div><dt>Pagos de deuda</dt><dd>{formatearMonto(f.pagosDeuda)}</dd></div>}
        {f.salidasPorIdentificar > 0 && <div><dt>Salidas por aclarar</dt><dd>{formatearMonto(f.salidasPorIdentificar)}</dd></div>}
        {f.entradasPorIdentificar > 0 && <div><dt>Entradas por aclarar</dt><dd>{formatearMonto(f.entradasPorIdentificar)}</dd></div>}
      </dl></details>
    </div>
  </section>;
}
