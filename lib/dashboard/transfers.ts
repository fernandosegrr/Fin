import { errorDeBaseDatos } from "@/lib/dashboard/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esMetodoPago, fechaOHoy, exigirUsuario } from "@/lib/dashboard/shared";
import { montoPositivo } from "@/lib/dashboard/validation";
import type { MetodoPago } from "@/lib/types";
import { exigirCuenta } from "./accounts";

// TRASPASOS ENTRE MÉTODOS DE PAGO (Efectivo ⇄ Tarjeta)
// ─────────────────────────────────────────────
// Un traspaso mueve saldo de un método a otro. No es ingreso ni egreso: el
// patrimonio total no cambia, por eso vive en su propia tabla y no toca
// categorías, presupuestos ni los totales de ingresos/egresos.

export interface NuevaTransferencia {
  monto: number;
  origen: MetodoPago;
  destino: MetodoPago;
  descripcion?: string | null;
  fecha?: string;
  cuenta_origen_id?: string;
  cuenta_destino_id?: string;
  clave_solicitud?: string;
}

export async function crearTransferencia(input: NuevaTransferencia): Promise<void> {
  const monto = montoPositivo(input.monto);
  let origen = input.origen, destino = input.destino;
  if (!esMetodoPago(input.origen) || !esMetodoPago(input.destino)) {
    throw new Error("El método de pago no es válido.");
  }
  if (Boolean(input.cuenta_origen_id) !== Boolean(input.cuenta_destino_id)) throw new Error("Selecciona ambas cuentas.");
  if (input.cuenta_origen_id && input.cuenta_destino_id) {
    if (input.cuenta_origen_id === input.cuenta_destino_id) throw new Error("Elige dos cuentas distintas.");
    const [a, b] = await Promise.all([exigirCuenta(input.cuenta_origen_id), exigirCuenta(input.cuenta_destino_id)]);
    origen = a.metodo_pago; destino = b.metodo_pago;
  } else if (input.origen === input.destino) {
    throw new Error("Elige dos métodos de pago distintos.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase.from("transferencias").insert({
    user_id: user.id,
    monto,
    origen,
    destino,
    fecha: fechaOHoy(input.fecha),
    descripcion: input.descripcion?.trim() || null,
    cuenta_origen_id: input.cuenta_origen_id ?? null,
    cuenta_destino_id: input.cuenta_destino_id ?? null,
    clave_solicitud: input.clave_solicitud ?? null,
  });

  if (error) {
    if (error.code === "23505" && input.clave_solicitud) {
      const repetida = await supabase.from("transferencias").select("id").eq("clave_solicitud", input.clave_solicitud).eq("user_id", user.id).maybeSingle();
      if (repetida.data) return;
    }
    throw errorDeBaseDatos(error);
  }

  revalidatePath("/dashboard");
}

export interface ActualizarTransferenciaInput {
  monto: number;
  origen: MetodoPago;
  destino: MetodoPago;
  descripcion?: string | null;
  fecha?: string;
  cuenta_origen_id?: string;
  cuenta_destino_id?: string;
}

export async function actualizarTransferencia(
  id: string,
  input: ActualizarTransferenciaInput,
): Promise<void> {
  if (!id) throw new Error("ID de traspaso inválido.");
  const monto = montoPositivo(input.monto);
  let origen = input.origen, destino = input.destino;
  if (!esMetodoPago(input.origen) || !esMetodoPago(input.destino)) {
    throw new Error("El método de pago no es válido.");
  }
  if (Boolean(input.cuenta_origen_id) !== Boolean(input.cuenta_destino_id)) throw new Error("Selecciona ambas cuentas.");
  if (input.cuenta_origen_id && input.cuenta_destino_id) {
    if (input.cuenta_origen_id === input.cuenta_destino_id) throw new Error("Elige dos cuentas distintas.");
    const [a, b] = await Promise.all([exigirCuenta(input.cuenta_origen_id), exigirCuenta(input.cuenta_destino_id)]);
    origen = a.metodo_pago; destino = b.metodo_pago;
  } else if (input.origen === input.destino) {
    throw new Error("Elige dos métodos de pago distintos.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase
    .from("transferencias")
    .update({
      monto,
      origen,
      destino,
      descripcion: input.descripcion?.trim() || null,
      cuenta_origen_id: input.cuenta_origen_id ?? null,
      cuenta_destino_id: input.cuenta_destino_id ?? null,
      ...(input.fecha ? { fecha: fechaOHoy(input.fecha) } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

export async function eliminarTransferencia(id: string): Promise<void> {
  if (!id) throw new Error("ID de traspaso inválido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase
    .from("transferencias")
    .update({ eliminado_en: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

export async function restaurarTransferencia(id: string): Promise<void> {
  const db = await createClient(); const user = await exigirUsuario(db);
  const { error } = await db.from("transferencias").update({ eliminado_en: null }).eq("id", id).eq("user_id", user.id);
  if (error) throw errorDeBaseDatos(error);
  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
