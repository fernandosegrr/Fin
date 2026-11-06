import { aNumero, redondearMonto } from "@/lib/format";
import type { EgresoPorCategoria, IngresoPorCliente, GrupoCategoria, MetodoPago, TipoCategoria } from "@/lib/types";
import { naturalezaDe, signoMovimiento } from "@/lib/finance/ledger";
import type { NaturalezaMovimiento } from "@/lib/finance/types";

/** Fila mínima para agregar totales: es lo que seleccionan las consultas SIN límite de filas. */
export type FilaParaTotales = {
  monto: number;
  metodo_pago?: MetodoPago;
  gasto_recurrente_id?: string | null;
  cliente_id?: string | null;
  categoria: { id: string; nombre: string; tipo: TipoCategoria; grupo: GrupoCategoria | null } | null;
  cliente?: { id: string; nombre: string } | null;
  naturaleza?: NaturalezaMovimiento | null;
  eliminado_en?: string | null;
};

export type TotalesCalculados = {
  ingresos: number;
  egresos: number;
  efectivo: { ingresos: number; egresos: number; neto: number };
  tarjeta: { ingresos: number; egresos: number; neto: number };
  egresosFijos: number;
  egresosVariables: number;
  egresosPorCategoria: EgresoPorCategoria[];
  ingresosPorCliente: IngresoPorCliente[];
  recurrentesCobrados: string[];
};

/**
 * Agrega TODO lo que la UI necesita del mes en una sola pasada sobre las filas
 * sin límite. Categorías, fijo/variable y recurrentes se agregan antes de
 * paginar la presentación, para que todas las vistas compartan los totales.
 */
export function calcularTotalesDetallados(filas: FilaParaTotales[]): TotalesCalculados {
  let ingresos = 0;
  let egresos = 0;
  let egresosFijos = 0;
  let egresosVariables = 0;

  const efectivo = { ingresos: 0, egresos: 0, neto: 0 };
  const tarjeta = { ingresos: 0, egresos: 0, neto: 0 };
  const porCategoria = new Map<string, EgresoPorCategoria>();
  const porCliente = new Map<string, IngresoPorCliente>();
  const recurrentesCobrados = new Set<string>();

  for (const fila of filas) {
    if (fila.eliminado_en) continue;
    if (fila.gasto_recurrente_id) recurrentesCobrados.add(fila.gasto_recurrente_id);

    const monto = aNumero(fila.monto);
    const esEfectivo = fila.metodo_pago === "efectivo";
    const naturaleza = naturalezaDe(fila);
    const esIngreso = ["ingreso", "apoyo", "rendimiento"].includes(naturaleza);
    const esGasto = naturaleza === "egreso" || naturaleza === "reembolso";
    const montoCategoria = naturaleza === "reembolso" ? -monto : monto;
    if (esIngreso) {
      ingresos += monto;
      if (esEfectivo) efectivo.ingresos += monto;
      else tarjeta.ingresos += monto;

      if (naturaleza !== "ingreso") continue;
      const clienteId = fila.cliente_id ?? fila.cliente?.id ?? "";
      const nombreCliente = fila.cliente?.nombre?.trim() || "Sin cliente";
      const claveCliente = clienteId || "__sin__";
      const acumCliente = porCliente.get(claveCliente);
      if (acumCliente) acumCliente.monto += monto;
      else porCliente.set(claveCliente, { cliente_id: clienteId || null, nombre: nombreCliente, monto });
    } else if (esGasto && fila.categoria) {
      egresos += montoCategoria;
      if (esEfectivo) efectivo.egresos += montoCategoria;
      else tarjeta.egresos += montoCategoria;
      // La distribución de consumo describe compras; el reembolso se muestra aparte.
      if (naturaleza === "reembolso") continue;

      if (fila.gasto_recurrente_id || fila.categoria.grupo === "fijo") egresosFijos += montoCategoria;
      else if (fila.categoria.grupo === "variable") egresosVariables += montoCategoria;

      const acumulado = porCategoria.get(fila.categoria.id);
      if (acumulado) acumulado.monto += montoCategoria;
      else porCategoria.set(fila.categoria.id, {
        categoria_id: fila.categoria.id,
        nombre: fila.categoria.nombre,
        monto: montoCategoria,
      });
    } else if (naturaleza !== "traspaso") {
      // El flujo físico se refleja en cuentas; no se presenta como ingreso ganado o consumo.
      const delta = signoMovimiento(fila) * monto;
      if (esEfectivo) efectivo.neto += delta;
      else tarjeta.neto += delta;
    }
  }

  efectivo.neto += efectivo.ingresos - efectivo.egresos;
  tarjeta.neto += tarjeta.ingresos - tarjeta.egresos;

  return {
    ingresos: redondearMonto(ingresos),
    egresos: redondearMonto(egresos),
    efectivo: {
      ingresos: redondearMonto(efectivo.ingresos),
      egresos: redondearMonto(efectivo.egresos),
      neto: redondearMonto(efectivo.neto),
    },
    tarjeta: {
      ingresos: redondearMonto(tarjeta.ingresos),
      egresos: redondearMonto(tarjeta.egresos),
      neto: redondearMonto(tarjeta.neto),
    },
    egresosFijos: redondearMonto(egresosFijos),
    egresosVariables: redondearMonto(egresosVariables),
    egresosPorCategoria: [...porCategoria.values()]
      .map((e) => ({ ...e, monto: redondearMonto(e.monto) }))
      .sort((a, b) => b.monto - a.monto),
    ingresosPorCliente: [...porCliente.values()]
      .map((c) => ({ ...c, monto: redondearMonto(c.monto) }))
      .sort((a, b) => b.monto - a.monto),
    recurrentesCobrados: [...recurrentesCobrados],
  };
}

/**
 * Aplica traspasos entre métodos de pago al `neto` por método, in place.
 * Un traspaso NO es ingreso ni egreso (no toca `ingresos`/`egresos` totales):
 * solo mueve saldo de un método al otro, así que su efecto neto combinado
 * (efectivo.neto + tarjeta.neto) siempre es cero.
 */
export function aplicarTransferencias(
  totales: TotalesCalculados,
  transferencias: { monto: number; origen: MetodoPago; destino: MetodoPago }[],
): void {
  for (const t of transferencias) {
    const monto = aNumero(t.monto);
    if (t.origen === "efectivo") totales.efectivo.neto -= monto;
    else totales.tarjeta.neto -= monto;

    if (t.destino === "efectivo") totales.efectivo.neto += monto;
    else totales.tarjeta.neto += monto;
  }
  totales.efectivo.neto = redondearMonto(totales.efectivo.neto);
  totales.tarjeta.neto = redondearMonto(totales.tarjeta.neto);
}
