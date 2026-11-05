import assert from "node:assert/strict";
import test from "node:test";
import { resumirLibro } from "./finance/ledger";
import { proyectarRendimientos, estimarRendimientosPendientes } from "./finance/returns";
import { sugerirCategoria } from "./finance/classification";
import type { CuentaConSaldo, CuentaFinanciera, FilaFinanciera } from "./finance/types";

const cuenta = (id: string, tipo: CuentaFinanciera["tipo"] = "principal"): CuentaFinanciera => ({ id, user_id: "u", codigo: id, nombre: id, tipo, metodo_pago: "tarjeta", banco: "Revolut", excluida_disponible: tipo !== "principal", archivada: false, grupo_rendimiento: "revolut", rendimiento_desde: "2026-11-05", tasa_anual: 15, tasa_excedente: 7, tasa_superior: 4.5, retencion_anual: .9, limite_preferente: 25000, limite_segundo_tramo: 1000000, plan: "Plus" });
const mov = (monto: number, naturaleza: FilaFinanciera["naturaleza"], cuenta_id = "principal", extra: Partial<FilaFinanciera> = {}): FilaFinanciera => ({ id: crypto.randomUUID(), user_id: "u", categoria_id: "cat", monto, fecha: "2026-11-05", descripcion: null, creado_en: "2026-11-05", categoria: { id: "cat", nombre: "Categoría", tipo: "egreso", grupo: "variable" }, cuenta_id, naturaleza, ...extra });

test("ahorrar conserva activos y excluye la aportación del consumo y del disponible", () => {
  const r = resumirLibro([cuenta("principal"), cuenta("ahorro", "ahorro")], [mov(2000, "ingreso"), mov(1046.4, "traspaso", "principal", { cuenta_destino_id: "ahorro" }), mov(100, "egreso")], [], "2026-11-01", "2026-12-01");
  assert.equal(r.activos, 1900); assert.equal(r.ahorro, 1046.4); assert.equal(r.disponible, 853.6);
  assert.equal(r.consumo, 100); assert.equal(r.ingresosTrabajo, 2000); assert.equal(r.aportacionesAhorro, 1046.4);
});
test("un préstamo no infla ingresos y una compensación confirmada no crea una salida", () => {
  const r = resumirLibro([cuenta("principal")], [mov(500, "financiacion", "principal", { deuda_liquidada_en: "2026-11-05" }), mov(50, "apoyo"), mov(1, "rendimiento", "principal", { interes_bruto: 1.06, impuesto_retenido: .06 }), mov(20, "reembolso")], [], "2026-11-01", "2026-12-01");
  assert.equal(r.ingresosTrabajo, 0); assert.equal(r.prestamosRecibidos, 500); assert.equal(r.activos, 571); assert.equal(r.deuda, 0);
  assert.equal(r.retenciones, .06); assert.equal(r.rendimientosNetos, 1); assert.equal(r.rendimientosBrutos, 1.06); assert.equal(r.reembolsos, 20);
});
test("historial de más de 200 filas conserva cantidad, promedio y compras mayores", () => {
  const filas = Array.from({ length: 251 }, (_, i) => mov(i === 0 ? 1000 : 1, "egreso"));
  const r = resumirLibro([cuenta("principal")], filas, [], "2026-11-01", "2026-12-01");
  assert.equal(r.compras.cantidad, 251); assert.equal(r.consumo, 1250); assert.equal(r.compras.mayores[0].monto, 1000);
});

