import { errorDeBaseDatos } from "@/lib/dashboard/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyISOEnMexico } from "@/lib/dates";
import { formatearMonto, redondearMonto } from "@/lib/format";
import { esMetodoPago, exigirUsuario, exigirCategoriaDelUsuario } from "@/lib/dashboard/shared";
import { montoPositivo } from "@/lib/dashboard/validation";
import { obtenerBalanceMensual } from "@/lib/dashboard/balance";
import type { GastoRecurrente, MetodoPago, TipoCategoria } from "@/lib/types";
import type { ClienteSupabase } from "@/lib/dashboard/shared";

// GASTOS RECURRENTES (ahora en Supabase, no localStorage)
// ─────────────────────────────────────────────

export async function obtenerGastosRecurrentes(): Promise<GastoRecurrente[]> {
  const supabase = await createClient();

  // RLS ya filtra por auth.uid(); un error de lectura no significa lista vacía.
  const { data, error } = await supabase
    .from("gastos_recurrentes")
    .select("*, categoria:categorias(id, nombre, tipo, grupo)")
    .eq("archivada", false)
    .order("dia_cobro");

  if (error) throw new Error(`No se pudieron cargar los gastos recurrentes: ${error.message}`, { cause: error });
  return (data ?? []) as unknown as GastoRecurrente[];
}

export interface NuevoGastoRecurrente {
  nombre: string;
  monto: number;
  dia_cobro: number;
  categoria_id: string;
  metodo_pago: MetodoPago;
}

export async function crearGastoRecurrente(input: NuevoGastoRecurrente): Promise<void> {
  if (!input.nombre.trim()) throw new Error("El nombre es requerido.");
  if (input.nombre.trim().length > 80) throw new Error("El nombre es demasiado largo (máx. 80 caracteres).");
  const monto = montoPositivo(input.monto);
  if (!Number.isInteger(input.dia_cobro) || input.dia_cobro < 1 || input.dia_cobro > 31) throw new Error("El día de cobro debe estar entre 1 y 31.");
  if (!input.categoria_id) throw new Error("Selecciona una categoría.");
  if (!esMetodoPago(input.metodo_pago)) throw new Error("El método de pago no es válido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  const categoria = await exigirCategoriaDelUsuario(supabase, input.categoria_id);
  if (categoria.tipo !== "egreso") {
    throw new Error("Las suscripciones deben usarse con una categoría de egreso.");
  }

  const { error } = await supabase.from("gastos_recurrentes").insert({
    user_id: user.id,
    nombre: input.nombre.trim(),
    monto,
    dia_cobro: input.dia_cobro,
    categoria_id: input.categoria_id,
    metodo_pago: input.metodo_pago,
  });

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

export async function actualizarGastoRecurrente(
  id: string,
  input: NuevoGastoRecurrente,
): Promise<void> {
  if (!id) throw new Error("ID inválido.");
  if (!input.nombre.trim()) throw new Error("El nombre es requerido.");
  if (input.nombre.trim().length > 80) throw new Error("El nombre es demasiado largo (máx. 80 caracteres).");
  const monto = montoPositivo(input.monto);
  if (!Number.isInteger(input.dia_cobro) || input.dia_cobro < 1 || input.dia_cobro > 31) throw new Error("El día de cobro debe estar entre 1 y 31.");
  if (!input.categoria_id) throw new Error("Selecciona una categoría.");
  if (!esMetodoPago(input.metodo_pago)) throw new Error("El método de pago no es válido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  const categoria = await exigirCategoriaDelUsuario(supabase, input.categoria_id);
  if (categoria.tipo !== "egreso") {
    throw new Error("Las suscripciones deben usarse con una categoría de egreso.");
  }

  const { error } = await supabase
    .from("gastos_recurrentes")
    .update({
      nombre: input.nombre.trim(),
      monto,
      dia_cobro: input.dia_cobro,
      categoria_id: input.categoria_id,
      metodo_pago: input.metodo_pago,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

export async function eliminarGastoRecurrente(id: string): Promise<void> {
  if (!id) throw new Error("ID inválido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase
    .from("gastos_recurrentes")
    .update({ archivada: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

const NOMBRE_CATEGORIA_AJUSTE = "Ajuste de saldo";

async function asegurarCategoriaAjuste(
  supabase: ClienteSupabase,
  userId: string,
  tipo: TipoCategoria,
): Promise<string> {
  const { data: existente, error: errorBusqueda } = await supabase
    .from("categorias")
    .select("id")
    .eq("tipo", tipo)
    .eq("nombre", NOMBRE_CATEGORIA_AJUSTE)
    .maybeSingle();
  if (errorBusqueda) throw errorDeBaseDatos(errorBusqueda);
  if (existente?.id) return existente.id as string;

  const { data, error } = await supabase
    .from("categorias")
    .insert({
      user_id: userId,
      nombre: NOMBRE_CATEGORIA_AJUSTE,
      tipo,
      grupo: tipo === "egreso" ? "variable" : null,
    })
    .select("id")
    .single();
  if (error) throw errorDeBaseDatos(error);
  return data.id as string;
}

export type ResultadoAjusteSaldo =
  | { ok: true; diferencia: number }
  | { ok: false; error: string };

/**
 * Iguala el saldo de un método al monto que el usuario tiene de verdad.
 * Crea una conciliación independiente de ingresos/consumo con fecha de hoy
 * (México), para no reescribir el historial.
 */
export async function ajustarSaldo(
  metodo: MetodoPago,
  saldoObjetivo: number,
): Promise<ResultadoAjusteSaldo> {
  try {
    if (!esMetodoPago(metodo)) return { ok: false, error: "El método de pago no es válido." };
    if (!Number.isFinite(saldoObjetivo)) return { ok: false, error: "Ingresa un saldo válido." };

    const supabase = await createClient();
    const user = await exigirUsuario(supabase);
    const balance = await obtenerBalanceMensual();
    const actual =
      metodo === "efectivo" ? balance.actual.totalesEfectivo.saldo : balance.actual.totalesTarjeta.saldo;
    const diferencia = redondearMonto(saldoObjetivo - actual);
    if (Math.abs(diferencia) < 0.01) {
      return { ok: false, error: "Ese método ya está en ese saldo." };
    }

    const tipo: TipoCategoria = diferencia > 0 ? "ingreso" : "egreso";
    const categoriaId = await asegurarCategoriaAjuste(supabase, user.id, tipo);
    const { error } = await supabase.from("transacciones").insert({
      user_id: user.id,
      categoria_id: categoriaId,
      monto: Math.abs(diferencia),
      fecha: hoyISOEnMexico(),
      descripcion: `Ajuste a saldo real (${formatearMonto(saldoObjetivo)})`,
      metodo_pago: metodo,
      naturaleza: diferencia > 0 ? "ajuste_entrada" : "ajuste_salida",
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard");
    return { ok: true, diferencia };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo ajustar el saldo." };
  }
}

// ─────────────────────────────────────────────
