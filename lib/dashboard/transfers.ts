import { errorDeBaseDatos } from "@/lib/dashboard/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esMetodoPago, fechaOHoy, exigirUsuario } from "@/lib/dashboard/shared";
import { montoPositivo } from "@/lib/dashboard/validation";
import type { MetodoPago } from "@/lib/types";

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
}

export async function crearTransferencia(input: NuevaTransferencia): Promise<void> {
  const monto = montoPositivo(input.monto);
  if (!esMetodoPago(input.origen) || !esMetodoPago(input.destino)) {
    throw new Error("El método de pago no es válido.");
  }
  if (input.origen === input.destino) {
    throw new Error("Elige dos métodos de pago distintos.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase.from("transferencias").insert({
    user_id: user.id,
    monto,
    origen: input.origen,
    destino: input.destino,
    fecha: fechaOHoy(input.fecha),
    descripcion: input.descripcion?.trim() || null,
  });

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

export interface ActualizarTransferenciaInput {
  monto: number;
  origen: MetodoPago;
  destino: MetodoPago;
  descripcion?: string | null;
  fecha?: string;
}

export async function actualizarTransferencia(
  id: string,
  input: ActualizarTransferenciaInput,
): Promise<void> {
  if (!id) throw new Error("ID de traspaso inválido.");
  const monto = montoPositivo(input.monto);
  if (!esMetodoPago(input.origen) || !esMetodoPago(input.destino)) {
    throw new Error("El método de pago no es válido.");
  }
  if (input.origen === input.destino) {
    throw new Error("Elige dos métodos de pago distintos.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase
    .from("transferencias")
    .update({
      monto,
      origen: input.origen,
      destino: input.destino,
      descripcion: input.descripcion?.trim() || null,
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
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw errorDeBaseDatos(error);

  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
