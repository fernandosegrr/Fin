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
  /** Suscripción/gasto recurrente que generó esta transacción, si aplica. */
  gasto_recurrente_id?: string | null;
  cliente_id?: string | null;
  creado_en: string;
}

export interface Cliente {
  id: string;
  user_id?: string;
  nombre: string;
}

export interface MetaAhorro {
  id: string;
  nombre: string;
  monto_objetivo: number;
  fecha_limite: string | null; // 'YYYY-MM-DD'
}

/** Traspaso de dinero entre métodos de pago. No es ingreso ni egreso: no afecta el patrimonio total. */
export interface Transferencia {
  id: string;
  user_id: string;
  monto: number;
  origen: MetodoPago;
  destino: MetodoPago;
  fecha: string; // 'YYYY-MM-DD'
  descripcion: string | null;
  creado_en: string;
}

/** Transacción con su categoría embebida (via join), tal como la usa la UI. */
export interface TransaccionConCategoria extends Transaccion {
  categoria: Pick<Categoria, "id" | "nombre" | "tipo" | "grupo"> | null;
  cliente?: Pick<Cliente, "id" | "nombre"> | null;
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
  categoria_id: string | null;
  metodo_pago: MetodoPago;
  categoria?: Pick<Categoria, "id" | "nombre" | "tipo" | "grupo"> | null;
}

/** Desglose de ingresos/egresos/saldo de un método de pago dentro de un mes. */
export interface DesgloseMetodoPago {
  ingresos: number; // ingresos de ESTE mes con este método
  egresos: number; // egresos de ESTE mes con este método
  neto: number; // ingresos - egresos de ESTE mes (incluye traspasos del mes)
  /** Saldo acumulado a la fecha con este método (histórico + este mes + traspasos). Es el "cuánto tengo" real. */
  saldo: number;
}

/** Gasto acumulado de una categoría dentro de un mes. */
export interface EgresoPorCategoria {
  categoria_id: string;
  nombre: string;
  monto: number;
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
  totalesEfectivo: DesgloseMetodoPago;
  totalesTarjeta: DesgloseMetodoPago;
  /** Traspasos entre métodos de pago registrados este mes. */
  transferencias: Transferencia[];
  // Los tres campos de abajo se agregan en el SERVIDOR sobre TODAS las
  // transacciones del mes. Antes la UI los recalculaba desde la lista de
  // `transacciones`, que está limitada a 200 filas por rendimiento: arriba de
  // ese tope, las gráficas y las métricas contradecían en silencio a los
  // totales de ingresos/egresos, que sí venían sin límite.
  /** Egresos del mes de categorías marcadas como "fijo". */
  egresosFijos: number;
  /** Egresos del mes de categorías marcadas como "variable". */
  egresosVariables: number;
  /** Egresos del mes agrupados por categoría, de mayor a menor. */
  egresosPorCategoria: EgresoPorCategoria[];
  /** Ingresos del mes agrupados por cliente/proyecto, de mayor a menor. */
  ingresosPorCliente: IngresoPorCliente[];
  /** IDs de gastos recurrentes que ya generaron un cobro en este mes. */
  recurrentesCobrados: string[];
}

export interface IngresoPorCliente {
  cliente_id: string | null;
  nombre: string;
  monto: number;
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

export type RolMensajeAsesor = "usuario" | "asistente";

export interface MensajeAsesor {
  id: string;
  rol: RolMensajeAsesor;
  contenido: string;
  creado_en: string;
}
