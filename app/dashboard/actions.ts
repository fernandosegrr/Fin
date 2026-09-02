"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  hoyEnMexico,
  hoyISOEnMexico,
  mesAnterior,
  nombreDelMes,
  primerDiaDelMes,
  rangoDelMes,
} from "@/lib/dates";
import type {
  Categoria,
  GastoRecurrente,
  GrupoCategoria,
  MetodoPago,
  Presupuesto,
  PresupuestoConGasto,
  ResumenMes,
  TipoCategoria,
  Transaccion,
  TransaccionConCategoria,
  Transferencia,
} from "@/lib/types";

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ─────────────────────────────────────────────
// CATEGORÍAS
// ─────────────────────────────────────────────

export async function obtenerCategorias(): Promise<Categoria[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categorias").select("*").order("nombre");

  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  return data ?? [];
}

export interface CrearCategoriaInput {
  nombre: string;
  tipo: TipoCategoria;
  grupo: GrupoCategoria | null;
}

export async function crearCategoria(input: CrearCategoriaInput): Promise<void> {
  if (!input.nombre.trim()) throw new Error("El nombre de la categoría es requerido.");
  if (input.tipo === "egreso" && !input.grupo) {
    throw new Error("Las categorías de egreso deben ser Fijo o Variable.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { error } = await supabase.from("categorias").insert({
    user_id: user.id,
    nombre: input.nombre.trim(),
    tipo: input.tipo,
    grupo: input.tipo === "ingreso" ? null : input.grupo,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export async function eliminarCategoria(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { error } = await supabase
    .from("categorias")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
// TRANSACCIONES
// ─────────────────────────────────────────────

export interface NuevaTransaccion {
  categoria_id: string;
  monto: number;
  descripcion: string | null;
  metodo_pago?: MetodoPago;
  fecha?: string;
  /** Suscripción/gasto recurrente que originó este cobro, si aplica. */
  gasto_recurrente_id?: string | null;
}

export async function crearTransaccion(input: NuevaTransaccion): Promise<void> {
  if (!input.categoria_id) {
    throw new Error("Selecciona una categoría.");
  }
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    throw new Error("El monto debe ser mayor a 0.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { error } = await supabase.from("transacciones").insert({
    user_id: user.id,
    categoria_id: input.categoria_id,
    monto: input.monto,
    fecha: input.fecha || hoyISOEnMexico(),
    descripcion: input.descripcion?.trim() || null,
    metodo_pago: input.metodo_pago ?? "tarjeta",
    gasto_recurrente_id: input.gasto_recurrente_id ?? null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export interface ActualizarTransaccionInput {
  categoria_id: string;
  monto: number;
  descripcion: string | null;
  metodo_pago?: MetodoPago;
  fecha?: string;
}

export async function actualizarTransaccion(
  id: string,
  input: ActualizarTransaccionInput,
): Promise<void> {
  if (!id) throw new Error("ID de transacción inválido.");
  if (!input.categoria_id) throw new Error("Selecciona una categoría.");
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    throw new Error("El monto debe ser mayor a 0.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { error } = await supabase
    .from("transacciones")
    .update({
      categoria_id: input.categoria_id,
      monto: input.monto,
      descripcion: input.descripcion?.trim() || null,
      metodo_pago: input.metodo_pago ?? "tarjeta",
      ...(input.fecha ? { fecha: input.fecha } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export async function eliminarTransaccion(id: string): Promise<void> {
  if (!id) throw new Error("ID de transacción inválido.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { error } = await supabase
    .from("transacciones")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
// TRASPASOS ENTRE MÉTODOS DE PAGO (Efectivo ⇄ Tarjeta)
// ─────────────────────────────────────────────
// Un traspaso mueve saldo de un método a otro. No es ingreso ni egreso: el
// patrimonio total no cambia, por eso vive en su propia tabla y no toca
// categorías, presupuestos ni los totales de ingresos/egresos.

export interface NuevaTransferencia {
  monto: number;
  origen: MetodoPago;
  destino: MetodoPago;
  descripcion?: string | null;
  fecha?: string;
}

export async function crearTransferencia(input: NuevaTransferencia): Promise<void> {
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    throw new Error("El monto debe ser mayor a 0.");
  }
  if (input.origen === input.destino) {
    throw new Error("Elige dos métodos de pago distintos.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { error } = await supabase.from("transferencias").insert({
    user_id: user.id,
    monto: input.monto,
    origen: input.origen,
    destino: input.destino,
    fecha: input.fecha || hoyISOEnMexico(),
    descripcion: input.descripcion?.trim() || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
// BALANCE MENSUAL
// ─────────────────────────────────────────────

type TotalesCalculados = {
  ingresos: number;
  egresos: number;
  efectivo: { ingresos: number; egresos: number; neto: number };
  tarjeta: { ingresos: number; egresos: number; neto: number };
};

function calcularTotalesDetallados(
  filas: { monto: number; metodo_pago?: MetodoPago; categoria: { tipo: TipoCategoria } | null }[],
): TotalesCalculados {
  let ingresos = 0;
  let egresos = 0;

  const efectivo = { ingresos: 0, egresos: 0, neto: 0 };
  const tarjeta = { ingresos: 0, egresos: 0, neto: 0 };

  for (const fila of filas) {
    const esEfectivo = fila.metodo_pago === "efectivo";
    if (fila.categoria?.tipo === "ingreso") {
      ingresos += fila.monto;
      if (esEfectivo) efectivo.ingresos += fila.monto;
      else tarjeta.ingresos += fila.monto;
    } else if (fila.categoria?.tipo === "egreso") {
      egresos += fila.monto;
      if (esEfectivo) efectivo.egresos += fila.monto;
      else tarjeta.egresos += fila.monto;
    }
  }

  efectivo.neto = efectivo.ingresos - efectivo.egresos;
  tarjeta.neto = tarjeta.ingresos - tarjeta.egresos;

  return { ingresos, egresos, efectivo, tarjeta };
}

/**
 * Aplica traspasos entre métodos de pago al `neto` por método, in place.
 * Un traspaso NO es ingreso ni egreso (no toca `ingresos`/`egresos` totales):
 * solo mueve saldo de un método al otro, así que su efecto neto combinado
 * (efectivo.neto + tarjeta.neto) siempre es cero.
 */
function aplicarTransferencias(
  totales: TotalesCalculados,
  transferencias: { monto: number; origen: MetodoPago; destino: MetodoPago }[],
): void {
  for (const t of transferencias) {
    if (t.origen === "efectivo") totales.efectivo.neto -= t.monto;
    else totales.tarjeta.neto -= t.monto;

    if (t.destino === "efectivo") totales.efectivo.neto += t.monto;
    else totales.tarjeta.neto += t.monto;
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
  // Agregación hecha en Postgres (función calcular_saldo_historico, ver
  // prisma/migrations): suma TODO el historial sin traerlo a Node, así que no
  // hay techo de filas. El cálculo anterior traía cada transacción histórica
  // a JS y las sumaba ahí — por encima de las ~1000 filas que Supabase
  // devuelve por defecto en una consulta normal, el saldo quedaba mal sin
  // ningún aviso.
  const { data, error } = await supabase
    .rpc("calcular_saldo_historico", { p_fecha_limite: fechaLimite })
    .single();

  if (error) throw new Error(`No se pudo calcular el saldo histórico: ${error.message}`);

  // El cliente de Supabase no está tipado con las funciones RPC del proyecto
  // (no hay Database generado), así que el resultado llega como `unknown`.
  const fila = data as unknown as { efectivo: number | string; tarjeta: number | string } | null;
  const efectivo = Number(fila?.efectivo ?? 0);
  const tarjeta = Number(fila?.tarjeta ?? 0);
  return { total: efectivo + tarjeta, efectivo, tarjeta };
}

export interface BalanceMensual {
  actual: ResumenMes & {
    nombreMes: string;
    transacciones: TransaccionConCategoria[];
    /** Total real de movimientos del mes (puede ser mayor que `transacciones.length` si se alcanzó el límite de 200). */
    totalTransaccionesMes: number;
  };
  anterior: ResumenMes & { nombreMes: string };
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

  const { data, error } = await supabase
    .from("transacciones")
    .select("*, categoria:categorias(id, nombre, tipo, grupo)")
    .gte("fecha", rango.inicio)
    .lt("fecha", rango.finExclusivo)
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false });

  if (error) throw new Error(`No se pudieron cargar las transacciones del mes: ${error.message}`);
  return (data ?? []) as unknown as TransaccionConCategoria[];
}

export async function obtenerBalanceMensual(
  anioTarget?: number,
  mesTarget?: number,
): Promise<BalanceMensual> {
  const supabase = await createClient();
  const hoy = hoyEnMexico();
  const anio = anioTarget ?? hoy.anio;
  const mes = mesTarget ?? hoy.mes;

  const anteriorYM = mesAnterior(anio, mes);
  const rangoActual = rangoDelMes(anio, mes);
  const rangoAnterior = rangoDelMes(anteriorYM.anio, anteriorYM.mes);

  // Cargamos, todo en paralelo:
  // - la LISTA de transacciones del mes actual a mostrar (limitada a 200 filas
  //   por rendimiento de UI — NO se usa para calcular totales, ver abajo)
  // - los TOTALES del mes actual, sin límite de filas (monto+metodo+tipo nada más)
  // - las transacciones del mes anterior (para la comparación), sin límite
  // - los traspasos del mes actual
  // - el saldo histórico acumulado por método, agregado en la base de datos
  const [resLista, resTotalesActual, resAnterior, resTransf, saldosHistoricos] = await Promise.all([
    supabase
      .from("transacciones")
      // count: "exact" pide a PostgREST el total real de filas que matchean
      // el filtro (vía header Content-Range) en la MISMA consulta, sin traer
      // más de las 200 que ya limitábamos — así la UI puede avisar si la
      // lista mostrada no es todo el mes, en vez de fallar en silencio.
      .select("*, categoria:categorias(id, nombre, tipo, grupo)", { count: "exact" })
      .gte("fecha", rangoActual.inicio)
      .lt("fecha", rangoActual.finExclusivo)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(200),
    supabase
      .from("transacciones")
      .select("monto, metodo_pago, categoria:categorias(tipo)")
      .gte("fecha", rangoActual.inicio)
      .lt("fecha", rangoActual.finExclusivo),
    supabase
      .from("transacciones")
      .select("monto, metodo_pago, categoria:categorias(tipo)")
      .gte("fecha", rangoAnterior.inicio)
      .lt("fecha", rangoAnterior.finExclusivo),
    supabase
      .from("transferencias")
      .select("*")
      .gte("fecha", rangoActual.inicio)
      .lt("fecha", rangoActual.finExclusivo)
      .order("fecha", { ascending: false }),
    calcularSaldosHistoricos(supabase, rangoActual.inicio),
  ]);

  if (resLista.error) {
    throw new Error(`No se pudieron cargar las transacciones del mes: ${resLista.error.message}`);
  }
  if (resTotalesActual.error) {
    throw new Error(`No se pudieron calcular los totales del mes: ${resTotalesActual.error.message}`);
  }
  if (resAnterior.error) {
    throw new Error(`No se pudo cargar el mes anterior: ${resAnterior.error.message}`);
  }
  if (resTransf.error) {
    throw new Error(`No se pudieron cargar los traspasos: ${resTransf.error.message}`);
  }

  const transaccionesActual = (resLista.data ?? []) as unknown as TransaccionConCategoria[];
  const transferenciasActual = (resTransf.data ?? []) as unknown as Transferencia[];

  const totalesActual = calcularTotalesDetallados(
    resTotalesActual.data as unknown as {
      monto: number;
      metodo_pago?: MetodoPago;
      categoria: { tipo: TipoCategoria } | null;
    }[],
  );
  aplicarTransferencias(totalesActual, transferenciasActual);

  const totalesAnterior = calcularTotalesDetallados(
    resAnterior.data as unknown as {
      monto: number;
      metodo_pago?: MetodoPago;
      categoria: { tipo: TipoCategoria } | null;
    }[],
  );

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
      saldoTotalDisponible: saldosHistoricos.total + balanceNetoActual,
      totalesEfectivo: {
        ...totalesActual.efectivo,
        saldo: saldosHistoricos.efectivo + totalesActual.efectivo.neto,
      },
      totalesTarjeta: {
        ...totalesActual.tarjeta,
        saldo: saldosHistoricos.tarjeta + totalesActual.tarjeta.neto,
      },
      transferencias: transferenciasActual,
      transacciones: transaccionesActual,
      totalTransaccionesMes: resLista.count ?? transaccionesActual.length,
    },
    anterior: {
      anio: anteriorYM.anio,
      mes: anteriorYM.mes,
      nombreMes: nombreDelMes(anteriorYM.anio, anteriorYM.mes),
      ingresos: totalesAnterior.ingresos,
      egresos: totalesAnterior.egresos,
      balance: totalesAnterior.ingresos - totalesAnterior.egresos,
      saldoInicial: 0,
      saldoTotalDisponible: totalesAnterior.ingresos - totalesAnterior.egresos,
      totalesEfectivo: { ...totalesAnterior.efectivo, saldo: totalesAnterior.efectivo.neto },
      totalesTarjeta: { ...totalesAnterior.tarjeta, saldo: totalesAnterior.tarjeta.neto },
      transferencias: [],
    },
  };
}

// ─────────────────────────────────────────────
// PRESUPUESTOS
// ─────────────────────────────────────────────

export async function obtenerPresupuestosConGasto(
  anioTarget?: number,
  mesTarget?: number,
): Promise<PresupuestoConGasto[]> {
  const supabase = await createClient();
  const hoy = hoyEnMexico();
  const anio = anioTarget ?? hoy.anio;
  const mes = mesTarget ?? hoy.mes;
  const mesActualISO = primerDiaDelMes(anio, mes);
  const rango = rangoDelMes(anio, mes);

  const [resCategorias, resPresupuestos, resTransacciones] = await Promise.all([
    supabase.from("categorias").select("*").eq("tipo", "egreso").order("nombre"),
    supabase.from("presupuestos").select("*").eq("mes", mesActualISO),
    supabase
      .from("transacciones")
      .select("categoria_id, monto")
      .gte("fecha", rango.inicio)
      .lt("fecha", rango.finExclusivo),
  ]);

  if (resCategorias.error) throw new Error(resCategorias.error.message);
  if (resPresupuestos.error) throw new Error(resPresupuestos.error.message);
  if (resTransacciones.error) throw new Error(resTransacciones.error.message);

  const categoriasEgreso = (resCategorias.data ?? []) as Categoria[];
  const presupuestos = (resPresupuestos.data ?? []) as Presupuesto[];
  const transacciones = (resTransacciones.data ?? []) as Pick<
    Transaccion,
    "categoria_id" | "monto"
  >[];

  const gastoPorCategoria = new Map<string, number>();
  for (const t of transacciones) {
    gastoPorCategoria.set(t.categoria_id, (gastoPorCategoria.get(t.categoria_id) ?? 0) + t.monto);
  }
  const presupuestoPorCategoria = new Map(presupuestos.map((p) => [p.categoria_id, p]));

  return categoriasEgreso.map((categoria) => ({
    categoria,
    presupuesto: presupuestoPorCategoria.get(categoria.id) ?? null,
    gastado: gastoPorCategoria.get(categoria.id) ?? 0,
  }));
}

export async function guardarPresupuesto(
  categoria_id: string,
  monto_limite: number,
  mesISO: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  if (monto_limite <= 0) {
    await supabase
      .from("presupuestos")
      .delete()
      .eq("user_id", user.id)
      .eq("categoria_id", categoria_id)
      .eq("mes", mesISO);
  } else {
    const { data: existente } = await supabase
      .from("presupuestos")
      .select("id")
      .eq("user_id", user.id)
      .eq("categoria_id", categoria_id)
      .eq("mes", mesISO)
      .maybeSingle();

    if (existente) {
      const { error } = await supabase
        .from("presupuestos")
        .update({ monto_limite })
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("presupuestos").insert({
        user_id: user.id,
        categoria_id,
        monto_limite,
        mes: mesISO,
      });
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
// GASTOS RECURRENTES (ahora en Supabase, no localStorage)
// ─────────────────────────────────────────────

export async function obtenerGastosRecurrentes(): Promise<GastoRecurrente[]> {
  const supabase = await createClient();

  // Sin getUser()/`.eq("user_id", ...)` a propósito: es una lectura y RLS ya
  // filtra por auth.uid() automáticamente (igual que obtenerCategorias/
  // obtenerBalanceMensual). getUser() hace un round-trip de red aparte a
  // Supabase Auth — costoso repetirlo en cada lectura cuando esta función
  // corre en paralelo con otras 3 dentro de un mismo Promise.all (carga
  // inicial del dashboard) y termina siendo la que más tarda.
  const { data, error } = await supabase
    .from("gastos_recurrentes")
    .select("*, categoria:categorias(id, nombre, tipo, grupo)")
    .order("dia_cobro");

  if (error) throw new Error(`No se pudieron cargar los gastos recurrentes: ${error.message}`);

  return (data ?? []) as unknown as GastoRecurrente[];
}

export interface NuevoGastoRecurrente {
  nombre: string;
  monto: number;
  dia_cobro: number;
  categoria_id: string;
  metodo_pago: MetodoPago;
}

export async function crearGastoRecurrente(input: NuevoGastoRecurrente): Promise<void> {
  if (!input.nombre.trim()) throw new Error("El nombre es requerido.");
  if (!Number.isFinite(input.monto) || input.monto <= 0) throw new Error("El monto debe ser mayor a 0.");
  if (input.dia_cobro < 1 || input.dia_cobro > 31) throw new Error("El día de cobro debe estar entre 1 y 31.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { error } = await supabase.from("gastos_recurrentes").insert({
    user_id: user.id,
    nombre: input.nombre.trim(),
    monto: input.monto,
    dia_cobro: input.dia_cobro,
    categoria_id: input.categoria_id || null,
    metodo_pago: input.metodo_pago,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export async function eliminarGastoRecurrente(id: string): Promise<void> {
  if (!id) throw new Error("ID inválido.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { error } = await supabase
    .from("gastos_recurrentes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}
