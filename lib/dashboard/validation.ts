import { redondearMonto } from "@/lib/format";

/** Normaliza importes antes de escribirlos: un valor que redondea a cero es inválido. */
export function montoPositivo(valor: number): number {
  const monto = redondearMonto(valor);
  if (!Number.isFinite(valor) || monto <= 0) {
    throw new Error("El monto debe ser mayor a 0.");
  }
  return monto;
}
