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
 * Mayúscula solo en la primera letra ("julio de 2026" → "Julio de 2026").
 * La clase de Tailwind `capitalize` pone mayúscula en CADA palabra (incluida
 * "de"), que es incorrecto en español — por eso esto se hace en JS.
 */
export function capitalizarPrimeraLetra(texto: string): string {
  return texto.length === 0 ? texto : texto.charAt(0).toUpperCase() + texto.slice(1);
}
