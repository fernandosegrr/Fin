import { errorDeBaseDatos } from "@/lib/dashboard/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rangoDelMes } from "@/lib/dates";
import { esMetodoPago, fechaOHoy, exigirUsuario, exigirCategoriaDelUsuario, exigirClienteDelUsuario } from "@/lib/dashboard/shared";
import { montoPositivo } from "@/lib/dashboard/validation";
import type { MetodoPago } from "@/lib/types";
import { exigirCuenta } from "./accounts";
import { NATURALEZAS, type NaturalezaMovimiento } from "@/lib/finance/types";

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
  naturaleza?: NaturalezaMovimiento;
  cuenta_id?: string | null;
  cuenta_destino_id?: string | null;
  etiquetas?: string[];
  requiere_revision?: boolean;
  motivo_revision?: string | null;
  clave_solicitud?: string;
  interes_bruto?: number | null;
  impuesto_retenido?: number | null;
  movimiento_relacionado_id?: string | null;
}

export async function crearTransaccion(input: NuevaTransaccion): Promise<void> {
  if (!input.categoria_id) {
    throw new Error("Selecciona una categoría.");
  }
  const monto = montoPositivo(input.monto);
  const cuenta = input.cuenta_id ? await exigirCuenta(input.cuenta_id) : null;
  const metodoPago = cuenta?.metodo_pago ?? input.metodo_pago ?? "tarjeta";
  if (!esMetodoPago(metodoPago)) {
    throw new Error("El método de pago no es válido.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  const categoria = await exigirCategoriaDelUsuario(supabase, input.categoria_id);
  const naturaleza = input.naturaleza ?? categoria.naturaleza ?? categoria.tipo;
  if (!(NATURALEZAS as readonly string[]).includes(naturaleza)) throw new Error("El tipo de movimiento no es válido.");
  if (naturaleza === "traspaso") {
    if (!input.cuenta_destino_id || input.cuenta_destino_id === cuenta?.id) throw new Error("Selecciona otra cuenta de destino.");
    await exigirCuenta(input.cuenta_destino_id);
  }

  const fecha = fechaOHoy(input.fecha);
  if (input.gasto_recurrente_id) {
    const recurrente = await supabase.from("gastos_recurrentes").select("id").eq("id", input.gasto_recurrente_id).eq("user_id", user.id).maybeSingle();
    if (recurrente.error) throw new Error(recurrente.error.message);
    if (!recurrente.data || categoria.tipo !== "egreso") throw new Error("El gasto recurrente no es válido.");
    const [anio, mes] = fecha.split("-").map(Number);
    const rango = rangoDelMes(anio, mes);
    const existente = await supabase.from("transacciones").select("id").is("eliminado_en", null).eq("user_id", user.id).eq("gasto_recurrente_id", input.gasto_recurrente_id).gte("fecha", rango.inicio).lt("fecha", rango.finExclusivo).limit(1);
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
    naturaleza, cuenta_id: input.cuenta_id ?? null,
    cuenta_destino_id: naturaleza === "traspaso" ? input.cuenta_destino_id : null,
    etiquetas: (input.etiquetas ?? []).map(x => x.trim()).filter(Boolean).slice(0, 12),
    requiere_revision: input.requiere_revision ?? false,
    motivo_revision: input.requiere_revision ? input.motivo_revision?.trim() || "Concepto por precisar" : null,
    clave_solicitud: input.clave_solicitud ?? null,
    interes_bruto: naturaleza === "rendimiento" ? input.interes_bruto ?? null : null,
    impuesto_retenido: naturaleza === "rendimiento" ? input.impuesto_retenido ?? null : null,
    movimiento_relacionado_id: input.movimiento_relacionado_id ?? null,
  });

  if (error) {
    const repetida = error.code === "23505" && input.clave_solicitud ? await supabase.from("transacciones").select("id").eq("user_id", user.id).eq("clave_solicitud", input.clave_solicitud).maybeSingle() : null;
    if (!repetida?.data) throw errorDeBaseDatos(error);
  }

  revalidatePath("/dashboard");
}

export interface ActualizarTransaccionInput {
  categoria_id: string;
  monto: number;
  descripcion: string | null;
  metodo_pago?: MetodoPago;
  fecha?: string;
  cliente_id?: string | null;
  naturaleza?: NaturalezaMovimiento;
  cuenta_id?: string | null;
  cuenta_destino_id?: string | null;
  etiquetas?: string[];
  requiere_revision?: boolean;
  motivo_revision?: string | null;
  interes_bruto?: number | null;
  impuesto_retenido?: number | null;
  movimiento_relacionado_id?: string | null;
}

export async function actualizarTransaccion(
  id: string,
  input: ActualizarTransaccionInput,
): Promise<void> {
  if (!id) throw new Error("ID de transacción inválido.");
  if (!input.categoria_id) throw new Error("Selecciona una categoría.");
  const monto = montoPositivo(input.monto);
  const cuenta = input.cuenta_id ? await exigirCuenta(input.cuenta_id) : null;
  const metodoPago = cuenta?.metodo_pago ?? input.metodo_pago ?? "tarjeta";
  if (!esMetodoPago(metodoPago)) {
    throw new Error("El método de pago no es válido.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  const categoria = await exigirCategoriaDelUsuario(supabase, input.categoria_id);
  const anterior = await supabase.from("transacciones").select("id, categoria_id, naturaleza, cuenta_id, cuenta_destino_id").eq("id", id).eq("user_id", user.id).is("eliminado_en", null).maybeSingle();
  if (anterior.error) throw errorDeBaseDatos(anterior.error);
  if (!anterior.data) throw new Error("El movimiento no existe o ya fue eliminado.");
  const naturaleza = input.naturaleza ?? (anterior.data.categoria_id === categoria.id ? anterior.data.naturaleza : categoria.naturaleza ?? categoria.tipo);
  if (!(NATURALEZAS as readonly string[]).includes(naturaleza)) throw new Error("El tipo de movimiento no es válido.");
  const destino = input.cuenta_destino_id ?? anterior.data.cuenta_destino_id;
  if (naturaleza === "traspaso") {
    if (!destino || destino === (cuenta?.id ?? anterior.data.cuenta_id)) throw new Error("Selecciona otra cuenta de destino.");
    await exigirCuenta(destino);
  }
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
      naturaleza,
      ...(input.cuenta_id ? { cuenta_id: input.cuenta_id } : {}),
      cuenta_destino_id: naturaleza === "traspaso" ? destino : null,
      ...(input.interes_bruto !== undefined || naturaleza !== "rendimiento" ? { interes_bruto: naturaleza === "rendimiento" ? input.interes_bruto : null } : {}),
      ...(input.impuesto_retenido !== undefined || naturaleza !== "rendimiento" ? { impuesto_retenido: naturaleza === "rendimiento" ? input.impuesto_retenido : null } : {}),
      ...(input.movimiento_relacionado_id !== undefined ? { movimiento_relacionado_id: input.movimiento_relacionado_id } : {}),
      ...(input.etiquetas ? { etiquetas: input.etiquetas.map(x => x.trim()).filter(Boolean).slice(0, 12) } : {}),
      ...(input.requiere_revision !== undefined ? { requiere_revision: input.requiere_revision, motivo_revision: input.requiere_revision ? input.motivo_revision || "Concepto por precisar" : null } : {}),
      cliente_id: categoria.tipo === "ingreso" ? (input.cliente_id ?? null) : null,
      ...(naturaleza !== "egreso" ? { gasto_recurrente_id: null } : {}),
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
    .update({ eliminado_en: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

export async function restaurarTransaccion(id: string): Promise<void> {
  const db = await createClient(); const user = await exigirUsuario(db);
  const { error } = await db.from("transacciones").update({ eliminado_en: null }).eq("id", id).eq("user_id", user.id);
  if (error) throw errorDeBaseDatos(error);
  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
