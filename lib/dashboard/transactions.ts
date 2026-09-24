import { errorDeBaseDatos } from "@/lib/dashboard/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rangoDelMes } from "@/lib/dates";
import { esMetodoPago, fechaOHoy, exigirUsuario, exigirCategoriaDelUsuario, exigirClienteDelUsuario } from "@/lib/dashboard/shared";
import { montoPositivo } from "@/lib/dashboard/validation";
import type { MetodoPago } from "@/lib/types";

// TRANSACCIONES
// ─────────────────────────────────────────────

export interface NuevaTransaccion {
  categoria_id: string;
  monto: number;
  descripcion: string | null;
  metodo_pago?: MetodoPago;
  fecha?: string;
  /** Suscripción/gasto recurrente que originó este cobro, si aplica. */
  gasto_recurrente_id?: string | null;
  cliente_id?: string | null;
}

export async function crearTransaccion(input: NuevaTransaccion): Promise<void> {
  if (!input.categoria_id) {
    throw new Error("Selecciona una categoría.");
  }
  const monto = montoPositivo(input.monto);
  const metodoPago = input.metodo_pago ?? "tarjeta";
  if (!esMetodoPago(metodoPago)) {
    throw new Error("El método de pago no es válido.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  const categoria = await exigirCategoriaDelUsuario(supabase, input.categoria_id);

  const fecha = fechaOHoy(input.fecha);
  if (input.gasto_recurrente_id) {
    const recurrente = await supabase.from("gastos_recurrentes").select("id").eq("id", input.gasto_recurrente_id).eq("user_id", user.id).maybeSingle();
    if (recurrente.error) throw new Error(recurrente.error.message);
    if (!recurrente.data || categoria.tipo !== "egreso") throw new Error("El gasto recurrente no es válido.");
    const [anio, mes] = fecha.split("-").map(Number);
    const rango = rangoDelMes(anio, mes);
    const existente = await supabase.from("transacciones").select("id").eq("user_id", user.id).eq("gasto_recurrente_id", input.gasto_recurrente_id).gte("fecha", rango.inicio).lt("fecha", rango.finExclusivo).limit(1);
    if (existente.error) throw new Error(existente.error.message);
    if (existente.data?.length) throw new Error("Este pago recurrente ya está registrado en ese mes.");
  }

  if (input.cliente_id) await exigirClienteDelUsuario(supabase, input.cliente_id);

  const { error } = await supabase.from("transacciones").insert({
    user_id: user.id,
    categoria_id: input.categoria_id,
    monto,
    fecha,
    descripcion: input.descripcion?.trim() || null,
    metodo_pago: metodoPago,
    gasto_recurrente_id: input.gasto_recurrente_id ?? null,
    cliente_id: input.cliente_id ?? null,
  });

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

export interface ActualizarTransaccionInput {
  categoria_id: string;
  monto: number;
  descripcion: string | null;
  metodo_pago?: MetodoPago;
  fecha?: string;
  cliente_id?: string | null;
}

export async function actualizarTransaccion(
  id: string,
  input: ActualizarTransaccionInput,
): Promise<void> {
  if (!id) throw new Error("ID de transacción inválido.");
  if (!input.categoria_id) throw new Error("Selecciona una categoría.");
  const monto = montoPositivo(input.monto);
  const metodoPago = input.metodo_pago ?? "tarjeta";
  if (!esMetodoPago(metodoPago)) {
    throw new Error("El método de pago no es válido.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  const categoria = await exigirCategoriaDelUsuario(supabase, input.categoria_id);
  if (categoria.tipo === "ingreso" && input.cliente_id) {
    await exigirClienteDelUsuario(supabase, input.cliente_id);
  }

  const { error } = await supabase
    .from("transacciones")
    .update({
      categoria_id: input.categoria_id,
      monto,
      descripcion: input.descripcion?.trim() || null,
      metodo_pago: metodoPago,
      cliente_id: categoria.tipo === "ingreso" ? (input.cliente_id ?? null) : null,
      ...(categoria.tipo === "ingreso" ? { gasto_recurrente_id: null } : {}),
      ...(input.fecha ? { fecha: fechaOHoy(input.fecha) } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

export async function eliminarTransaccion(id: string): Promise<void> {
  if (!id) throw new Error("ID de transacción inválido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase
    .from("transacciones")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
