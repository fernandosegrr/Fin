import type { ClienteSupabase } from "./shared";
import { exigirUsuario } from "./shared";
import type { Presupuesto } from "@/lib/types";
import { traerTodasLasFilas } from "@/lib/supabase/paginar";

/** Older installations can lack the composite index expected by the budget RPC. */
export function esIndicePresupuestoAusente(error: { code?: string; message?: string } | null) {
  return error?.code === "42P10" && /unique|exclusion|ON CONFLICT/i.test(error.message ?? "");
}

export async function guardarLimitesCompatibles(db: ClienteSupabase, mes: string, limites: { categoria_id: string; monto_limite: number }[]) {
  const user = await exigirUsuario(db);
  if (new Set(limites.map(l => l.categoria_id)).size !== limites.length) throw new Error("No repitas una categoría en el presupuesto.");
  const ids = limites.map(l => l.categoria_id);
  const [cats, actuales] = await Promise.all([
    db.from("categorias").select("id,tipo,naturaleza,archivada").eq("user_id", user.id).in("id", ids),
    db.from("presupuestos").select("*").eq("user_id", user.id).eq("mes", mes).in("categoria_id", ids),
  ]);
  if (cats.error || actuales.error) throw new Error(cats.error?.message || actuales.error?.message);
  if (cats.data.length !== ids.length || cats.data.some(c => c.tipo !== "egreso" || c.archivada || (c.naturaleza && c.naturaleza !== "egreso"))) throw new Error("Usa categorías de gasto activas de tu cuenta.");
  const previos = actuales.data as Presupuesto[];
  if (new Set(previos.map(p => p.categoria_id)).size !== previos.length) throw new Error("Hay presupuestos duplicados que requieren revisión.");
  const positivos = limites.filter(l => l.monto_limite > 0).map(l => {
    const antes = previos.find(p => p.categoria_id === l.categoria_id) ?? null;
    return { antes, despues: { id: antes?.id || crypto.randomUUID(), user_id: user.id, mes, categoria_id: l.categoria_id, monto_limite: l.monto_limite } };
  });
  const quitar = previos.filter(p => limites.some(l => l.categoria_id === p.categoria_id && l.monto_limite <= 0));
  const lote = crypto.randomUUID();
  if (positivos.length) {
    const guardado = await db.rpc("aplicar_plan_financiero", { p_plan: { presupuestos: positivos }, p_lote: lote, p_nombre: "Actualizar presupuestos" });
    if (guardado.error) throw new Error(guardado.error.message);
  }
  if (quitar.length) {
    const borrado = await db.from("presupuestos").delete().eq("user_id", user.id).eq("mes", mes).in("id", quitar.map(p => p.id));
    if (borrado.error) {
      const deshacer = positivos.length ? await db.rpc("revertir_lote_financiero", { p_lote: lote }) : null;
      throw new Error(deshacer?.error ? "Se guardaron algunos límites. Recarga antes de volver a editar." : "No se pudo guardar el presupuesto. Vuelve a intentarlo.");
    }
  }
  const marcado = await db.from("meses_presupuestados").upsert({ user_id: user.id, mes }, { onConflict: "user_id,mes" });
  if (marcado.error) throw new Error(marcado.error.message);
}

export async function copiarLimitesCompatibles(db: ClienteSupabase, mes: string) {
  const user = await exigirUsuario(db);
  const marca = await db.from("meses_presupuestados").select("mes").eq("user_id", user.id).eq("mes", mes).maybeSingle();
  if (marca.error) throw new Error(marca.error.message);
  if (marca.data) return;
  const anterior = await db.from("presupuestos").select("mes").eq("user_id", user.id).lt("mes", mes).order("mes", { ascending: false }).limit(1).maybeSingle();
  if (anterior.error) throw new Error(anterior.error.message);
  if (!anterior.data) return;
  const filas = await db.from("presupuestos").select("categoria_id,monto_limite,categoria:categorias!inner(archivada,naturaleza)").eq("user_id", user.id).eq("mes", anterior.data.mes).eq("categoria.archivada", false);
  if (filas.error) throw new Error(filas.error.message);
  const limites = filas.data.filter(p => {
    const c = p.categoria as unknown as { naturaleza: string | null };
    return !c.naturaleza || c.naturaleza === "egreso";
  }).map(p => ({ categoria_id: p.categoria_id as string, monto_limite: Number(p.monto_limite) }));
  if (limites.length) await guardarLimitesCompatibles(db, mes, limites);
}

export async function fusionarCategoriasCompatibles(db: ClienteSupabase, origen: string, destino: string) {
  const user = await exigirUsuario(db);
  const cats = await db.from("categorias").select("*").eq("user_id", user.id).in("id", [origen, destino]);
  if (cats.error) throw new Error(cats.error.message);
  const a = cats.data.find(c => c.id === origen), b = cats.data.find(c => c.id === destino);
  if (!a || !b || a.tipo !== b.tipo || a.archivada || b.archivada) throw new Error("Selecciona dos categorías activas del mismo tipo.");
  const [transacciones, recurrentes, presupuestos] = await Promise.all([
    traerTodasLasFilas<{ id: string; user_id: string; categoria_id: string }>((desde, hasta) => db.from("transacciones").select("*").eq("user_id", user.id).eq("categoria_id", origen).order("id").range(desde, hasta), "No se pudieron leer los movimientos"),
    db.from("gastos_recurrentes").select("*").eq("user_id", user.id).eq("categoria_id", origen),
    db.from("presupuestos").select("*").eq("user_id", user.id).in("categoria_id", [origen, destino]),
  ]);
  if (recurrentes.error || presupuestos.error) throw new Error(recurrentes.error?.message || presupuestos.error?.message);
  if (presupuestos.data.length && ((a.naturaleza && a.naturaleza !== "egreso") || (b.naturaleza && b.naturaleza !== "egreso"))) throw new Error("Los presupuestos sólo pueden fusionarse entre categorías de gasto.");
  for (const mes of new Set(presupuestos.data.map(p => p.mes as string))) {
    const suma = presupuestos.data.filter(p => p.mes === mes).reduce((s, p) => s + Math.round(Number(p.monto_limite) * 100), 0) / 100;
    await guardarLimitesCompatibles(db, mes, [{ categoria_id: origen, monto_limite: 0 }, { categoria_id: destino, monto_limite: suma }]);
  }
  const traslado = (fila: { id: string; user_id: string; categoria_id: string }) => ({ antes: fila, despues: { id: fila.id, user_id: user.id, categoria_id: destino } });
  const guardado = await db.rpc("aplicar_plan_financiero", {
    p_lote: crypto.randomUUID(), p_nombre: "Fusionar categorías",
    p_plan: {
      categorias: [
        { antes: a, despues: { id: a.id, user_id: user.id, archivada: true } },
        { antes: b, despues: { id: b.id, user_id: user.id, aliases: [...new Set([...(a.aliases || []), ...(b.aliases || []), a.nombre])] } },
      ],
      transacciones: transacciones.map(traslado), gastos_recurrentes: recurrentes.data.map(traslado),
    },
  });
  if (guardado.error) throw new Error(guardado.error.message);
}
