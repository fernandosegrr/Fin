import { reintentarLectura } from "@/lib/supabase/retry";
import { obtenerBalanceMensual } from "@/lib/dashboard/balance";
import { obtenerPresupuestosConCategorias } from "@/lib/dashboard/budgets";
import { obtenerCategorias } from "@/lib/dashboard/categories";
import { obtenerGastosRecurrentes } from "@/lib/dashboard/recurring";
import { obtenerClientes } from "@/lib/dashboard/clients";
import { obtenerMetaAhorro } from "@/lib/dashboard/goals";
import type { Categoria, Cliente, GastoRecurrente, MetaAhorro, PresupuestoConGasto } from "@/lib/types";
import type { BalanceMensual } from "@/lib/dashboard/balance";

export interface DatosDashboard {
  balance: BalanceMensual;
  presupuestos: PresupuestoConGasto[];
  gastosRecurrentes: GastoRecurrente[];
  clientes: Cliente[];
  meta: MetaAhorro | null;
  categorias: Categoria[];
}

/**
 * Carga unificada de TODO el estado del dashboard en una sola Server Action.
 * Al ejecutarse en el servidor, comparte una única llamada memoizada a createClient(),
 * evita 6 roundtrips HTTP independientes desde el cliente y previene colisiones
 * o carreras en la rotación de tokens.
 */
export async function obtenerDatosDashboard(
  anioTarget?: number,
  mesTarget?: number,
): Promise<DatosDashboard> {
  async function cargar<T>(etapa: string, leer: () => Promise<T>): Promise<T> {
    try {
      return await reintentarLectura(leer);
    } catch (error) {
      console.error(`Error definitivo al cargar dashboard (${etapa}):`, error);
      throw error;
    }
  }

  // Workers permite seis conexiones salientes simultáneas. El balance abre
  // cuatro consultas y las otras dos lecturas completan el primer grupo.
  const [balance, categorias, gastosRecurrentes] =
    await Promise.all([
      cargar("balance", () => obtenerBalanceMensual(anioTarget, mesTarget)),
      cargar("categorias", obtenerCategorias),
      cargar("gastos recurrentes", obtenerGastosRecurrentes),
    ]);
  const [presupuestos, clientes, meta] = await Promise.all([
      cargar("presupuestos", () => obtenerPresupuestosConCategorias(anioTarget, mesTarget, categorias)),
      cargar("clientes", obtenerClientes),
      cargar("meta de ahorro", obtenerMetaAhorro),
    ]);

  return {
    balance,
    presupuestos,
    gastosRecurrentes,
    clientes,
    meta,
    categorias,
  };
}
