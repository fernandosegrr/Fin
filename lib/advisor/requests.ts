import type { SupabaseServerClient, ResultadoMensajeAsesor } from "./types";

export type AccionAsesor = { clave: string; herramienta: string; estado: "iniciada" | "realizada" | "fallida"; resultado?: string };
export function resumenAcciones(acciones: AccionAsesor[]): string {
  return acciones.map(a => `- ${a.estado === "realizada" ? "Guardado" : a.estado === "fallida" ? "Sin completar" : "Resultado por confirmar"}: ${a.resultado || a.herramienta.replaceAll("_", " ")}`).join("\n");
}

export async function iniciarSolicitud(db: SupabaseServerClient, userId: string, id: string, contenido: string): Promise<{ continuar: true; reintento: boolean } | { continuar: false; resultado: ResultadoMensajeAsesor }> {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return { continuar: false, resultado: { ok: false, error: "La solicitud no es válida." } };
  const { data, error } = await db.from("solicitudes_asesor").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    if (data.contenido !== contenido) return { continuar: false, resultado: { ok: false, error: "Esa solicitud corresponde a otro mensaje." } };
    const acciones = (data.acciones || []) as AccionAsesor[];
    const interrumpida = data.estado === "procesando" && Date.now() - Date.parse(data.actualizado_en) > 5 * 60 * 1000;
    if (data.estado === "completado" || ((data.estado === "error" || interrumpida) && acciones.length)) {
      const respuesta = data.respuesta || `Resultado del intento anterior:\n\n${resumenAcciones(acciones)}\n\nLas acciones no se repitieron. Puedes revisar el historial actualizado.`;
      return { continuar: false, resultado: { ok: true, datosModificados: acciones.some(a => a.estado !== "fallida"), mensajeAsistente: { id: data.mensaje_id || `solicitud-${id}`, rol: "asistente", contenido: respuesta, creado_en: data.actualizado_en } } };
    }
    if (data.estado === "procesando" && !interrumpida) return { continuar: false, resultado: { ok: false, error: "Este mensaje ya está en proceso. Espera la respuesta; no se ha enviado de nuevo." } };
    const bloqueo = await db.from("solicitudes_asesor").update({ estado: "procesando", actualizado_en: new Date().toISOString() }).eq("id", id).eq("estado", data.estado).eq("actualizado_en", data.actualizado_en).select("id").maybeSingle();
    if (bloqueo.error) throw new Error(bloqueo.error.message);
    if (!bloqueo.data) return { continuar: false, resultado: { ok: false, error: "Ese mensaje ya está en proceso." } };
    return { continuar: true, reintento: true };
  }
  const insertar = await db.from("solicitudes_asesor").insert({ id, user_id: userId, contenido });
  if (insertar.error?.code === "23505") return { continuar: false, resultado: { ok: false, error: "Ese mensaje ya está en proceso." } };
  if (insertar.error) throw new Error(insertar.error.message);
  return { continuar: true, reintento: false };
}

export async function guardarAcciones(db: SupabaseServerClient, id: string, acciones: AccionAsesor[]) {
  const r = await db.from("solicitudes_asesor").update({ acciones, actualizado_en: new Date().toISOString() }).eq("id", id);
  if (r.error) throw new Error("No se pudo confirmar el estado de la acción. Revisa el historial antes de repetirla.");
}

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordenar(v)]));
  return valor;
}
export async function claveAccion(solicitud: string, herramienta: string, argumentos: string): Promise<string> {
  const texto = `${solicitud}:${herramienta}:${JSON.stringify(ordenar(JSON.parse(argumentos || "{}")))}`;
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto))).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const s = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
