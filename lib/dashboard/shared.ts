import { errorDeBaseDatos } from "@/lib/dashboard/errors";
import { createClient } from "@/lib/supabase/server";
import { esFechaISO, hoyISOEnMexico } from "@/lib/dates";
import type { Categoria, Cliente, MetodoPago } from "@/lib/types";

export type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

export function esMetodoPago(valor: unknown): valor is MetodoPago {
  return valor === "tarjeta" || valor === "efectivo";
}

export function fechaOHoy(fecha?: string): string {
  if (!fecha) return hoyISOEnMexico();
  if (!esFechaISO(fecha)) throw new Error("La fecha no es válida.");
  return fecha;
}

export async function exigirUsuario(supabase: ClienteSupabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");
  return user;
}

export async function exigirCategoriaDelUsuario(
  supabase: ClienteSupabase,
  categoriaId: string,
): Promise<Categoria> {
  const { data, error } = await supabase
    .from("categorias")
    .select("*")
    .eq("id", categoriaId)
    .maybeSingle();
  if (error) throw errorDeBaseDatos(error);
  if (!data) throw new Error("La categoría no existe o no te pertenece.");
  return data as Categoria;
}

export async function exigirClienteDelUsuario(
  supabase: ClienteSupabase,
  clienteId: string,
): Promise<Cliente> {
  const { data, error } = await supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle();
  if (error) throw errorDeBaseDatos(error);
  if (!data) throw new Error("El cliente no existe o no te pertenece.");
  return data as Cliente;
}

// ─────────────────────────────────────────────

export function esErrorEsquemaClientes(mensaje: string): boolean {
  return /clientes|cliente_id/i.test(mensaje) &&
    /could not find .* in the schema cache|(?:relation|column) .* does not exist/i.test(mensaje);
}
