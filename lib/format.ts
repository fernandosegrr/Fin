// Asume pesos mexicanos (MXN), acorde a la zona horaria de referencia
// America/Mexico_City. Cambia `currency` aquí si no aplica.
const FORMATO_MONEDA = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

export function formatearMonto(monto: number): string {
  return FORMATO_MONEDA.format(monto);
}

/**
 * PostgREST a veces entrega `numeric` como string. Sumar sin convertir
 * concatena ("0" + "100" = "0100") y los totales del mes salen basura.
 */
export function aNumero(valor: unknown): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : 0;
}

export function redondearMonto(valor: number): number {
  return Math.sign(valor) * Math.round((Math.abs(valor) + Number.EPSILON) * 100) / 100;
}

/** Decimal exacto: no acepta sufijos, notación exponencial ni separadores ambiguos. */
export function parsearMonto(texto: string): number {
  const normalizado = texto.trim().replace(",", ".");
  if (!/^-?(?:\d+|\d*\.\d{1,2})$/.test(normalizado)) return NaN;
  const valor = Number(normalizado);
  return Number.isFinite(valor) && Math.abs(valor) <= Number.MAX_SAFE_INTEGER / 100 ? valor : NaN;
}

/**
 * Mayúscula solo en la primera letra ("julio de 2026" → "Julio de 2026").
 * La clase de Tailwind `capitalize` pone mayúscula en CADA palabra (incluida
 * "de"), que es incorrecto en español — por eso esto se hace en JS.
 */
export function capitalizarPrimeraLetra(texto: string): string {
  return texto.length === 0 ? texto : texto.charAt(0).toUpperCase() + texto.slice(1);
}
