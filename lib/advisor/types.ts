import type { MensajeAsesor } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export type ResultadoHistorialAsesor =
  | { ok: true; mensajes: MensajeAsesor[] }
  | { ok: false; error: string };

export type ResultadoMensajeAsesor =
  | { ok: true; mensajeAsistente: MensajeAsesor; datosModificados?: boolean }
  | { ok: false; error: string };

export type ResultadoBorrarHistorialAsesor = { ok: true } | { ok: false; error: string };

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
