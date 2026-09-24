import { createClient } from "@/lib/supabase/server";
import { MENSAJES_HISTORIAL_UI } from "./config";
import { textoDeError } from "./utils";
import type { ResultadoHistorialAsesor, ResultadoBorrarHistorialAsesor } from "./types";
import type { MensajeAsesor } from "@/lib/types";

export async function obtenerHistorialAsesor(): Promise<ResultadoHistorialAsesor> {
  try {
    const supabase = await createClient();

    // Sin getUser(): lectura, RLS ya filtra por auth.uid() (mismo criterio que
    // obtenerCategorias/obtenerGastosRecurrentes en actions.ts).
    const { data, error } = await supabase
      .from("mensajes_asesor")
      .select("id, rol, contenido, creado_en")
      .order("creado_en", { ascending: false })
      .limit(MENSAJES_HISTORIAL_UI);

    if (error) return { ok: false, error: `No se pudo cargar el historial del asesor: ${error.message}` };
    return { ok: true, mensajes: ((data ?? []) as MensajeAsesor[]).reverse() };
  } catch (err) {
    console.error("Error cargando el historial del asesor:", err);
    return { ok: false, error: textoDeError(err, "No se pudo cargar el historial del asesor.") };
  }
}

export async function borrarHistorialAsesor(): Promise<ResultadoBorrarHistorialAsesor> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };

    const { error } = await supabase.from("mensajes_asesor").delete().eq("user_id", user.id);
    if (error) return { ok: false, error: `No se pudo borrar el historial: ${error.message}` };
    return { ok: true };
  } catch (err) {
    console.error("Error borrando el historial del asesor:", err);
    return { ok: false, error: textoDeError(err, "No se pudo borrar el historial.") };
  }
}

// ─────────────────────────────────────────────
// TENDENCIA MENSUAL (interna — resumen agregado, nunca transacciones crudas)
// ─────────────────────────────────────────────
