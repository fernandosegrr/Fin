
export function textoDeError(err: unknown, porDefecto: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return porDefecto;
}

/** Nombres/notas van al system prompt: se recortan y se quitan controles para no inyectar instrucciones. */
export function sanitizarDato(texto: string, max = 80): string {
  return texto
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// ─────────────────────────────────────────────
// LECTURA
// ─────────────────────────────────────────────
