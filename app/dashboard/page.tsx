import { DashboardContainer } from "@/components/dashboard-container";
import { obtenerDatosDashboard } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { esErrorTransitorio, reintentarLectura } from "@/lib/supabase/retry";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Auth guard explícito — safety net si el middleware falla
  const supabase = await createClient();
  let autenticado: boolean;
  try {
    autenticado = await reintentarLectura(async () => {
      const { data, error } = await supabase.auth.getClaims();
      if (error && esErrorTransitorio(error)) throw error;
      return Boolean(data?.claims?.sub);
    });
  } catch (error) {
    console.error("Error definitivo al verificar sesión del dashboard:", error);
    throw error;
  }

  if (!autenticado) {
    redirect("/login");
  }

  const datos = await obtenerDatosDashboard();

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
