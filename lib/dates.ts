export const ZONA_HORARIA = "America/Mexico_City";

interface FechaYMD {
  anio: number;
  mes: number; // 1-12
  dia: number;
}

export function hoyEnMexico(): FechaYMD {
  const formateador = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const partes = formateador.formatToParts(new Date());
  const obtener = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value);
  return { anio: obtener("year"), mes: obtener("month"), dia: obtener("day") };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function hoyISOEnMexico(): string {
  const { anio, mes, dia } = hoyEnMexico();
  return `${anio}-${pad2(mes)}-${pad2(dia)}`;
}

export function primerDiaDelMes(anio: number, mes: number): string {
  return `${anio}-${pad2(mes)}-01`;
}

export function mesAnterior(
  anio: number,
  mes: number,
): { anio: number; mes: number } {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
}

export function mesSiguiente(
  anio: number,
  mes: number,
): { anio: number; mes: number } {
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
}

export function rangoDelMes(
  anio: number,
  mes: number,
): { inicio: string; finExclusivo: string } {
  const siguiente = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
  return {
    inicio: primerDiaDelMes(anio, mes),
    finExclusivo: primerDiaDelMes(siguiente.anio, siguiente.mes),
  };
}

/**
 * Días transcurridos de `anio`/`mes` para promediar gasto diario: si es el mes
 * en curso, el día de hoy (en México); si ya cerró (o es futuro), el total de
 * días de ese mes — no tiene sentido dividir entre "hoy" cuando se está
 * viendo un mes distinto al actual.
 */
export function diasTranscurridosEnMes(anio: number, mes: number): number {
  const hoy = hoyEnMexico();
  if (anio === hoy.anio && mes === hoy.mes) return hoy.dia;
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

const FORMATO_NOMBRE_MES = new Intl.DateTimeFormat("es-MX", {
  month: "long",
  year: "numeric",
  timeZone: ZONA_HORARIA,
});

export function nombreDelMes(anio: number, mes: number): string {
  const fecha = new Date(Date.UTC(anio, mes - 1, 15, 12));
  return FORMATO_NOMBRE_MES.format(fecha);
}

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function formatearFechaCorta(fechaISO: string): string {
  const [, mesStr, diaStr] = fechaISO.split("-");
  const mes = Number(mesStr);
  const dia = Number(diaStr);
  return `${dia} ${MESES_CORTOS[mes - 1]}`;
}
