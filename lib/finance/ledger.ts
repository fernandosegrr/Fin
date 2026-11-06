import { aNumero } from "@/lib/format";
import type { CuentaConSaldo, CuentaFinanciera, FilaFinanciera, NaturalezaMovimiento, ResumenFinanciero, TraspasoFinanciero } from "./types";
import { resumirGastosPorDestino } from "./spending";

export function centavos(valor: unknown): number {
  const n = aNumero(valor);
  const c = Math.round((Math.abs(n) + Number.EPSILON) * 100) * Math.sign(n);
  if (!Number.isSafeInteger(c)) throw new Error("El importe supera el límite admitido.");
  return c;
}

export function naturalezaDe(t: Pick<FilaFinanciera, "naturaleza" | "categoria">): NaturalezaMovimiento {
  return t.naturaleza ?? (t.categoria?.tipo === "ingreso" ? "ingreso" : "egreso");
}

export function signoMovimiento(t: Pick<FilaFinanciera, "naturaleza" | "categoria">): 1 | -1 {
  return ["ingreso", "apoyo", "rendimiento", "reembolso", "financiacion", "ajuste_entrada", "ingreso_pendiente"].includes(naturalezaDe(t)) ? 1 : -1;
}

export function esConsumo(t: Pick<FilaFinanciera, "naturaleza" | "categoria">): boolean {
  return naturalezaDe(t) === "egreso";
}

