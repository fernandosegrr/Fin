import { errorDeBaseDatos } from "@/lib/dashboard/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirUsuario } from "@/lib/dashboard/shared";
import type { Categoria, GrupoCategoria, TipoCategoria } from "@/lib/types";

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
}

export async function crearCategoria(input: CrearCategoriaInput): Promise<Categoria> {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre de la categoría es requerido.");
  if (nombre.length > 60) throw new Error("El nombre de la categoría es demasiado largo (máx. 60 caracteres).");
  if (input.tipo === "egreso" && !input.grupo) {
    throw new Error("Las categorías de egreso deben ser Fijo o Variable.");
  }

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

  const { count, error: errorCount } = await supabase
    .from("transacciones")
    .select("id", { count: "exact", head: true })
    .eq("categoria_id", id);
  if (errorCount) throw errorDeBaseDatos(errorCount);
  if ((count ?? 0) > 0) {
    throw new Error(
      `No se puede eliminar: hay ${count} movimiento${count === 1 ? "" : "s"} usando esta categoría. Cámbialos o elimínalos primero.`,
    );
  }

  const { error } = await supabase
    .from("categorias")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
