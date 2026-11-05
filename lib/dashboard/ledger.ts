import { createClient } from "@/lib/supabase/server";
import { traerTodasLasFilas } from "@/lib/supabase/paginar";
import { obtenerCuentas } from "./accounts";
import { esFechaISO, hoyISOEnMexico } from "@/lib/dates";
import { resumirLibro } from "@/lib/finance/ledger";
import { proyectarRendimientos, estimarRendimientosPendientes } from "@/lib/finance/returns";
import { NATURALEZAS, type FilaFinanciera, type NaturalezaMovimiento } from "@/lib/finance/types";
import type { MetodoPago, TransaccionConCategoria, Transferencia } from "@/lib/types";

export type FiltrosLibro = { busqueda?: string; tipo?: "todos" | "ingreso" | "egreso"; metodoPago?: "todos" | MetodoPago; cuentaId?: string; categoriaId?: string; naturaleza?: NaturalezaMovimiento | ""; desde?: string; hasta?: string; soloRevision?: boolean; offset?: number; limite?: number };
export type ItemLibro = { clase: "transaccion"; key: string; fecha: string; creado_en: string; data: TransaccionConCategoria } | { clase: "transferencia"; key: string; fecha: string; creado_en: string; data: Transferencia };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export async function buscarHistorialFinanciero(input: FiltrosLibro): Promise<{ filas: ItemLibro[]; total: number }> {
  for (const fecha of [input.desde, input.hasta]) if (fecha && !esFechaISO(fecha)) throw new Error("El rango de fechas no es válido.");
  if (input.desde && input.hasta && input.desde > input.hasta) throw new Error("La fecha inicial debe ser anterior a la final.");
  for (const id of [input.cuentaId, input.categoriaId]) if (id && !uuid.test(id)) throw new Error("El filtro seleccionado no es válido.");
  if (input.naturaleza && !(NATURALEZAS as readonly string[]).includes(input.naturaleza)) throw new Error("El tipo de movimiento no es válido.");
  if (input.tipo && !["todos", "ingreso", "egreso"].includes(input.tipo)) throw new Error("El tipo no es válido.");
  if (input.metodoPago && !["todos", "efectivo", "tarjeta"].includes(input.metodoPago)) throw new Error("El método no es válido.");
  const db = await createClient();
  const { data, error } = await db.rpc("buscar_historial_financiero", {
    p_busqueda: input.busqueda?.trim().slice(0, 300) || "", p_tipo: input.tipo || "todos", p_metodo: input.metodoPago || "todos",
    p_cuenta: input.cuentaId || null, p_categoria: input.categoriaId || null, p_naturaleza: input.naturaleza || null,
    p_desde: input.desde || null, p_hasta: input.hasta || null, p_revision: Boolean(input.soloRevision),
    p_offset: Math.max(0, Math.trunc(input.offset || 0)), p_limite: Math.max(1, Math.min(1000, Math.trunc(input.limite || 50))),
  });
  if (error) throw new Error(error.message);
  return data as { filas: ItemLibro[]; total: number };
}

export async function obtenerInformeFinanciero(desde = "2000-01-01", hasta = hoyISOEnMexico()) {
  if (!esFechaISO(desde) || !esFechaISO(hasta) || desde > hasta) throw new Error("El periodo no es válido.");
  const limite = new Date(`${hasta}T12:00:00Z`); limite.setUTCDate(limite.getUTCDate() + 1);
  const fin = limite.toISOString().slice(0, 10); const db = await createClient();
  const cuentas = await obtenerCuentas();
  const [filas, traspasos] = await Promise.all([
    traerTodasLasFilas<FilaFinanciera>((a, b) => db.from("transacciones").select("*, categoria:categorias(id,nombre,tipo,grupo), cliente:clientes(id,nombre)").is("eliminado_en", null).lt("fecha", fin).order("fecha").order("id").range(a, b), "No se pudo calcular el informe"),
    traerTodasLasFilas<Transferencia>((a, b) => db.from("transferencias").select("*").is("eliminado_en", null).lt("fecha", fin).order("fecha").order("id").range(a, b), "No se pudieron calcular los traspasos"),
  ]);
  const resumen = resumirLibro(cuentas, filas, traspasos, desde, fin);
  resumen.estimacionRendimientos = estimarRendimientosPendientes(cuentas, filas, traspasos, hasta);
  return { desde, hasta, resumen, proyeccion30Dias: proyectarRendimientos(resumen.cuentas, 30, hasta) };
}
