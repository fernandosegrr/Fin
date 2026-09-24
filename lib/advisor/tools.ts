import { esFechaISO } from "@/lib/dates";
import { formatearMonto } from "@/lib/format";
import { crearCliente } from "@/lib/dashboard/clients";
import { crearTransaccion } from "@/lib/dashboard/transactions";
import { obtenerCategorias } from "@/lib/dashboard/categories";
import { MAX_NOTAS_MEMORIA } from "./config";
import type { SupabaseServerClient } from "./types";

export async function ejecutarGuardarNotaMemoria(
  supabase: SupabaseServerClient,
  userId: string,
  argumentosCrudos: string,
): Promise<string> {
  let contenido = "";
  try {
    const parsed: unknown = JSON.parse(argumentosCrudos);
    if (typeof (parsed as { contenido?: unknown })?.contenido === "string") {
      contenido = (parsed as { contenido: string }).contenido.trim();
    }
  } catch {
    return "Error: argumentos inválidos, no se guardó nada.";
  }

  if (!contenido) return "Error: contenido vacío o inválido, no se guardó nada.";
  if (contenido.length > 500) return "Error: la nota es demasiado larga (máx. 500 caracteres), no se guardó.";

  const { data: existentes, error: errorExistentes } = await supabase
    .from("notas_memoria_asesor")
    .select("id, contenido, creado_en")
    .eq("user_id", userId)
    .order("creado_en", { ascending: true });
  if (errorExistentes) {
    console.error("Error leyendo notas de memoria:", errorExistentes);
    return "Error: no se pudo guardar la nota.";
  }

  const notas = existentes ?? [];
  const contenidoNorm = contenido.toLocaleLowerCase("es-MX");
  if (notas.some((n) => String(n.contenido).toLocaleLowerCase("es-MX") === contenidoNorm)) {
    return "Esa nota ya estaba guardada; no se duplicó.";
  }

  if (notas.length >= MAX_NOTAS_MEMORIA) {
    const sobran = notas.length - MAX_NOTAS_MEMORIA + 1;
    const idsViejas = notas.slice(0, sobran).map((n) => n.id as string);
    const { error: errorPrune } = await supabase.from("notas_memoria_asesor").delete().in("id", idsViejas);
    if (errorPrune) {
      console.error("Error recortando notas de memoria:", errorPrune);
      return "Error: no se pudo guardar la nota (memoria llena).";
    }
  }

  const { error } = await supabase.from("notas_memoria_asesor").insert({ user_id: userId, contenido });
  if (error) {
    console.error("Error guardando nota de memoria:", error);
    return "Error: no se pudo guardar la nota.";
  }
  return "Nota guardada correctamente.";
}

export async function ejecutarRegistrarMovimiento(argumentosCrudos: string): Promise<string> {
  let parsed: {
    tipo?: unknown;
    monto?: unknown;
    categoria?: unknown;
    metodo_pago?: unknown;
    descripcion?: unknown;
    fecha?: unknown;
    cliente?: unknown;
  };
  try {
    parsed = JSON.parse(argumentosCrudos) as typeof parsed;
  } catch {
    return "Error: argumentos inválidos, no se registró nada.";
  }

  const tipo = parsed.tipo === "ingreso" || parsed.tipo === "egreso" ? parsed.tipo : null;
  const monto = typeof parsed.monto === "number" ? parsed.monto : Number(parsed.monto);
  const nombreCat = typeof parsed.categoria === "string" ? parsed.categoria.trim() : "";
  const metodo = parsed.metodo_pago === "efectivo" || parsed.metodo_pago === "tarjeta" ? parsed.metodo_pago : null;
  const descripcion = typeof parsed.descripcion === "string" ? parsed.descripcion.trim() : "";
  const fecha = typeof parsed.fecha === "string" ? parsed.fecha.trim() : "";
  const nombreCliente = typeof parsed.cliente === "string" ? parsed.cliente.trim() : "";

  if (!tipo) return "Error: el tipo debe ser ingreso o egreso.";
  if (!Number.isFinite(monto) || monto <= 0) return "Error: el monto debe ser mayor a 0.";
  if (monto > 1_000_000) return "Error: el monto es demasiado grande. Confírmalo con el usuario.";
  if (!metodo) return "Error: el método de pago debe ser efectivo o tarjeta.";
  if (!nombreCat) return "Error: indica una categoría.";
  if (fecha && !esFechaISO(fecha)) return "Error: la fecha debe ser YYYY-MM-DD.";

  const categorias = await obtenerCategorias();
  const delTipo = categorias.filter((c) => c.tipo === tipo);
  const norm = nombreCat.toLocaleLowerCase("es-MX");
  const exacta = delTipo.find((c) => c.nombre.toLocaleLowerCase("es-MX") === norm);
  const parciales = delTipo.filter((c) => c.nombre.toLocaleLowerCase("es-MX").includes(norm) || norm.includes(c.nombre.toLocaleLowerCase("es-MX")));
  const categoria = exacta ?? (parciales.length === 1 ? parciales[0] : null);
  if (!categoria) {
    const lista = delTipo.map((c) => c.nombre).join(", ") || "(no hay categorías de este tipo)";
    if (parciales.length > 1) {
      return `Error: hay varias categorías parecidas (${parciales.map((c) => c.nombre).join(", ")}). Pregunta cuál usar.`;
    }
    return `Error: no encontré la categoría "${nombreCat}" de tipo ${tipo}. Disponibles: ${lista}.`;
  }

  let clienteId: string | null = null;
  if (tipo === "ingreso" && nombreCliente) {
    const creado = await crearCliente(nombreCliente);
    clienteId = creado.id;
  }

  try {
    await crearTransaccion({
      categoria_id: categoria.id,
      monto,
      descripcion: descripcion || null,
      metodo_pago: metodo,
      fecha: fecha || undefined,
      cliente_id: clienteId,
    });
  } catch (err) {
    return `Error al guardar: ${err instanceof Error ? err.message : "falló el registro"}`;
  }

  return `Movimiento registrado: ${tipo} de ${formatearMonto(monto)} en ${categoria.nombre} (${metodo})${descripcion ? ` — ${descripcion}` : ""}${nombreCliente ? ` · cliente ${nombreCliente}` : ""}.`;
}

// ─────────────────────────────────────────────
// ESCRITURA: enviar mensaje y obtener respuesta
// ─────────────────────────────────────────────
