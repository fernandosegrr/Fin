import { createClient } from "@/lib/supabase/server";
import { MENSAJES_HISTORIAL_UI } from "./config";
import { textoDeError } from "./utils";
import type { ResultadoHistorialAsesor, ResultadoBorrarHistorialAsesor } from "./types";
import type { MensajeAsesor } from "@/lib/types";

export async function obtenerHistorialAsesor(cursor?: { creado_en: string; id: string }): Promise<ResultadoHistorialAsesor> {
  try {
    const supabase = await createClient();

    // Sin getUser(): lectura, RLS ya filtra por auth.uid() (mismo criterio que
    // obtenerCategorias/obtenerGastosRecurrentes en actions.ts).
    if (cursor && (!/^\d{4}-\d{2}-\d{2}T[0-9:.+Z-]+$/.test(cursor.creado_en) || !/^[a-f0-9-]{36}$/i.test(cursor.id))) return { ok: false, error: "El cursor del historial no es válido." };
    let consulta = supabase
      .from("mensajes_asesor")
      .select("id, rol, contenido, creado_en")
      .order("creado_en", { ascending: false })
      .order("id", { ascending: false })
      .limit(MENSAJES_HISTORIAL_UI + 1);
    if (cursor) consulta = consulta.or(`creado_en.lt.${cursor.creado_en},and(creado_en.eq.${cursor.creado_en},id.lt.${cursor.id})`);
    const { data, error } = await consulta;

    if (error) return { ok: false, error: `No se pudo cargar el historial del asesor: ${error.message}` };
    const filas = ((data ?? []) as MensajeAsesor[]).slice(0, MENSAJES_HISTORIAL_UI);
    const ultima = filas[filas.length - 1];
    return { ok: true, mensajes: filas.reverse(), hayMas: (data?.length ?? 0) > MENSAJES_HISTORIAL_UI, cursorAnterior: ultima ? { creado_en: ultima.creado_en, id: ultima.id } : null };
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
