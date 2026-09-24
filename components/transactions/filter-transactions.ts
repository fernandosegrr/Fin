import type { MetodoPago, TipoCategoria, TransaccionConCategoria } from "@/lib/types";

export interface TransactionFilters {
  busqueda: string;
  tipo: "todos" | TipoCategoria;
  metodo: "todos" | MetodoPago;
}

export function filterTransactions<T extends TransaccionConCategoria>(items: T[], filters: TransactionFilters): T[] {
  const busqueda = filters.busqueda.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.tipo !== "todos" && item.categoria?.tipo !== filters.tipo) return false;
    if (filters.metodo !== "todos" && (item.metodo_pago || "tarjeta") !== filters.metodo) return false;
    if (!busqueda) return true;
    return [item.descripcion, item.categoria?.nombre, item.cliente?.nombre]
      .some((valor) => valor?.toLowerCase().includes(busqueda));
  });
}
