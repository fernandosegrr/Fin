import assert from "node:assert/strict";
import test from "node:test";
import { esIndicePresupuestoAusente, guardarLimitesCompatibles } from "./dashboard/budget-compat";
import type { ClienteSupabase } from "./dashboard/shared";

function dbSimulada(categorias: object[], presupuestos: object[]) {
  const planes: Record<string, unknown>[] = [];
  const borrados: string[][] = [];
  const filtros: [string, string, unknown][] = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "propietario" } } }) },
    rpc: async (nombre: string, args: Record<string, unknown>) => { planes.push({ nombre, ...args }); return { data: {}, error: null }; },
    from(tabla: string) {
      let eliminando = false;
      const builder = {
        select() { return builder; },
        eq(k: string, v: unknown) { filtros.push([tabla, k, v]); return builder; },
        in(k: string, v: string[]) { if (eliminando && k === "id") borrados.push(v); return builder; },
        delete() { eliminando = true; return builder; },
        upsert() { return builder; },
        then(resolve: (r: { data: object[]; error: null }) => void) { resolve({ data: tabla === "categorias" ? categorias : tabla === "presupuestos" && !eliminando ? presupuestos : [], error: null }); },
      };
      return builder;
    },
  };
  return { db: db as unknown as ClienteSupabase, planes, borrados, filtros };
}

test("el presupuesto compatible actualiza el ID existente y quita el límite cero sin duplicar", async () => {
  const m = dbSimulada([
    { id: "auto", tipo: "egreso", naturaleza: "egreso", archivada: false },
    { id: "gaming", tipo: "egreso", naturaleza: "egreso", archivada: false },
  ], [
    { id: "limite-auto", categoria_id: "auto", user_id: "propietario", mes: "2026-11-01", monto_limite: 100 },
    { id: "limite-gaming", categoria_id: "gaming", user_id: "propietario", mes: "2026-11-01", monto_limite: 50 },
  ]);
  await guardarLimitesCompatibles(m.db, "2026-11-01", [{ categoria_id: "auto", monto_limite: 120 }, { categoria_id: "gaming", monto_limite: 0 }]);
  const plan = m.planes[0].p_plan as { presupuestos: { despues: { id: string; monto_limite: number } }[] };
  assert.deepEqual(plan.presupuestos.map(p => [p.despues.id, p.despues.monto_limite]), [["limite-auto", 120]]);
  assert.deepEqual(m.borrados, [["limite-gaming"]]);
  assert.ok(m.filtros.filter(([, k]) => k === "user_id").every(([, , v]) => v === "propietario"));
  assert.equal(esIndicePresupuestoAusente({ code: "42501", message: "permission denied" }), false);
  assert.equal(esIndicePresupuestoAusente({ code: "42P10", message: "there is no unique constraint matching ON CONFLICT" }), true);
});

test("el presupuesto rechaza categorías ajenas, ahorro y categorías repetidas antes de escribir", async () => {
  for (const cats of [[], [{ id: "ahorro", tipo: "egreso", naturaleza: "traspaso", archivada: false }]]) {
    const m = dbSimulada(cats, []);
    await assert.rejects(guardarLimitesCompatibles(m.db, "2026-11-01", [{ categoria_id: "ahorro", monto_limite: 100 }]));
    assert.equal(m.planes.length, 0); assert.equal(m.borrados.length, 0);
  }
  const m = dbSimulada([], []);
  await assert.rejects(guardarLimitesCompatibles(m.db, "2026-11-01", [{ categoria_id: "a", monto_limite: 1 }, { categoria_id: "a", monto_limite: 2 }]));
  assert.equal(m.planes.length, 0);
});
