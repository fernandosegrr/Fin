import type { GastoRecurrente } from "@/lib/types";

export function calcularMargenRegistrado(disponible: number, recurrentes: GastoRecurrente[], cobrados: string[], anio: number, mes: number, fecha: string) {
  const [ay, mm, dia] = fecha.split("-").map(Number);
  if (ay !== anio || mm !== mes) return null;
  const pendientes = recurrentes.filter(g => !cobrados.includes(g.id));
  const comprometido = Math.round(pendientes.reduce((s, g) => s + Number(g.monto), 0) * 100) / 100;
  const diasRestantes = new Date(Date.UTC(anio, mes, 0)).getUTCDate() - dia + 1;
  const margen = Math.max(0, Math.round((disponible - comprometido) * 100) / 100);
  return { disponible, comprometido, pendientes: pendientes.map(g => ({ nombre: g.nombre, monto: Number(g.monto), dia: g.dia_cobro })), diasRestantes, margenHastaFinDeMes: margen, ritmo7Dias: Math.floor(margen * Math.min(7, diasRestantes) / diasRestantes * 100) / 100 };
}
