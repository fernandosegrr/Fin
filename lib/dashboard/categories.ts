import { errorDeBaseDatos } from "@/lib/dashboard/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirUsuario } from "@/lib/dashboard/shared";
import type { Categoria, GrupoCategoria, TipoCategoria } from "@/lib/types";
import { NATURALEZAS, type NaturalezaMovimiento } from "@/lib/finance/types";
import { esIndicePresupuestoAusente, fusionarCategoriasCompatibles } from "./budget-compat";

// CATEGORÍAS
// ─────────────────────────────────────────────

export async function obtenerCategorias(): Promise<Categoria[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categorias").select("*").order("nombre");

  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`, { cause: error });
  return data ?? [];
}

export interface CrearCategoriaInput {
  nombre: string;
  tipo: TipoCategoria;
  grupo: GrupoCategoria | null;
  familia?: string | null;
  naturaleza?: NaturalezaMovimiento;
  aliases?: string[];
}

export async function crearCategoria(input: CrearCategoriaInput): Promise<Categoria> {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre de la categoría es requerido.");
  if (nombre.length > 60) throw new Error("El nombre de la categoría es demasiado largo (máx. 60 caracteres).");
  if (input.tipo === "egreso" && !input.grupo) {
    throw new Error("Las categorías de egreso deben ser Fijo o Variable.");
  }
  if (!["ingreso", "egreso"].includes(input.tipo) || (input.grupo && !["fijo", "variable"].includes(input.grupo))) throw new Error("El tipo de categoría no es válido.");
  if (input.naturaleza && !(NATURALEZAS as readonly string[]).includes(input.naturaleza)) throw new Error("El tipo de movimiento no es válido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { data: existentes, error: errorDuplicada } = await supabase
    .from("categorias")
    .select("id, nombre")
    .eq("tipo", input.tipo);
  if (errorDuplicada) throw errorDeBaseDatos(errorDuplicada);
  const nombreNorm = nombre.toLocaleLowerCase("es-MX");
  if ((existentes ?? []).some((c) => String(c.nombre).toLocaleLowerCase("es-MX") === nombreNorm)) {
    throw new Error("Ya tienes una categoría con ese nombre.");
  }

  const { data, error } = await supabase
    .from("categorias")
    .insert({
      user_id: user.id,
      nombre,
      tipo: input.tipo,
      grupo: input.tipo === "ingreso" ? null : input.grupo,
      familia: input.familia?.trim().slice(0, 60) || null,
      naturaleza: input.naturaleza ?? input.tipo,
      aliases: [...new Set((input.aliases ?? []).map(a => a.trim().slice(0, 80)).filter(Boolean))].slice(0, 30),
    })
    .select("*")
    .single();

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
  return data as Categoria;
}

export async function eliminarCategoria(id: string): Promise<void> {
  if (!id) throw new Error("ID de categoría inválido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase
    .from("categorias")
    .update({ archivada: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

export async function actualizarCategoria(id: string, input: { nombre: string; familia?: string | null; grupo?: GrupoCategoria | null; aliases?: string[]; archivada?: boolean }) {
  const nombre = input.nombre.trim();
  if (!nombre || nombre.length > 60) throw new Error("Usa un nombre de hasta 60 caracteres.");
  const db = await createClient(); const user = await exigirUsuario(db);
  const { data: actual, error: ea } = await db.from("categorias").select("*").eq("id", id).eq("user_id", user.id).single();
  if (ea || !actual) throw new Error("No se encontró la categoría.");
  const { data: iguales, error: ed } = await db.from("categorias").select("id, nombre").eq("tipo", actual.tipo).neq("id", id);
  if (ed) throw errorDeBaseDatos(ed);
  if (iguales?.some(c => c.nombre.trim().toLocaleLowerCase("es-MX") === nombre.toLocaleLowerCase("es-MX"))) throw new Error("Ya existe otra categoría con ese nombre.");
  const { error } = await db.from("categorias").update({ nombre, familia: input.familia?.trim().slice(0, 60) || null, grupo: actual.tipo === "egreso" ? input.grupo || actual.grupo || "variable" : null, aliases: [...new Set((input.aliases ?? actual.aliases ?? []).map((s: string) => s.trim().slice(0, 80)).filter(Boolean))].slice(0, 30), ...(input.archivada !== undefined ? { archivada: input.archivada } : {}) }).eq("id", id).eq("user_id", user.id);
  if (error) throw errorDeBaseDatos(error);
  revalidatePath("/dashboard");
}

export async function fusionarCategorias(origen: string, destino: string) {
  if (origen === destino) throw new Error("Selecciona otra categoría de destino.");
  const db = await createClient(); const r = await db.rpc("fusionar_categorias_financieras", { p_origen: origen, p_destino: destino });
  if (r.error) {
    if (esIndicePresupuestoAusente(r.error)) await fusionarCategoriasCompatibles(db, origen, destino);
    else throw errorDeBaseDatos(r.error);
  }
  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
