import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function obtenerCambiosFinancieros() {
  const db = await createClient();
  const { data, error } = await db.from("lotes_financieros").select("id,nombre,creado_en,revertido").order("creado_en", { ascending: false }).limit(30);
  if (error) throw new Error(error.message);
  return data as { id: string; nombre: string; creado_en: string; revertido: boolean }[];
}

export async function revertirLoteFinanciero(id: string) {
  const db = await createClient(); const { error } = await db.rpc("revertir_lote_financiero", { p_lote: id });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
