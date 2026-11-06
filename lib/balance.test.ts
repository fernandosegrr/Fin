import assert from "node:assert/strict";
import test from "node:test";
import {
  aplicarTransferencias,
  calcularTotalesDetallados,
  type FilaParaTotales,
} from "./dashboard/calculations";

const filas: FilaParaTotales[] = [
  {
    monto: 800,
    metodo_pago: "efectivo",
    categoria: { id: "ingreso", nombre: "Trabajo", tipo: "ingreso", grupo: null },
  },
  {
    monto: 300,
    metodo_pago: "tarjeta",
    categoria: { id: "renta", nombre: "Renta", tipo: "egreso", grupo: "fijo" },
  },
  {
    monto: 250,
    metodo_pago: "efectivo",
    categoria: { id: "comida", nombre: "Comida", tipo: "egreso", grupo: "variable" },
  },
];

test("el total mensual incluye todas las filas y conserva los desgloses", () => {
  const total = calcularTotalesDetallados(filas);
  assert.equal(total.ingresos, 800);
  assert.equal(total.egresos, 550);
  assert.equal(total.efectivo.neto + total.tarjeta.neto, 250);
  assert.equal(total.egresosFijos, 300);
  assert.equal(total.egresosVariables, 250);
  assert.deepEqual(total.egresosPorCategoria.map((c) => c.monto), [300, 250]);
});

test("un traspaso cambia las cuentas sin crear ingresos ni egresos", () => {
  const total = calcularTotalesDetallados(filas);
  aplicarTransferencias(total, [{ monto: 100, origen: "efectivo", destino: "tarjeta" }]);
  assert.equal(total.efectivo.neto, 450);
  assert.equal(total.tarjeta.neto, -200);
  assert.equal(total.efectivo.neto + total.tarjeta.neto, 250);
  assert.equal(total.ingresos, 800);
  assert.equal(total.egresos, 550);
});

test("un reembolso afecta el balance y no distorsiona la distribución del consumo", () => {
  const total = calcularTotalesDetallados([...filas, { monto: 200, naturaleza: "reembolso", metodo_pago: "tarjeta", categoria: { id: "devolucion", nombre: "Reembolso", tipo: "ingreso", grupo: null } }]);
  assert.equal(total.egresos, 350);
  assert.equal(total.ingresos, 800);
  assert.equal(total.egresosFijos + total.egresosVariables, 550);
  assert.deepEqual(total.egresosPorCategoria.map(c => c.monto), [300, 250]);
});

test("agrupar gym y salud conserva el cobro recurrente como fijo y los suplementos como variables", () => {
  const categoria = { id: "salud", nombre: "Gym y salud", tipo: "egreso" as const, grupo: "variable" as const };
  const total = calcularTotalesDetallados([
    { monto: 600, categoria, naturaleza: "egreso", gasto_recurrente_id: "gym" },
    { monto: 350.1, categoria, naturaleza: "egreso" },
  ]);
  assert.equal(total.egresosFijos, 600);
  assert.equal(total.egresosVariables, 350.1);
  assert.deepEqual(total.egresosPorCategoria.map(c => c.monto), [950.1]);
});
