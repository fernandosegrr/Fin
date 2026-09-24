import { aNumero, redondearMonto } from "@/lib/format";
import type { EgresoPorCategoria, IngresoPorCliente, GrupoCategoria, MetodoPago, TipoCategoria } from "@/lib/types";

/** Fila mínima para agregar totales: es lo que seleccionan las consultas SIN límite de filas. */
export type FilaParaTotales = {
  monto: number;
  metodo_pago?: MetodoPago;
  gasto_recurrente_id?: string | null;
  cliente_id?: string | null;
  categoria: { id: string; nombre: string; tipo: TipoCategoria; grupo: GrupoCategoria | null } | null;
  cliente?: { id: string; nombre: string } | null;
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
 * sin límite. Los desgloses por categoría / fijo-variable / suscripciones
 * cobradas viven aquí y no en los componentes a propósito: en el cliente solo
 * está disponible la lista recortada a 200 filas, así que calcularlos allá
 * daba números que no cuadraban con los totales en meses con mucho movimiento.
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
    if (fila.gasto_recurrente_id) recurrentesCobrados.add(fila.gasto_recurrente_id);

    const monto = aNumero(fila.monto);
    const esEfectivo = fila.metodo_pago === "efectivo";
    if (fila.categoria?.tipo === "ingreso") {
      ingresos += monto;
      if (esEfectivo) efectivo.ingresos += monto;
      else tarjeta.ingresos += monto;

      const clienteId = fila.cliente_id ?? fila.cliente?.id ?? "";
      const nombreCliente = fila.cliente?.nombre?.trim() || "Sin cliente";
      const claveCliente = clienteId || "__sin__";
      const acumCliente = porCliente.get(claveCliente);
      if (acumCliente) acumCliente.monto += monto;
      else porCliente.set(claveCliente, { cliente_id: clienteId || null, nombre: nombreCliente, monto });
    } else if (fila.categoria?.tipo === "egreso") {
      egresos += monto;
      if (esEfectivo) efectivo.egresos += monto;
      else tarjeta.egresos += monto;

      if (fila.categoria.grupo === "fijo") egresosFijos += monto;
      else if (fila.categoria.grupo === "variable") egresosVariables += monto;

      const acumulado = porCategoria.get(fila.categoria.id);
      if (acumulado) acumulado.monto += monto;
      else porCategoria.set(fila.categoria.id, {
        categoria_id: fila.categoria.id,
        nombre: fila.categoria.nombre,
        monto,
      });
    }
  }

  efectivo.neto = efectivo.ingresos - efectivo.egresos;
  tarjeta.neto = tarjeta.ingresos - tarjeta.egresos;

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
