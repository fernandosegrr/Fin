import { mesAnterior, mesSiguiente, nombreDelMes, primerDiaDelMes } from "@/lib/dates";
import { aNumero, redondearMonto } from "@/lib/format";
import { traerTodasLasFilas } from "@/lib/supabase/paginar";
import { MESES_TENDENCIA } from "./config";
import type { SupabaseServerClient } from "./types";
import type { TipoCategoria } from "@/lib/types";

export interface PuntoTendenciaMensual {
  nombreMes: string;
  ingresos: number;
  egresos: number;
}

type FilaTendencia = { monto: number; fecha: string; categoria: { tipo: TipoCategoria } | null };

/**
 * Últimos `MESES_TENDENCIA` meses TERMINANDO en el mes que el usuario tiene
 * en pantalla (no en el mes de hoy): si está viendo julio, la tendencia que
 * ve el asesor es abr-jul, no jun-sep.
 */
export async function obtenerTendenciaMensual(
  supabase: SupabaseServerClient,
  anioFin: number,
  mesFin: number,
): Promise<PuntoTendenciaMensual[]> {
  let anio = anioFin;
  let mes = mesFin;
  for (let i = 0; i < MESES_TENDENCIA - 1; i++) ({ anio, mes } = mesAnterior(anio, mes));
  const inicio = primerDiaDelMes(anio, mes);
  const siguienteAlFin = mesSiguiente(anioFin, mesFin);
  const finExclusivo = primerDiaDelMes(siguienteAlFin.anio, siguienteAlFin.mes);

  const filas = await traerTodasLasFilas<FilaTendencia>(
    (desde, hasta) =>
      supabase
        .from("transacciones")
        .select("monto, fecha, categoria:categorias(tipo)")
        .gte("fecha", inicio)
        .lt("fecha", finExclusivo)
        .order("fecha", { ascending: true })
        .range(desde, hasta),
    "No se pudo calcular la tendencia mensual",
  );

  const buckets = new Map<string, { ingresos: number; egresos: number }>();
  for (const fila of filas) {
    const [a, m] = fila.fecha.split("-");
    const clave = `${Number(a)}-${Number(m)}`;
    if (!buckets.has(clave)) buckets.set(clave, { ingresos: 0, egresos: 0 });
    const b = buckets.get(clave)!;
    const monto = aNumero(fila.monto);
    if (fila.categoria?.tipo === "ingreso") b.ingresos += monto;
    else if (fila.categoria?.tipo === "egreso") b.egresos += monto;
  }

  // Incluye meses en cero: si no, el asesor ve "3 meses" cuando en realidad
  // uno de los 4 no tuvo movimientos y razona una tendencia incompleta.
  const puntos: PuntoTendenciaMensual[] = [];
  let cursorAnio = anio;
  let cursorMes = mes;
  for (let i = 0; i < MESES_TENDENCIA; i++) {
    const b = buckets.get(`${cursorAnio}-${cursorMes}`);
    puntos.push({
      nombreMes: nombreDelMes(cursorAnio, cursorMes),
      ingresos: redondearMonto(b?.ingresos ?? 0),
      egresos: redondearMonto(b?.egresos ?? 0),
    });
    ({ anio: cursorAnio, mes: cursorMes } = mesSiguiente(cursorAnio, cursorMes));
  }
  return puntos;
}

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────
