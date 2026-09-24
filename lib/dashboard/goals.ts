import { errorDeBaseDatos } from "@/lib/dashboard/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esFechaISO } from "@/lib/dates";
import { aNumero, redondearMonto } from "@/lib/format";
import { exigirUsuario } from "@/lib/dashboard/shared";
import type { MetaAhorro } from "@/lib/types";

// META DE AHORRO
// ─────────────────────────────────────────────

export async function obtenerMetaAhorro(): Promise<MetaAhorro | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("metas_ahorro")
    .select("id, nombre, monto_objetivo, fecha_limite")
    .maybeSingle();
  if (error) {
    if (/metas_ahorro/i.test(error.message) &&
      /could not find .* in the schema cache|relation .* does not exist/i.test(error.message)) return null;
    throw new Error(`No se pudo cargar la meta de ahorro: ${error.message}`, { cause: error });
  }
  if (!data) return null;
  return {
    id: data.id as string,
    nombre: data.nombre as string,
    monto_objetivo: aNumero(data.monto_objetivo),
    fecha_limite: (data.fecha_limite as string | null) ?? null,
  };
}

export type ResultadoMetaAhorro = { ok: true; meta: MetaAhorro } | { ok: false; error: string };

export async function guardarMetaAhorro(input: {
  nombre: string;
  monto_objetivo: number;
  fecha_limite?: string | null;
}): Promise<ResultadoMetaAhorro> {
  try {
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "Ponle un nombre a la meta." };
    if (!Number.isFinite(input.monto_objetivo) || input.monto_objetivo <= 0) {
      return { ok: false, error: "El objetivo debe ser mayor a 0." };
    }
    const fechaLimite = input.fecha_limite?.trim() || null;
    if (fechaLimite && !esFechaISO(fechaLimite)) return { ok: false, error: "La fecha límite no es válida." };

    const supabase = await createClient();
    const user = await exigirUsuario(supabase);
    const payload = {
      user_id: user.id,
      nombre,
      monto_objetivo: redondearMonto(input.monto_objetivo),
      fecha_limite: fechaLimite,
    };

    const { data: existente, error: errorConsulta } = await supabase.from("metas_ahorro").select("id").eq("user_id", user.id).maybeSingle();
    if (errorConsulta) throw errorDeBaseDatos(errorConsulta);
    const query = existente
      ? supabase.from("metas_ahorro").update(payload).eq("id", existente.id)
      : supabase.from("metas_ahorro").insert(payload);

    const { data, error } = await query.select("id, nombre, monto_objetivo, fecha_limite").single();
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard");
    return {
      ok: true,
      meta: {
        id: data.id as string,
        nombre: data.nombre as string,
        monto_objetivo: aNumero(data.monto_objetivo),
        fecha_limite: (data.fecha_limite as string | null) ?? null,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar la meta." };
  }
}

export async function eliminarMetaAhorro(): Promise<void> {
  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  const { error } = await supabase.from("metas_ahorro").delete().eq("user_id", user.id);
  if (error) throw errorDeBaseDatos(error);
  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