test("sólo los pagos vinculados reducen un préstamo y los pagos históricos siguen separados del consumo", () => {
  const prestamo = mov(500, "financiacion", "principal", { descripcion: "Préstamo familiar" });
  const pago = mov(200, "pago_deuda", "principal", { movimiento_relacionado_id: prestamo.id });
  const anterior = mov(300, "pago_deuda", "principal", { fecha: "2026-10-01" });
  const r = resumirLibro([cuenta("principal")], [prestamo, pago, anterior], [], "2026-11-01", "2026-12-01");
  assert.equal(r.deuda, 300); assert.equal(r.pagosDeuda, 200); assert.equal(r.consumo, 0);
  assert.deepEqual(r.deudasPendientes, [{ id: prestamo.id, descripcion: "Préstamo familiar", fecha: "2026-11-05", recibido: 500, pendiente: 300 }]);
});
test("Revolut trunca, usa 360/365 y capitaliza el neto sin convertir la proyección en saldo real", () => {
  const c = { ...cuenta("ahorro", "ahorro"), saldo: 1046.4, saldoInicial: 0, variacion: 1046.4, rendimientosMes: 0, retencionesMes: 0 } satisfies CuentaConSaldo;
  const [r] = proyectarRendimientos([c], 1, "2026-11-05");
  assert.equal(r.bruto, .43); assert.equal(r.retencion, .02); assert.equal(r.neto, .41); assert.equal(r.saldoProyectado, 1046.81);
  assert.equal(c.saldo, 1046.4); assert.equal(r.tasaPonderada, 15);
  const [dos] = proyectarRendimientos([c], 2, "2026-11-05"); assert.equal(dos.bruto, .87); assert.equal(dos.retencion, .05);
});
test("dos apartados comparten el tramo preferente y no devengan antes del alta", () => {
  const a = { ...cuenta("a"), saldo: 25000, saldoInicial: 0, variacion: 0, rendimientosMes: 0, retencionesMes: 0 };
  const b = { ...a, id: "b", nombre: "b" };
  const r = proyectarRendimientos([a, b], 1, "2026-11-05");
  assert.equal(r[0].tasaPonderada, 11); assert.equal(r[0].bruto, 7.63); assert.equal(r[1].bruto, 7.63);
  assert.equal(proyectarRendimientos([{ ...a, rendimiento_desde: "2026-11-06" }], 1, "2026-11-05")[0].neto, 0);
});
test("una regla ambigua no selecciona la primera categoría y respeta palabras completas", () => {
  const cats = ["a", "b"].map(id => ({ id, user_id: "u", nombre: id, tipo: "egreso" as const, grupo: "variable" as const, aliases: ["gas"] }));
  assert.equal(sugerirCategoria("gas", cats), null); assert.equal(sugerirCategoria("gasolina", [cats[0]]), null);
  assert.equal(sugerirCategoria("pago gas", [cats[0]])?.id, "a");
});

test("la estimación diaria sigue los saldos históricos y un abono real evita duplicar rendimientos", () => {
  const cuentas = [cuenta("principal")];
  const filas = [mov(1046.4, "ingreso"), mov(100, "egreso", "principal", { fecha: "2026-11-06" })];
  const dos = estimarRendimientosPendientes(cuentas, filas, [], "2026-11-07").cuentas[0];
  // Primer día con 1046.40; segundo con el retiro de 100 y el neto estimado previo.
  assert.equal(dos.bruto, .83); assert.equal(dos.retencion, .04); assert.equal(dos.neto, .79);
  assert.equal(dos.saldo, 946.4); assert.equal(dos.saldoProyectado, 947.19);
  const conPago = [...filas, mov(.79, "rendimiento", "principal", { fecha: "2026-11-07" })];
  const conciliada = estimarRendimientosPendientes(cuentas, conPago, [], "2026-11-07").cuentas[0];
  assert.equal(conciliada.neto, 0); assert.equal(conciliada.saldoProyectado, 947.19);
  assert.equal(filas.length, 2); // La lectura nunca acredita importes supuestos.
  const libro = resumirLibro(cuentas, conPago, [], "2026-11-01", "2026-12-01");
  assert.deepEqual(libro.rendimientosSinDesglose, { cantidad: 1, neto: .79 });
  assert.equal(libro.rendimientosBrutos, 0); // Neto conocido no equivale a bruto conocido.
});
