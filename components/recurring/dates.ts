export function diaCobroEnMes(anio: number, mes: number, diaCobro: number): number {
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return Math.min(Math.max(1, diaCobro), ultimoDia);
}

export function fechaCobroEnMesVisto(
  anio: number,
  mes: number,
  diaCobro: number,
  esMesEnCurso: boolean,
  fechaHoy: string,
): string {
  if (esMesEnCurso) return fechaHoy;
  const dia = diaCobroEnMes(anio, mes, diaCobro);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
