export type TipoCategoria = "ingreso" | "egreso";
export type GrupoCategoria = "fijo" | "variable";
export type MetodoPago = "efectivo" | "tarjeta";

export interface Categoria {
  id: string;
  user_id: string;
  nombre: string;
  tipo: TipoCategoria;
  grupo: GrupoCategoria | null;
}

export interface Transaccion {
  id: string;
  user_id: string;
  categoria_id: string;
  monto: number;
  fecha: string; // 'YYYY-MM-DD'
  descripcion: string | null;
  metodo_pago?: MetodoPago;
  creado_en: string;
}

/** Transacción con su categoría embebida (via join), tal como la usa la UI. */
export interface TransaccionConCategoria extends Transaccion {
  categoria: Pick<Categoria, "id" | "nombre" | "tipo" | "grupo"> | null;
}

export interface Presupuesto {
  id: string;
  user_id: string;
  categoria_id: string;
  monto_limite: number;
  mes: string; // 'YYYY-MM-01'
}

export interface GastoRecurrente {
  id: string;
  user_id?: string;
  nombre: string;
  monto: number;
  dia_cobro: number; // 1-31
  categoria_id: string;
  metodo_pago: MetodoPago;
  categoria?: Pick<Categoria, "id" | "nombre" | "tipo" | "grupo"> | null;
}

/** Resumen de ingresos/egresos/balance de un mes calendario. */
export interface ResumenMes {
  anio: number;
  mes: number; // 1-12
  ingresos: number;
  egresos: number;
  balance: number; // Balance exclusivo del mes (Ingresos - Egresos)
  saldoInicial: number; // Arrastre acumulado de todos los meses anteriores
  saldoTotalDisponible: number; // saldoInicial + balance
  totalesEfectivo: { ingresos: number; egresos: number; neto: number };
  totalesTarjeta: { ingresos: number; egresos: number; neto: number };
}

export interface PresupuestoConGasto {
  categoria: Categoria;
  presupuesto: Presupuesto | null;
  gastado: number;
}

export interface FiltrosTransaccion {
  busqueda: string;
  tipo: "todos" | TipoCategoria;
  grupo: "todos" | GrupoCategoria;
  metodoPago: "todos" | MetodoPago;
  categoriaId: string;
}
