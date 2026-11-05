import type { MensajeAsesor } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export type ResultadoHistorialAsesor =
  | { ok: true; mensajes: MensajeAsesor[]; hayMas?: boolean; cursorAnterior?: { creado_en: string; id: string } | null }
  | { ok: false; error: string; datosModificados?: boolean };

export type ResultadoMensajeAsesor =
  | { ok: true; mensajeAsistente: MensajeAsesor; datosModificados?: boolean }
  | { ok: false; error: string; datosModificados?: boolean };

export type ResultadoBorrarHistorialAsesor = { ok: true } | { ok: false; error: string };

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
