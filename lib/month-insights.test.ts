import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MonthInsights } from "../components/month-insights";
import type { BalanceMensual } from "../app/dashboard/actions";

const conArrastre = {
  anio: 2026,
  mes: 9,
  nombreMes: "septiembre de 2026",
  saldoInicial: 500,
  ingresos: 100,
  egresos: 600,
  balance: -500,
  saldoTotalDisponible: 0,
  egresosFijos: 0,
  totalTransaccionesMes: 2,
} as BalanceMensual["actual"];

test("un gasto cubierto con arrastre no se anuncia como déficit", () => {
  const html = renderToStaticMarkup(createElement(MonthInsights, { actual: conArrastre }));
  assert.match(html, /Usado del saldo anterior/);
  assert.match(html, /Cubierto/);
  assert.match(html, /100% utilizado/);
  assert.doesNotMatch(html, /Déficit|Saldo por cubrir/);
});

test("un saldo realmente insuficiente sigue visible como faltante", () => {
  const actual = { ...conArrastre, egresos: 650, balance: -550, saldoTotalDisponible: -50 };
  const html = renderToStaticMarkup(createElement(MonthInsights, { actual }));
  assert.match(html, /Saldo por cubrir/);
  assert.match(html, /Faltante/);
  assert.doesNotMatch(html, /Cubierto/);
});
