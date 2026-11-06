import type { TransaccionConCategoria } from "@/lib/types";
import { normalizarConcepto } from "./classification";

export const DESTINOS_GASTO = ["personal", "pareja", "otros", "sin_clasificar"] as const;
export type DestinoGasto = typeof DESTINOS_GASTO[number];
export const ETIQUETAS_DESTINO: Record<DestinoGasto, string> = {
  personal: "Personal", pareja: "En pareja", otros: "Familia y otros", sin_clasificar: "Por confirmar",
};
export const NOMBRES_DESTINO: Record<DestinoGasto, string> = {
  personal: "En mí", pareja: "En pareja", otros: "Familia y otros", sin_clasificar: "Por aclarar",
};
type Movimiento = Pick<TransaccionConCategoria, "id" | "fecha" | "monto" | "descripcion" | "categoria" | "naturaleza" | "etiquetas" | "eliminado_en">;

/** La etiqueta expresa para quién fue; la categoría expresa en qué se gastó. */
export function destinoDelGasto(t: Pick<Movimiento, "etiquetas" | "categoria" | "naturaleza">): DestinoGasto {
  const etiquetas = (t.etiquetas ?? []).map(normalizarConcepto);
  const explicito = DESTINOS_GASTO.find(d => etiquetas.includes(normalizarConcepto(ETIQUETAS_DESTINO[d])));
  if (explicito) return explicito;
  const categoria = normalizarConcepto(t.categoria?.nombre ?? "");
  if (categoria === "salidas en pareja") return "pareja";
  if (/familia|regalos/.test(categoria)) return "otros";
  if (t.naturaleza === "egreso_pendiente" || /identificar|aclarar/.test(categoria)) return "sin_clasificar";
  return "personal";
}

export function etiquetasConDestino(etiquetas: string[], destino: DestinoGasto): string[] {
  const reservadas = Object.values(ETIQUETAS_DESTINO).map(normalizarConcepto);
  return [...etiquetas.filter(e => e.trim() && !reservadas.includes(normalizarConcepto(e))), ETIQUETAS_DESTINO[destino]];
}

export function resumirGastosPorDestino(filas: Movimiento[], desde: string, finExclusivo: string) {
  const grupos = Object.fromEntries(DESTINOS_GASTO.map(d => [d, { total: 0, cantidad: 0, movimientos: [] as { id: string; fecha: string; concepto: string; categoria: string; monto: number }[] }])) as Record<DestinoGasto, { total: number; cantidad: number; movimientos: { id: string; fecha: string; concepto: string; categoria: string; monto: number }[] }>;
  for (const t of filas) {
    const naturaleza = t.naturaleza ?? t.categoria?.tipo;
    if (t.eliminado_en || t.fecha < desde || t.fecha >= finExclusivo || !["egreso", "egreso_pendiente"].includes(naturaleza ?? "")) continue;
    const g = grupos[destinoDelGasto(t)];
    g.total += Math.round(Number(t.monto) * 100); g.cantidad++;
    g.movimientos.push({ id: t.id, fecha: t.fecha, concepto: t.descripcion || t.categoria?.nombre || "Sin concepto", categoria: t.categoria?.nombre || "Sin categoría", monto: Number(t.monto) });
  }
  for (const g of Object.values(grupos)) { g.total /= 100; g.movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.monto - a.monto); }
  return grupos;
}

export type ResumenGastosDestino = ReturnType<typeof resumirGastosPorDestino>;
