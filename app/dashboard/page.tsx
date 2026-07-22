import { DashboardContainer } from "@/components/dashboard-container";
import {
  obtenerBalanceMensual,
  obtenerCategorias,
  obtenerPresupuestosConGasto,
  obtenerGastosRecurrentes,
} from "./actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  // Auth guard explícito — safety net si el middleware falla
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [balance, presupuestos, categorias, gastosRecurrentes] = await Promise.all([
    obtenerBalanceMensual(),
    obtenerPresupuestosConGasto(),
    obtenerCategorias(),
    obtenerGastosRecurrentes(),
  ]);

  return (
    <DashboardContainer
      initialBalance={balance}
      initialPresupuestos={presupuestos}
      initialGastosRecurrentes={gastosRecurrentes}
      categorias={categorias}
    />
  );
}
