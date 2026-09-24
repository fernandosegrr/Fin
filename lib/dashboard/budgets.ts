import { errorDeBaseDatos } from "@/lib/dashboard/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esFechaISO, hoyEnMexico, mesAnterior, primerDiaDelMes, rangoDelMes } from "@/lib/dates";
import { aNumero, redondearMonto } from "@/lib/format";
import { traerTodasLasFilas } from "@/lib/supabase/paginar";
import { exigirUsuario, exigirCategoriaDelUsuario } from "@/lib/dashboard/shared";
import type { Categoria, Presupuesto, PresupuestoConGasto, Transaccion } from "@/lib/types";

// PRESUPUESTOS
// ─────────────────────────────────────────────

export async function obtenerPresupuestosConGasto(
  anioTarget?: number,
  mesTarget?: number,
): Promise<PresupuestoConGasto[]> {
  return cargarPresupuestos(anioTarget, mesTarget);
}

/** Reutiliza las categorías ya leídas durante la carga inicial del dashboard. */
export async function obtenerPresupuestosConCategorias(
  anioTarget: number | undefined,
  mesTarget: number | undefined,
  categorias: Categoria[],
): Promise<PresupuestoConGasto[]> {
  return cargarPresupuestos(anioTarget, mesTarget, categorias);
}

