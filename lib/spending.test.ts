import assert from "node:assert/strict";
import test from "node:test";
import { destinoDelGasto, etiquetasConDestino, resumirGastosPorDestino } from "./finance/spending";
import type { TransaccionConCategoria } from "./types";

const gasto = (id: string, monto: number, extra: Partial<TransaccionConCategoria> = {}): TransaccionConCategoria => ({
  id, user_id: "u", categoria_id: "c", creado_en: "2026-11-01", fecha: "2026-11-01", descripcion: "Compra", monto, naturaleza: "egreso",
  categoria: { id: "c", nombre: "Auto", tipo: "egreso", grupo: "variable" }, ...extra,
});

test("pareja y personal reconcilian sin contar ahorro, préstamos, reembolsos ni ajustes", () => {
  const r = resumirGastosPorDestino([
    gasto("auto", 37.21), gasto("pareja", 100, { etiquetas: ["En pareja"] }),
    gasto("familia", 20, { etiquetas: ["Familia y otros"] }), gasto("pendiente", 15, { naturaleza: "egreso_pendiente" }),
    ...(["traspaso", "financiacion", "pago_deuda", "reembolso", "rendimiento", "ajuste_salida"] as const).map(n => gasto(n, 1000, { naturaleza: n })),
    gasto("borrado", 500, { eliminado_en: "2026-11-02" }), gasto("anterior", 900, { fecha: "2026-10-31" }), gasto("posterior", 800, { fecha: "2026-12-01" }),
  ], "2026-11-01", "2026-12-01");
  assert.equal(r.personal.total, 37.21); assert.equal(r.pareja.total, 100);
  assert.equal(r.otros.total, 20); assert.equal(r.sin_clasificar.total, 15);
  assert.equal(Object.values(r).reduce((s, g) => s + g.cantidad, 0), 4);
});

test("un gasto de pareja conserva todo lo pagado y una etiqueta personal puede corregirlo", () => {
  const t = gasto("salida", 389, { categoria: { id: "p", nombre: "Salidas en pareja", tipo: "egreso", grupo: "variable" } });
  assert.equal(destinoDelGasto(t), "pareja");
  assert.equal(resumirGastosPorDestino([t], "2000-01-01", "2100-01-01").pareja.total, 389);
  assert.equal(destinoDelGasto({ ...t, etiquetas: ["Personal"] }), "personal");
  assert.deepEqual(etiquetasConDestino(["En pareja", "Escuela", "Por confirmar"], "personal"), ["Escuela", "Personal"]);
});

test("los importes pequeños y el histórico se suman en centavos sin depender de la muestra visible", () => {
  const filas = Array.from({ length: 251 }, (_, i) => gasto(String(i), .1));
  const r = resumirGastosPorDestino(filas, "2000-01-01", "2100-01-01");
  assert.equal(r.personal.total, 25.1); assert.equal(r.personal.movimientos.length, 251);
});
