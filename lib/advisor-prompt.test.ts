import assert from "node:assert/strict";
import test from "node:test";
import { construirSystemPrompt } from "./advisor/prompt";
import type { BalanceMensual } from "./dashboard/balance";
import type { Categoria } from "./types";

test("el asesor recibe el arrastre y distingue la variación del saldo disponible", () => {
  const balance = {
    actual: {
      anio: 2026,
      mes: 9,
      nombreMes: "septiembre de 2026",
      ingresos: 100,
      egresos: 600,
      saldoInicial: 500,
      balance: -500,
      saldoTotalDisponible: 0,
      totalesEfectivo: { ingresos: 0, egresos: 0, neto: 0, saldo: 0 },
      totalesTarjeta: { ingresos: 0, egresos: 0, neto: 0, saldo: 0 },
      transferencias: [],
      egresosFijos: 0,
      egresosVariables: 600,
      egresosPorCategoria: [],
      ingresosPorCliente: [],
      recurrentesCobrados: [],
      transacciones: [],
      totalTransaccionesMes: 0,
    },
  } satisfies BalanceMensual;

  const prompt = construirSystemPrompt({
    balance,
    presupuestos: [],
    gastosRecurrentes: [],
    tendencia: [],
    notas: [],
    esMesEnCurso: true,
    categorias: [{ nombre: "Comida\nOtra", tipo: "egreso" } as Categoria],
    clientes: [],
    metaNombre: null,
    metaObjetivo: null,
  });

  assert.match(prompt, /Saldo al iniciar el mes \(arrastre\):.*500/);
  assert.match(prompt, /Variación del mes .*-[\s\S]*500/);
  assert.match(prompt, /Saldo total disponible:.*0/);
  assert.match(prompt, /Comida Otra/);
  assert.doesNotMatch(prompt, /Comida\nOtra/);
});
