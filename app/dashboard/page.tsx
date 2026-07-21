import { DashboardContainer } from "@/components/dashboard-container";
import { obtenerBalanceMensual, obtenerCategorias, obtenerPresupuestosConGasto } from "./actions";

export default async function DashboardPage() {
  const [balance, presupuestos, categorias] = await Promise.all([
    obtenerBalanceMensual(),
    obtenerPresupuestosConGasto(),
    obtenerCategorias(),
  ]);

  return (
    <DashboardContainer
      initialBalance={balance}
      initialPresupuestos={presupuestos}
      categorias={categorias}
    />
  );
}
