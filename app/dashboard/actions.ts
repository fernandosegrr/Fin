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

  if (error) return [];
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

  const payload: Record<string, unknown> = {
    user_id: user.id,
    categoria_id: input.categoria_id,
    monto: input.monto,
    fecha: input.fecha || hoyISOEnMexico(),
    descripcion: input.descripcion?.trim() || null,
  };

  if (input.metodo_pago) {
    payload.metodo_pago = input.metodo_pago;
  }
  if (input.gasto_recurrente_id) {
    payload.gasto_recurrente_id = input.gasto_recurrente_id;
  }

  const { error } = await supabase.from("transacciones").insert(payload);

  if (error) {
    // Fallback si alguna columna todavía no existe en Supabase (migración pendiente)
    if (error.message.includes("metodo_pago") || error.message.includes("gasto_recurrente_id")) {
      delete payload.metodo_pago;
      delete payload.gasto_recurrente_id;
      const { error: retryError } = await supabase.from("transacciones").insert(payload);
      if (retryError) throw new Error(retryError.message);
    } else {
      throw new Error(error.message);
    }
  }

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

  const payload: Record<string, unknown> = {
    categoria_id: input.categoria_id,
    monto: input.monto,
    descripcion: input.descripcion?.trim() || null,
    ...(input.fecha ? { fecha: input.fecha } : {}),
  };

  if (input.metodo_pago) {
    payload.metodo_pago = input.metodo_pago;
  }

  const { error } = await supabase
    .from("transacciones")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    if (error.message.includes("metodo_pago")) {
      delete payload.metodo_pago;
      await supabase.from("transacciones").update(payload).eq("id", id).eq("user_id", user.id);
    } else {
      throw new Error(error.message);
    }
  }

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

  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      throw new Error(
        "Falta crear la tabla 'transferencias' en Supabase. Corre el script actualizado de supabase/schema.sql.",
      );
    }
    throw new Error(error.message);
  }

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
  let efectivo = 0;
  let tarjeta = 0;

  try {
    const { data, error } = await supabase
      .from("transacciones")
      .select("monto, metodo_pago, categoria:categorias(tipo)")
      .lt("fecha", fechaLimite);

    if (!error) {
      const items = (data ?? []) as unknown as {
        monto: number;
        metodo_pago?: MetodoPago;
        categoria: { tipo: TipoCategoria } | null | { tipo: TipoCategoria }[];
      }[];
      for (const item of items) {
        const cat = Array.isArray(item.categoria) ? item.categoria[0] : item.categoria;
        const esEfectivo = item.metodo_pago === "efectivo";
        if (cat?.tipo === "ingreso") {
          if (esEfectivo) efectivo += item.monto;
          else tarjeta += item.monto;
        } else if (cat?.tipo === "egreso") {
          if (esEfectivo) efectivo -= item.monto;
          else tarjeta -= item.monto;
        }
      }
    }
  } catch {
    // Seguimos con lo acumulado hasta el momento.
  }

  try {
    // Tabla nueva: puede no existir todavía si no se corrió la migración.
    const { data, error } = await supabase
      .from("transferencias")
      .select("monto, origen, destino")
      .lt("fecha", fechaLimite);

    if (!error) {
      const traspasos = (data ?? []) as unknown as {
        monto: number;
        origen: MetodoPago;
        destino: MetodoPago;
      }[];
      for (const t of traspasos) {
        if (t.origen === "efectivo") efectivo -= t.monto;
        else tarjeta -= t.monto;
        if (t.destino === "efectivo") efectivo += t.monto;
        else tarjeta += t.monto;
      }
    }
  } catch {
    // Tabla transferencias no disponible todavía: no afecta el resto del cálculo.
  }

  return { total: efectivo + tarjeta, efectivo, tarjeta };
}

export interface BalanceMensual {
  actual: ResumenMes & { nombreMes: string; transacciones: TransaccionConCategoria[] };
  anterior: ResumenMes & { nombreMes: string };
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

  let resActualData: unknown[] = [];
  let resAnteriorData: unknown[] = [];
  let transferenciasActualData: unknown[] = [];
  let saldosHistoricos: SaldosHistoricos = { total: 0, efectivo: 0, tarjeta: 0 };

  try {
    // Cargamos transacciones del mes actual y anterior, traspasos del mes
    // actual, y el saldo histórico por método, todo en paralelo.
    const [resAct, resAnt, resTransf, saldosHist] = await Promise.all([
      supabase
        .from("transacciones")
        .select("*, categoria:categorias(id, nombre, tipo, grupo)")
        .gte("fecha", rangoActual.inicio)
        .lt("fecha", rangoActual.finExclusivo)
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false })
        // Safety net: límite de 200 transacciones por mes
        .limit(200),
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
      // Saldo histórico (total y por método) usando query de agregación
      calcularSaldosHistoricos(supabase, rangoActual.inicio),
    ]);

    if (resAct.error && resAct.error.message.includes("metodo_pago")) {
      // Reintento seguro sin la columna metodo_pago
      const [resAct2, resAnt2] = await Promise.all([
        supabase
          .from("transacciones")
          .select("*, categoria:categorias(id, nombre, tipo, grupo)")
          .gte("fecha", rangoActual.inicio)
          .lt("fecha", rangoActual.finExclusivo)
          .order("fecha", { ascending: false })
          .order("creado_en", { ascending: false })
          .limit(200),
        supabase
          .from("transacciones")
          .select("monto, categoria:categorias(tipo)")
          .gte("fecha", rangoAnterior.inicio)
          .lt("fecha", rangoAnterior.finExclusivo),
      ]);
      resActualData = (resAct2.data ?? []) as unknown[];
      resAnteriorData = (resAnt2.data ?? []) as unknown[];
    } else {
      resActualData = (resAct.data ?? []) as unknown[];
      resAnteriorData = (resAnt.data ?? []) as unknown[];
    }

    // La tabla transferencias es nueva: puede no existir todavía (migración pendiente).
    transferenciasActualData = resTransf.error ? [] : (resTransf.data ?? []);

    saldosHistoricos = saldosHist;
  } catch (err) {
    console.error("Error obteniendo balance mensual:", err);
  }

  const transaccionesActual = resActualData as unknown as TransaccionConCategoria[];
  const transferenciasActual = transferenciasActualData as unknown as Transferencia[];

  const totalesActual = calcularTotalesDetallados(transaccionesActual);
  aplicarTransferencias(totalesActual, transferenciasActual);

  const totalesAnterior = calcularTotalesDetallados(
    resAnteriorData as unknown as {
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

  try {
    const [resCategorias, resPresupuestos, resTransacciones] = await Promise.all([
      supabase.from("categorias").select("*").eq("tipo", "egreso").order("nombre"),
      supabase.from("presupuestos").select("*").eq("mes", mesActualISO),
      supabase
        .from("transacciones")
        .select("categoria_id, monto")
        .gte("fecha", rango.inicio)
        .lt("fecha", rango.finExclusivo),
    ]);

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
  } catch (err) {
    console.error("Error obteniendo presupuestos con gasto:", err);
    return [];
  }
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("gastos_recurrentes")
    .select("*, categoria:categorias(id, nombre, tipo, grupo)")
    .eq("user_id", user.id)
    .order("dia_cobro");

  if (error) {
    console.error("Error obteniendo gastos recurrentes:", error);
    return [];
  }

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
