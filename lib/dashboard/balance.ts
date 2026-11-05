import { createClient } from "@/lib/supabase/server";
import { esMesCalendario, hoyEnMexico, hoyISOEnMexico, nombreDelMes, rangoDelMes } from "@/lib/dates";
import { aNumero, redondearMonto } from "@/lib/format";
import { traerTodasLasFilas } from "@/lib/supabase/paginar";
import { esErrorEsquemaClientes } from "@/lib/dashboard/shared";
import { aplicarTransferencias, calcularTotalesDetallados, type FilaParaTotales } from "@/lib/dashboard/calculations";
import type { ResumenMes, TransaccionConCategoria, Transferencia } from "@/lib/types";
import type { ClienteSupabase } from "@/lib/dashboard/shared";
import { obtenerCuentas } from "@/lib/dashboard/accounts";
import { resumirLibro, naturalezaDe } from "@/lib/finance/ledger";
import type { FilaFinanciera } from "@/lib/finance/types";

// BALANCE MENSUAL
// ─────────────────────────────────────────────

const SELECT_TOTALES =
  "monto, metodo_pago, gasto_recurrente_id, cliente_id, categoria:categorias(id, nombre, tipo, grupo), cliente:clientes(id, nombre)";
const SELECT_TOTALES_SIN_CLIENTE =
  "monto, metodo_pago, gasto_recurrente_id, categoria:categorias(id, nombre, tipo, grupo)";
const SELECT_LISTA =
  "*, categoria:categorias(id, nombre, tipo, grupo), cliente:clientes(id, nombre)";
const SELECT_LISTA_SIN_CLIENTE = "*, categoria:categorias(id, nombre, tipo, grupo)";

async function filasTotalesDelRango(
  supabase: ClienteSupabase,
  inicio: string,
  fin: string,
  mensajeError: string,
): Promise<FilaParaTotales[]> {
  try {
    return await traerTodasLasFilas<FilaParaTotales>(
      (desde, hasta) =>
        supabase.from("transacciones").select(SELECT_TOTALES).gte("fecha", inicio).lt("fecha", fin).range(desde, hasta),
      mensajeError,
    );
  } catch (err) {
    if (!esErrorEsquemaClientes(err instanceof Error ? err.message : String(err))) throw err;
    return traerTodasLasFilas<FilaParaTotales>(
      (desde, hasta) =>
        supabase
          .from("transacciones")
          .select(SELECT_TOTALES_SIN_CLIENTE)
          .gte("fecha", inicio)
          .lt("fecha", fin)
          .range(desde, hasta),
      mensajeError,
    );
  }
}

type SaldosHistoricos = { total: number; efectivo: number; tarjeta: number };

/**
 * Calcula el saldo histórico acumulado (suma de ingresos - egresos - traspasos
 * de TODO lo ocurrido ANTES de fechaLimite), separado por método de pago,
 * usando agregación en la base de datos para evitar cargar miles de filas.
 *
 * Esto es lo que hace que "Efectivo" y "Tarjeta" sean saldos reales que se
 * arrastran mes a mes (igual que el Saldo Total Disponible), en vez de
 * reiniciarse a los movimientos del mes en curso.
 */
async function calcularSaldosHistoricos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fechaLimite: string,
): Promise<SaldosHistoricos> {
  // Un fallo aquí no equivale a saldo cero: mostrarlo así daría información
  // financiera incorrecta. La carga inicial reintenta esta lectura.
  const { data, error } = await supabase
    .rpc("calcular_saldo_historico", { p_fecha_limite: fechaLimite })
    .single();
  if (error) throw new Error(`No se pudo calcular el saldo histórico: ${error.message}`, { cause: error });

  const fila = data as unknown as { efectivo: number | string; tarjeta: number | string };
  const efectivo = redondearMonto(aNumero(fila.efectivo));
  const tarjeta = redondearMonto(aNumero(fila.tarjeta));
  return { total: redondearMonto(efectivo + tarjeta), efectivo, tarjeta };
}

export interface BalanceMensual {
  actual: ResumenMes & {
    nombreMes: string;
    transacciones: TransaccionConCategoria[];
    /** Total real de movimientos del mes (puede ser mayor que `transacciones.length` si se alcanzó el límite de 200). */
    totalTransaccionesMes: number;
  };
}

/**
 * Todas las transacciones del mes, SIN el límite de 200 filas de
 * `obtenerBalanceMensual` (esa limita por rendimiento de la vista principal).
 * Se usa solo bajo demanda para exportar a CSV, donde sí importa traer el
 * mes completo.
 */