async function cargarPresupuestos(
  anioTarget?: number,
  mesTarget?: number,
  categoriasDisponibles?: Categoria[],
): Promise<PresupuestoConGasto[]> {
  const supabase = await createClient();
  const hoy = hoyEnMexico();
  const anio = anioTarget ?? hoy.anio;
  const mes = mesTarget ?? hoy.mes;
  const mesActualISO = primerDiaDelMes(anio, mes);
  const rango = rangoDelMes(anio, mes);

  const categoriasEgresoPromise = categoriasDisponibles
    ? Promise.resolve(categoriasDisponibles.filter((c) => c.tipo === "egreso"))
    : (async () => {
        const { data, error } = await supabase.from("categorias").select("*").eq("tipo", "egreso").order("nombre");
        if (error) throw new Error(`No se pudieron cargar las categorías del presupuesto: ${error.message}`, { cause: error });
        return (data ?? []) as Categoria[];
      })();

  const [categoriasEgreso, resPresupuestos, transacciones] = await Promise.all([
    categoriasEgresoPromise,
    supabase.from("presupuestos").select("*").eq("mes", mesActualISO),
    traerTodasLasFilas<Pick<Transaccion, "categoria_id" | "monto">>(
      (desde, hasta) =>
        supabase
          .from("transacciones")
          .select("categoria_id, monto")
          .gte("fecha", rango.inicio)
          .lt("fecha", rango.finExclusivo)
          .range(desde, hasta),
      "No se pudieron cargar los gastos del presupuesto",
    ),
  ]);

  if (resPresupuestos.error) throw new Error(`No se pudieron cargar los presupuestos: ${resPresupuestos.error.message}`, { cause: resPresupuestos.error });

  const presupuestos = (resPresupuestos.data ?? []) as Presupuesto[];

  const gastoPorCategoria = new Map<string, number>();
  for (const t of transacciones) {
    gastoPorCategoria.set(
      t.categoria_id,
      redondearMonto((gastoPorCategoria.get(t.categoria_id) ?? 0) + aNumero(t.monto)),
    );
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
  if (!categoria_id) throw new Error("Selecciona una categoría.");
  if (!esFechaISO(mesISO) || !mesISO.endsWith("-01")) {
    throw new Error("El mes del presupuesto no es válido.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  await exigirCategoriaDelUsuario(supabase, categoria_id);

  if (!Number.isFinite(monto_limite) || monto_limite <= 0) {
    const { error } = await supabase
      .from("presupuestos")
      .delete()
      .eq("user_id", user.id)
      .eq("categoria_id", categoria_id)
      .eq("mes", mesISO);
    if (error) throw errorDeBaseDatos(error);
  } else {
    const limite = redondearMonto(monto_limite);
    const { data: existente, error: errorBusqueda } = await supabase
      .from("presupuestos")
      .select("id")
      .eq("user_id", user.id)
      .eq("categoria_id", categoria_id)
      .eq("mes", mesISO)
      .maybeSingle();
    if (errorBusqueda) throw errorDeBaseDatos(errorBusqueda);

    if (existente) {
      const { error } = await supabase
        .from("presupuestos")
        .update({ monto_limite: limite })
        .eq("id", existente.id);
      if (error) throw errorDeBaseDatos(error);
    } else {
      const { error } = await supabase.from("presupuestos").insert({
        user_id: user.id,
        categoria_id,
        monto_limite: limite,
        mes: mesISO,
      });
      if (error) throw errorDeBaseDatos(error);
    }
  }

  revalidatePath("/dashboard");
}

export interface PresupuestoEntrada {
  categoria_id: string;
  monto_limite: number;
}

/**
 * Guarda o elimina múltiples presupuestos en una sola petición y un solo revalidatePath.
 * Evita disparar N Server Actions simultáneas desde el cliente.
 */
export async function guardarPresupuestosMultiples(
  mesISO: string,
  presupuestos: PresupuestoEntrada[],
): Promise<void> {
  if (!esFechaISO(mesISO) || !mesISO.endsWith("-01")) {
    throw new Error("El mes del presupuesto no es válido.");
  }
  if (!Array.isArray(presupuestos) || presupuestos.length === 0) {
    return;
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const aEliminar: string[] = [];
  const aGuardar: { user_id: string; categoria_id: string; monto_limite: number; mes: string }[] = [];

  for (const item of presupuestos) {
    if (!item.categoria_id) continue;
    const monto = Number(item.monto_limite);
    if (!Number.isFinite(monto) || monto <= 0) {
      aEliminar.push(item.categoria_id);
    } else {
      aGuardar.push({
        user_id: user.id,
        categoria_id: item.categoria_id,
        monto_limite: redondearMonto(monto),
        mes: mesISO,
      });
    }
  }

  if (aEliminar.length > 0) {
    const { error } = await supabase
      .from("presupuestos")
      .delete()
      .eq("user_id", user.id)
      .eq("mes", mesISO)
      .in("categoria_id", aEliminar);
    if (error) throw errorDeBaseDatos(error);
  }

  if (aGuardar.length > 0) {
    const { error } = await supabase
      .from("presupuestos")
      .upsert(aGuardar, { onConflict: "user_id, categoria_id, mes" });
    if (error) throw errorDeBaseDatos(error);
  }

  revalidatePath("/dashboard");
}

export type ResultadoCopiaPresupuestos =
  | { ok: true; copiados: number }
  | { ok: false; error: string };

/**
 * Copia al mes `mesISO` los presupuestos del mes anterior que todavía no
 * existen en ese mes. No pisa límites que el usuario ya haya puesto.
 */
export async function copiarPresupuestosMesAnterior(
  mesISO: string,
): Promise<ResultadoCopiaPresupuestos> {
  try {
    if (!esFechaISO(mesISO) || !mesISO.endsWith("-01")) {
      return { ok: false, error: "El mes del presupuesto no es válido." };
    }
    const [anioStr, mesStr] = mesISO.split("-");
    const anio = Number(anioStr);
    const mes = Number(mesStr);
    const previo = mesAnterior(anio, mes);
    const mesAnteriorISO = primerDiaDelMes(previo.anio, previo.mes);

    const supabase = await createClient();
    const user = await exigirUsuario(supabase);

    const [resAnterior, resActual] = await Promise.all([
      supabase
        .from("presupuestos")
        .select("categoria_id, monto_limite")
        .eq("user_id", user.id)
        .eq("mes", mesAnteriorISO),
      supabase
        .from("presupuestos")
        .select("categoria_id")
        .eq("user_id", user.id)
        .eq("mes", mesISO),
    ]);
    if (resAnterior.error) return { ok: false, error: resAnterior.error.message };
    if (resActual.error) return { ok: false, error: resActual.error.message };

    const anteriores = resAnterior.data ?? [];
    if (anteriores.length === 0) {
      return { ok: false, error: "El mes anterior no tiene presupuestos para copiar." };
    }

    const yaTienen = new Set((resActual.data ?? []).map((p) => p.categoria_id as string));
    const aCopiar = anteriores.filter((p) => !yaTienen.has(p.categoria_id as string));
    if (aCopiar.length === 0) {
      return { ok: false, error: "Este mes ya tiene límite en todas las categorías del mes anterior." };
    }

    const { error } = await supabase.from("presupuestos").insert(
      aCopiar.map((p) => ({
        user_id: user.id,
        categoria_id: p.categoria_id,
        monto_limite: p.monto_limite,
        mes: mesISO,
      })),
    );
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard");
    return { ok: true, copiados: aCopiar.length };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudieron copiar los presupuestos.",
    };
  }
}

// ─────────────────────────────────────────────
