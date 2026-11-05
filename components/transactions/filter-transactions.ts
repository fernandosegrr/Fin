import type { MetodoPago, TipoCategoria, TransaccionConCategoria } from "@/lib/types";
import { naturalezaDe } from "@/lib/finance/ledger";

export interface TransactionFilters {
  busqueda: string;
  tipo: "todos" | TipoCategoria;
  metodo: "todos" | MetodoPago;
}

export function filterTransactions<T extends TransaccionConCategoria>(items: T[], filters: TransactionFilters): T[] {
  const busqueda = filters.busqueda.trim().toLowerCase();
  return items.filter((item) => {
    const naturaleza = naturalezaDe(item);
    if (filters.tipo === "ingreso" && !["ingreso", "apoyo", "rendimiento"].includes(naturaleza)) return false;
    if (filters.tipo === "egreso" && naturaleza !== "egreso" && naturaleza !== "retencion") return false;
    if (filters.metodo !== "todos" && (item.metodo_pago || "tarjeta") !== filters.metodo) return false;
    if (!busqueda) return true;
    return [item.descripcion, item.categoria?.nombre, item.cliente?.nombre, ...(item.etiquetas || [])]
      .some((valor) => valor?.toLowerCase().includes(busqueda));
  });
}