export async function obtenerTransaccionesCompletasDelMes(
  anio: number,
  mes: number,
): Promise<TransaccionConCategoria[]> {
  const supabase = await createClient();
  const rango = rangoDelMes(anio, mes);

  return traerTodasLasFilas<TransaccionConCategoria>(
    (desde, hasta) =>
      supabase
        .from("transacciones")
        .select(SELECT_LISTA)
        .is("eliminado_en", null)
        .gte("fecha", rango.inicio)
        .lt("fecha", rango.finExclusivo)
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false })
        .range(desde, hasta),
    "No se pudieron cargar las transacciones del mes",
  );
}

export async function obtenerTransferenciasCompletasDelMes(
  anio: number,
  mes: number,
): Promise<Transferencia[]> {
  const supabase = await createClient();
  const rango = rangoDelMes(anio, mes);

  return traerTodasLasFilas<Transferencia>(
    (desde, hasta) =>
      supabase
        .from("transferencias")
        .select("*")
        .is("eliminado_en", null)
        .gte("fecha", rango.inicio)
        .lt("fecha", rango.finExclusivo)
        .order("fecha", { ascending: false })
        .range(desde, hasta),
    "No se pudieron cargar los traspasos del mes",
  );
}

async function obtenerBalanceMensualLegacy(
  anioTarget?: number,
  mesTarget?: number,
): Promise<BalanceMensual> {
  const supabase = await createClient();
  const hoy = hoyEnMexico();
  const anio = anioTarget ?? hoy.anio;
  const mes = mesTarget ?? hoy.mes;
  if (!esMesCalendario(anio, mes)) throw new Error("Selecciona un mes válido entre 2000 y 2100.");

  const rangoActual = rangoDelMes(anio, mes);

  // Cargamos, todo en paralelo:
  // - la LISTA de transacciones del mes actual a mostrar (limitada a 200 filas
  //   por rendimiento de UI — NO se usa para calcular totales, ver abajo)
  // - los TOTALES del mes actual, sin límite de filas (monto+metodo+tipo nada más)
  // - los traspasos del mes actual
  // - el saldo histórico acumulado por método, agregado en la base de datos
  const [resListaInicial, filasTotalesActual, transferenciasActual, saldosHistoricos] =
    await Promise.all([
      supabase
        .from("transacciones")
        // count: "exact" pide a PostgREST el total real de filas que matchean
        // el filtro (vía header Content-Range) en la MISMA consulta, sin traer
        // más de las 200 que ya limitábamos — así la UI puede avisar si la
        // lista mostrada no es todo el mes, en vez de fallar en silencio.
        .select(SELECT_LISTA, { count: "exact" })
        .gte("fecha", rangoActual.inicio)
        .lt("fecha", rangoActual.finExclusivo)
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false })
        .limit(200),
      filasTotalesDelRango(supabase, rangoActual.inicio, rangoActual.finExclusivo, "No se pudieron calcular los totales del mes"),
      traerTodasLasFilas<Transferencia>(
        (desde, hasta) =>
          supabase
            .from("transferencias")
            .select("*")
            .gte("fecha", rangoActual.inicio)
            .lt("fecha", rangoActual.finExclusivo)
            .order("fecha", { ascending: false })
            .range(desde, hasta),
        "No se pudieron cargar los traspasos",
      ),
      calcularSaldosHistoricos(supabase, rangoActual.inicio),
    ]);

  let resLista = resListaInicial;
  if (resLista.error && esErrorEsquemaClientes(resLista.error.message)) {
    resLista = await supabase
      .from("transacciones")
      .select(SELECT_LISTA_SIN_CLIENTE, { count: "exact" })
      .gte("fecha", rangoActual.inicio)
      .lt("fecha", rangoActual.finExclusivo)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(200);
  }
  if (resLista.error) {
    throw new Error(`No se pudieron cargar las transacciones del mes: ${resLista.error.message}`, { cause: resLista.error });
  }

  const transaccionesActual = (resLista.data ?? []) as unknown as TransaccionConCategoria[];

  const totalesActual = calcularTotalesDetallados(filasTotalesActual);
  aplicarTransferencias(totalesActual, transferenciasActual);

  const balanceNetoActual = totalesActual.ingresos - totalesActual.egresos;

  return {
    actual: {
      anio,
      mes,
      nombreMes: nombreDelMes(anio, mes),
      ingresos: totalesActual.ingresos,
      egresos: totalesActual.egresos,
      balance: balanceNetoActual,
      saldoInicial: saldosHistoricos.total,
      saldoTotalDisponible: redondearMonto(saldosHistoricos.total + balanceNetoActual),
      totalesEfectivo: {
        ...totalesActual.efectivo,
        saldo: redondearMonto(saldosHistoricos.efectivo + totalesActual.efectivo.neto),
      },
      totalesTarjeta: {
        ...totalesActual.tarjeta,
        saldo: redondearMonto(saldosHistoricos.tarjeta + totalesActual.tarjeta.neto),
      },
      transferencias: transferenciasActual,
      egresosFijos: totalesActual.egresosFijos,
      egresosVariables: totalesActual.egresosVariables,
      egresosPorCategoria: totalesActual.egresosPorCategoria,
      ingresosPorCliente: totalesActual.ingresosPorCliente,
      recurrentesCobrados: totalesActual.recurrentesCobrados,
      transacciones: transaccionesActual,
      totalTransaccionesMes: resLista.count ?? transaccionesActual.length,
    },
  };
}

