export type TipoCategoria = "ingreso" | "egreso";
export type GrupoCategoria = "fijo" | "variable";

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

/** Resumen de ingresos/egresos/balance de un mes calendario. */
export interface ResumenMes {
  anio: number;
  mes: number; // 1-12
  ingresos: number;
  egresos: number;
  balance: number;
}

/** Presupuesto de una categoría de egreso, con su gasto acumulado del mes. */
export interface PresupuestoConGasto {
  categoria: Categoria;
  presupuesto: Presupuesto | null;
  gastado: number;
}

export interface FiltrosTransaccion {
  busqueda: string;
  tipo: "todos" | TipoCategoria;
  grupo: "todos" | GrupoCategoria;
  categoriaId: string;
}
