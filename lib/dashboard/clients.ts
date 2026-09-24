import { errorDeBaseDatos } from "@/lib/dashboard/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirUsuario, esErrorEsquemaClientes } from "@/lib/dashboard/shared";
import type { Cliente } from "@/lib/types";

// CLIENTES / PROYECTOS
// ─────────────────────────────────────────────

export async function obtenerClientes(): Promise<Cliente[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").select("id, user_id, nombre").order("nombre");
  if (error) {
    if (esErrorEsquemaClientes(error.message)) return [];
    throw new Error(`No se pudieron cargar los clientes: ${error.message}`, { cause: error });
  }
  return (data ?? []) as Cliente[];
}

export async function crearCliente(nombreCrudo: string): Promise<Cliente> {
  const nombre = nombreCrudo.trim();
  if (!nombre) throw new Error("El nombre del cliente es requerido.");
  if (nombre.length > 60) throw new Error("El nombre es demasiado largo (máx. 60 caracteres).");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { data: existentes, error: errorExistentes } = await supabase.from("clientes").select("id, nombre");
  if (errorExistentes) throw errorDeBaseDatos(errorExistentes);
  const norm = nombre.toLocaleLowerCase("es-MX");
  const ya = (existentes ?? []).find((c) => String(c.nombre).toLocaleLowerCase("es-MX") === norm);
  if (ya) return ya as Cliente;

  const { data, error } = await supabase
    .from("clientes")
    .insert({ user_id: user.id, nombre })
    .select("id, user_id, nombre")
    .single();
  if (error) throw errorDeBaseDatos(error);
  revalidatePath("/dashboard");
  return data as Cliente;
}

export async function eliminarCliente(id: string): Promise<void> {
  if (!id) throw new Error("ID de cliente inválido.");
  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  const { error } = await supabase.from("clientes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw errorDeBaseDatos(error);
  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