export async function obtenerBalanceMensual(anioTarget?: number, mesTarget?: number): Promise<BalanceMensual> {
  const hoy = hoyEnMexico(); const anio = anioTarget ?? hoy.anio; const mes = mesTarget ?? hoy.mes;
  if (!esMesCalendario(anio, mes)) throw new Error("Selecciona un mes válido entre 2000 y 2100.");
  const db = await createClient(); const rango = rangoDelMes(anio, mes);
  let cuentas;
  try { cuentas = await obtenerCuentas(); }
  catch (error) {
    // Compatibilidad durante el despliegue aditivo; nunca convertir un fallo de red en saldo cero.
    if (/cuentas_financieras.*(?:schema cache|does not exist)|could not find.*cuentas_financieras/i.test(String(error))) return obtenerBalanceMensualLegacy(anio, mes);
    throw error;
  }
  const [filas, transferencias] = await Promise.all([
    traerTodasLasFilas<FilaFinanciera>((desde, hasta) => db.from("transacciones").select(SELECT_LISTA).is("eliminado_en", null).lt("fecha", rango.finExclusivo).order("fecha", { ascending: false }).order("creado_en", { ascending: false }).order("id").range(desde, hasta), "No se pudo calcular el historial financiero completo"),
    traerTodasLasFilas<Transferencia>((desde, hasta) => db.from("transferencias").select("*").is("eliminado_en", null).lt("fecha", rango.finExclusivo).order("fecha", { ascending: false }).order("id").range(desde, hasta), "No se pudieron cargar los traspasos"),
  ]);
  const finanzas = resumirLibro(cuentas, filas, transferencias, rango.inicio, rango.finExclusivo);
  const { estimarRendimientosPendientes } = await import("@/lib/finance/returns");
  const fechaHoy = hoyISOEnMexico();
  const ultimoDia = new Date(`${rango.finExclusivo}T12:00:00Z`); ultimoDia.setUTCDate(ultimoDia.getUTCDate() - 1);
  finanzas.estimacionRendimientos = estimarRendimientosPendientes(cuentas, filas, transferencias, fechaHoy < rango.finExclusivo ? fechaHoy : ultimoDia.toISOString().slice(0, 10));
  const delMes = filas.filter(t => t.fecha >= rango.inicio);
  const traspasosDelMes = transferencias.filter(t => t.fecha >= rango.inicio);
  const totales = calcularTotalesDetallados(delMes);
  const porMetodo = (metodo: "efectivo" | "tarjeta") => {
    const seleccion = finanzas.cuentas.filter(c => c.metodo_pago === metodo && !c.excluida_disponible);
    return { ingresos: totales[metodo].ingresos, egresos: totales[metodo].egresos, neto: redondearMonto(seleccion.reduce((s, c) => s + c.variacion, 0)), saldo: redondearMonto(seleccion.reduce((s, c) => s + c.saldo, 0)) };
  };
  const ingresos = redondearMonto(finanzas.ingresosTrabajo + finanzas.apoyos + finanzas.rendimientosNetos);
  const egresos = redondearMonto(finanzas.consumo - finanzas.reembolsos);
  const impuestoSeparado = delMes.filter(t => naturalezaDe(t) === "retencion").reduce((s, t) => s + aNumero(t.monto), 0);
  return { actual: {
    anio, mes, nombreMes: nombreDelMes(anio, mes), ingresos, egresos,
    balance: redondearMonto(ingresos - egresos - impuestoSeparado),
    saldoInicial: redondearMonto(finanzas.cuentas.filter(c => !c.excluida_disponible).reduce((s, c) => s + c.saldoInicial, 0)),
    saldoTotalDisponible: finanzas.disponible, totalesEfectivo: porMetodo("efectivo"), totalesTarjeta: porMetodo("tarjeta"),
    transferencias: traspasosDelMes, egresosFijos: totales.egresosFijos, egresosVariables: totales.egresosVariables,
    egresosPorCategoria: totales.egresosPorCategoria, ingresosPorCliente: totales.ingresosPorCliente,
    recurrentesCobrados: totales.recurrentesCobrados, transacciones: delMes, totalTransaccionesMes: delMes.length,
    finanzas,
  } };
}

// ─────────────────────────────────────────────
