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
