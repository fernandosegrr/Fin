/** Reintentos acotados para lecturas idempotentes de Supabase. */
const ESPERAS_MS = [400, 1200, 2400];

export function esErrorTransitorio(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const { status, code, message, cause } = error as {
    status?: number;
    code?: string;
    message?: string;
    cause?: unknown;
  };

  if (status === 408 || status === 425 || status === 429 || (status !== undefined && status >= 500)) {
    return true;
  }
  if (code && (/^08/.test(code) || /^PGRST00[0-3]$/.test(code) || ["53300", "57P03", "ETIMEDOUT", "ECONNRESET"].includes(code))) {
    return true;
  }

  if (typeof message === "string" &&
    /fetch failed|failed to fetch|network|timeout|timed out|connection (?:reset|refused|terminated)|temporar(?:y|ily)|service unavailable|too many requests|could not query the database for the schema cache|\b(?:502|503|504)\b/i.test(message)) {
    return true;
  }
  return cause ? esErrorTransitorio(cause) : false;
}

export async function reintentarLectura<T>(
  leer: () => Promise<T>,
  esperasMs: readonly number[] = ESPERAS_MS,
): Promise<T> {
  for (let intento = 0; ; intento++) {
    try {
      return await leer();
    } catch (error) {
      if (intento >= esperasMs.length || !esErrorTransitorio(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, esperasMs[intento]));
    }
  }
}
