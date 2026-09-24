import { paginaHistorial, patronBusqueda, valorLogico } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import { esErrorEsquemaClientes } from "@/lib/dashboard/shared";
import type { MetodoPago, TipoCategoria, TransaccionConCategoria, Transferencia } from "@/lib/types";

// HISTORIAL GLOBAL
// ─────────────────────────────────────────────

export async function buscarTransacciones(input: {
  busqueda?: string;
  tipo?: "todos" | TipoCategoria;
  metodoPago?: "todos" | MetodoPago;
  limite?: number;
  offset?: number;
}): Promise<{ filas: TransaccionConCategoria[]; total: number }> {
  const supabase = await createClient();
  const { limite, offset } = paginaHistorial(input.limite, input.offset);
  const busqueda = input.busqueda?.trim() ?? "";
  if (input.tipo && !["todos", "ingreso", "egreso"].includes(input.tipo)) throw new Error("Tipo no válido.");
  if (input.metodoPago && !["todos", "tarjeta", "efectivo"].includes(input.metodoPago)) throw new Error("Cuenta no válida.");
  const usaInnerTipo = Boolean(input.tipo && input.tipo !== "todos");
  const categoriaSelect = usaInnerTipo ? "categoria:categorias!inner(id, nombre, tipo, grupo)" : "categoria:categorias(id, nombre, tipo, grupo)";

  async function consultar(conClientes: boolean) {
    const select = "*, " + categoriaSelect + (conClientes ? ", cliente:clientes(id, nombre)" : "");
    let query = supabase.from("transacciones").select(select, { count: "exact" })
      .order("fecha", { ascending: false }).order("creado_en", { ascending: false }).order("id", { ascending: false });
    if (usaInnerTipo) query = query.eq("categoria.tipo", input.tipo);
    if (input.metodoPago && input.metodoPago !== "todos") query = query.eq("metodo_pago", input.metodoPago);
    if (busqueda) {
      const q = patronBusqueda(busqueda);
      const cats = await supabase.from("categorias").select("id").ilike("nombre", q);
      if (cats.error) throw new Error(cats.error.message);
      const partes = ["descripcion.ilike." + valorLogico(q)];
      const catIds = (cats.data ?? []).map(c => valorLogico(String(c.id)));
      if (catIds.length) partes.push("categoria_id.in.(" + catIds.join(",") + ")");
      if (conClientes) {
        const clis = await supabase.from("clientes").select("id").ilike("nombre", q);
        if (clis.error) {
          if (!esErrorEsquemaClientes(clis.error.message)) throw new Error(clis.error.message);
        } else {
          const cliIds = (clis.data ?? []).map(c => valorLogico(String(c.id)));
          if (cliIds.length) partes.push("cliente_id.in.(" + cliIds.join(",") + ")");
        }
      }
      query = query.or(partes.join(","));
    }
    return query.range(offset, offset + limite - 1);
  }

  let resultado = await consultar(true);
  if (resultado.error && esErrorEsquemaClientes(resultado.error.message)) resultado = await consultar(false);
  if (resultado.error) throw new Error("No se pudo buscar el historial: " + resultado.error.message);
  return { filas: (resultado.data ?? []) as unknown as TransaccionConCategoria[], total: resultado.count ?? 0 };
}

/**
 * Busca traspasos entre métodos de pago para el Historial. Un traspaso toca
 * DOS métodos (origen y destino): filtrar por `metodoPago` incluye el
 * traspaso si cualquiera de los dos coincide, no solo el destino.
 */
export async function buscarTransferencias(input: {
  busqueda?: string;
  metodoPago?: "todos" | MetodoPago;
  limite?: number;
  offset?: number;
}): Promise<{ filas: Transferencia[]; total: number }> {
  const supabase = await createClient();
  const { limite, offset } = paginaHistorial(input.limite, input.offset);
  const busqueda = input.busqueda?.trim() ?? "";

  let query = supabase
    .from("transferencias")
    .select("*", { count: "exact" })
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false });

  if (input.metodoPago && input.metodoPago !== "todos") {
    query = query.or(`origen.eq.${input.metodoPago},destino.eq.${input.metodoPago}`);
  }
  if (busqueda) {
    query = query.ilike("descripcion", patronBusqueda(busqueda));
  }

  const { data, error, count } = await query.range(offset, offset + limite - 1);
  if (error) throw new Error(`No se pudieron buscar los traspasos: ${error.message}`);
  return { filas: (data ?? []) as Transferencia[], total: count ?? 0 };
}
