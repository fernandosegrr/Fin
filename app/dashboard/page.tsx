import { DashboardContainer } from "@/components/dashboard-container";
import { obtenerDatosDashboard, type DatosDashboard } from "./actions";
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

  // Carga con reintento transparente en el servidor ante cold starts o micro-cortes de Supabase
  let datos: DatosDashboard;
  try {
    datos = await obtenerDatosDashboard();
  } catch (err) {
    console.warn("Aviso: reintentando carga inicial del dashboard tras fallo transitorio:", err);
    await new Promise((resolve) => setTimeout(resolve, 400));
    datos = await obtenerDatosDashboard();
  }

  return (
    <DashboardContainer
      initialBalance={datos.balance}
      initialPresupuestos={datos.presupuestos}
      initialGastosRecurrentes={datos.gastosRecurrentes}
      categorias={datos.categorias}
      initialClientes={datos.clientes}
      initialMeta={datos.meta}
    />
  );
}