/** Todos los saldos se obtienen del mismo libro y con la misma fecha de corte. */
export function resumirLibro(
  cuentas: CuentaFinanciera[], transacciones: FilaFinanciera[], traspasos: TraspasoFinanciero[], inicio: string, finExclusivo: string,
): ResumenFinanciero {
  const saldos = new Map<string, number>();
  const iniciales = new Map<string, number>();
  const rendimientoPorCuenta = new Map<string, number>();
  const retencionPorCuenta = new Map<string, number>();
  const porId = new Map(cuentas.map(c => [c.id, c]));
  const defecto = (metodo?: string) => cuentas.find(c => c.codigo === (metodo === "efectivo" ? "efectivo" : "principal"))?.id;
  const tot = { trabajo: 0, apoyos: 0, netos: 0, brutos: 0, impuestos: 0, consumo: 0, reembolsos: 0, financiacion: 0, pagos: 0, ajustes: 0, entradas: 0, salidas: 0, aportaciones: 0, retiros: 0 };
  const historico = { trabajo: 0, apoyos: 0, rendimientos: 0, entradas: 0 };
  const compras: FilaFinanciera[] = [];
  const prestamos = new Map<string, number>();
  const amortizaciones = new Map<string, number>();
  let pendientes = 0;
  let sinDesglose = 0, netoSinDesglose = 0;
  let desde: string | null = null;

  function mover(id: string | null | undefined, importe: number, fecha: string) {
    if (!id || !porId.has(id)) throw new Error("Hay un movimiento sin cuenta válida. No se puede mostrar un saldo fiable.");
    saldos.set(id, (saldos.get(id) ?? 0) + importe);
    if (fecha < inicio) iniciales.set(id, (iniciales.get(id) ?? 0) + importe);
  }
  function traslado(origen: string | null | undefined, destino: string | null | undefined, monto: number, fecha: string) {
    if (origen === destino) throw new Error("Un traspaso debe tener dos cuentas distintas.");
    mover(origen, -monto, fecha); mover(destino, monto, fecha);
    if (fecha >= inicio) {
      const a = porId.get(origen!); const b = porId.get(destino!);
      if (!a?.excluida_disponible && b?.excluida_disponible) tot.aportaciones += monto;
      if (a?.excluida_disponible && !b?.excluida_disponible) tot.retiros += monto;
    }
  }

  for (const t of transacciones) {
    if (t.eliminado_en || t.fecha >= finExclusivo) continue;
    desde = desde === null || t.fecha.localeCompare(desde) < 0 ? t.fecha : desde;
    const n = naturalezaDe(t); const monto = centavos(t.monto); const cuenta = t.cuenta_id ?? defecto(t.metodo_pago);
    if (t.requiere_revision) pendientes++;
    if (n === "traspaso") { traslado(cuenta, t.cuenta_destino_id, monto, t.fecha); continue; }
    const signo = signoMovimiento(t);
    mover(cuenta, monto * signo, t.fecha);
    if (signo > 0) historico.entradas += monto;
    if (n === "ingreso") historico.trabajo += monto;
    if (n === "apoyo") historico.apoyos += monto;
    if (n === "rendimiento") historico.rendimientos += monto;
    if (n === "financiacion" && (!t.deuda_liquidada_en || t.deuda_liquidada_en >= finExclusivo)) prestamos.set(t.id, monto);
    if (n === "pago_deuda" && t.movimiento_relacionado_id) amortizaciones.set(t.movimiento_relacionado_id, (amortizaciones.get(t.movimiento_relacionado_id) ?? 0) + monto);
    if (t.fecha < inicio) continue;
    if (n === "ingreso") tot.trabajo += monto;
    if (n === "apoyo") tot.apoyos += monto;
    if (n === "rendimiento") {
      const bruto = t.interes_bruto == null ? 0 : centavos(t.interes_bruto);
      if (t.interes_bruto == null || t.impuesto_retenido == null) { sinDesglose++; netoSinDesglose += monto; }
      const impuesto = t.impuesto_retenido == null ? 0 : centavos(t.impuesto_retenido);
      tot.netos += monto; tot.brutos += bruto; tot.impuestos += impuesto;
      rendimientoPorCuenta.set(cuenta!, (rendimientoPorCuenta.get(cuenta!) ?? 0) + monto);
      retencionPorCuenta.set(cuenta!, (retencionPorCuenta.get(cuenta!) ?? 0) + impuesto);
    }
    if (n === "retencion") { tot.impuestos += monto; retencionPorCuenta.set(cuenta!, (retencionPorCuenta.get(cuenta!) ?? 0) + monto); }
    if (n === "egreso") { tot.consumo += monto; compras.push(t); }
    if (n === "reembolso") tot.reembolsos += monto;
    if (n === "financiacion") tot.financiacion += monto;
    if (n === "pago_deuda") tot.pagos += monto;
    if (n === "ajuste_entrada" || n === "ajuste_salida") tot.ajustes += signo * monto;
    if (n === "ingreso_pendiente") tot.entradas += monto;
    if (n === "egreso_pendiente") tot.salidas += monto;
  }
  for (const t of traspasos) {
    if (t.eliminado_en || t.fecha >= finExclusivo) continue;
    traslado(t.cuenta_origen_id ?? defecto(t.origen), t.cuenta_destino_id ?? defecto(t.destino), centavos(t.monto), t.fecha);
  }
  const estados: CuentaConSaldo[] = cuentas.map(c => {
    const saldo = saldos.get(c.id) ?? 0; const inicial = iniciales.get(c.id) ?? 0;
    return { ...c, saldo: saldo / 100, saldoInicial: inicial / 100, variacion: (saldo - inicial) / 100, rendimientosMes: (rendimientoPorCuenta.get(c.id) ?? 0) / 100, retencionesMes: (retencionPorCuenta.get(c.id) ?? 0) / 100 };
  });
  const activos = [...saldos.values()].reduce((s, x) => s + x, 0);
  const ahorro = cuentas.filter(c => c.excluida_disponible).reduce((s, c) => s + (saldos.get(c.id) ?? 0), 0);
  const deuda = [...prestamos].reduce((s, [id, monto]) => s + Math.max(0, monto - (amortizaciones.get(id) ?? 0)), 0);
  const deudasPendientes = [...prestamos].map(([id, monto]) => { const t = transacciones.find(t => t.id === id)!; return { id, descripcion: t.descripcion || "Préstamo recibido", fecha: t.fecha, recibido: monto / 100, pendiente: Math.max(0, monto - (amortizaciones.get(id) || 0)) / 100 }; }).filter(d => d.pendiente > 0);
  return {
    gastosDestino: { mes: resumirGastosPorDestino(transacciones, inicio, finExclusivo), historico: resumirGastosPorDestino(transacciones, "2000-01-01", finExclusivo) },
    cuentas: estados, activos: activos / 100, disponible: (activos - ahorro) / 100, ahorro: ahorro / 100,
    deuda: Math.max(0, deuda) / 100, patrimonio: (activos - Math.max(0, deuda)) / 100,
    deudasPendientes,
    ingresosTrabajo: tot.trabajo / 100, apoyos: tot.apoyos / 100, rendimientosNetos: tot.netos / 100,
    rendimientosBrutos: tot.brutos / 100, retenciones: tot.impuestos / 100, consumo: tot.consumo / 100,
    rendimientosSinDesglose: { cantidad: sinDesglose, neto: netoSinDesglose / 100 },
    reembolsos: tot.reembolsos / 100, prestamosRecibidos: tot.financiacion / 100, pagosDeuda: tot.pagos / 100,
    ajustes: tot.ajustes / 100, entradasPorIdentificar: tot.entradas / 100, salidasPorIdentificar: tot.salidas / 100,
    aportacionesAhorro: tot.aportaciones / 100, retirosAhorro: tot.retiros / 100, pendientes,
    historicoIngresos: { trabajo: historico.trabajo / 100, apoyos: historico.apoyos / 100, rendimientos: historico.rendimientos / 100, total: (historico.trabajo + historico.apoyos + historico.rendimientos) / 100, entradas: historico.entradas / 100, desde },
    compras: { cantidad: compras.length, promedio: compras.length ? Math.round(tot.consumo / compras.length) / 100 : 0, mayores: [...compras].sort((a, b) => centavos(b.monto) - centavos(a.monto)).slice(0, 5) },
  };
}
