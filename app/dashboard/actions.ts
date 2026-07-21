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
  GrupoCategoria,
  MetodoPago,
  Presupuesto,
  PresupuestoConGasto,
  ResumenMes,
  TipoCategoria,
  Transaccion,
  TransaccionConCategoria,
} from "@/lib/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function obtenerCategorias(): Promise<Categoria[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categorias").select("*").order("nombre");

  if (error) return [];
  return data ?? [];
}

export interface NuevaTransaccion {
  categoria_id: string;
  monto: number;
  descripcion: string | null;
  metodo_pago?: MetodoPago;
  fecha?: string;
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

  const { error } = await supabase.from("transacciones").insert(payload);

  if (error) {
    // Fallback si la columna metodo_pago no existe todavía en Supabase
    if (error.message.includes("metodo_pago")) {
      delete payload.metodo_pago;
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

  let resHistoricoData: unknown[] = [];
  let resActualData: unknown[] = [];
  let resAnteriorData: unknown[] = [];

  try {
    const [resHist, resAct, resAnt] = await Promise.all([
      supabase
        .from("transacciones")
        .select("monto, metodo_pago, categoria:categorias(tipo)")
        .lt("fecha", rangoActual.inicio),
      supabase
        .from("transacciones")
        .select("*, categoria:categorias(id, nombre, tipo, grupo)")
        .gte("fecha", rangoActual.inicio)
        .lt("fecha", rangoActual.finExclusivo)
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false }),
      supabase
        .from("transacciones")
        .select("monto, metodo_pago, categoria:categorias(tipo)")
        .gte("fecha", rangoAnterior.inicio)
        .lt("fecha", rangoAnterior.finExclusivo),
    ]);

    if (resAct.error && resAct.error.message.includes("metodo_pago")) {
      // Reintento seguro sin la columna metodo_pago
      const [resHist2, resAct2, resAnt2] = await Promise.all([
        supabase
          .from("transacciones")
          .select("monto, categoria:categorias(tipo)")
          .lt("fecha", rangoActual.inicio),
        supabase
          .from("transacciones")
          .select("*, categoria:categorias(id, nombre, tipo, grupo)")
          .gte("fecha", rangoActual.inicio)
          .lt("fecha", rangoActual.finExclusivo)
          .order("fecha", { ascending: false })
          .order("creado_en", { ascending: false }),
        supabase
          .from("transacciones")
          .select("monto, categoria:categorias(tipo)")
          .gte("fecha", rangoAnterior.inicio)
          .lt("fecha", rangoAnterior.finExclusivo),
      ]);
      resHistoricoData = (resHist2.data ?? []) as unknown[];
      resActualData = (resAct2.data ?? []) as unknown[];
      resAnteriorData = (resAnt2.data ?? []) as unknown[];
    } else {
      resHistoricoData = (resHist.data ?? []) as unknown[];
      resActualData = (resAct.data ?? []) as unknown[];
      resAnteriorData = (resAnt.data ?? []) as unknown[];
    }
  } catch (err) {
    console.error("Error obteniendo balance mensual:", err);
  }

  // Arrastre histórico previo
  let saldoInicialHistorico = 0;
  for (const item of resHistoricoData as { monto: number; categoria: { tipo: TipoCategoria } | null }[]) {
    if (item.categoria?.tipo === "ingreso") saldoInicialHistorico += item.monto;
    else if (item.categoria?.tipo === "egreso") saldoInicialHistorico -= item.monto;
  }

  const transaccionesActual = resActualData as unknown as TransaccionConCategoria[];
  const totalesActual = calcularTotalesDetallados(transaccionesActual);
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
      saldoInicial: saldoInicialHistorico,
      saldoTotalDisponible: saldoInicialHistorico + balanceNetoActual,
      totalesEfectivo: totalesActual.efectivo,
      totalesTarjeta: totalesActual.tarjeta,
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
      totalesEfectivo: totalesAnterior.efectivo,
      totalesTarjeta: totalesAnterior.tarjeta,
    },
  };
}

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
