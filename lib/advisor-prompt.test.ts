import assert from "node:assert/strict";
import test from "node:test";
import { MODELO_ASESOR } from "./advisor/config";
import { construirSystemPrompt } from "./advisor/prompt";
import type { BalanceMensual } from "./dashboard/balance";
import type { Categoria } from "./types";

test("el asesor usa el modelo gpt-6-luna", () => {
  assert.equal(MODELO_ASESOR, "gpt-6-luna");
});

test("el asesor recibe el arrastre, el detalle de cada compra y distingue la variación del saldo disponible", () => {
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
      totalesEfectivo: { ingresos: 0, egresos: 150, neto: -150, saldo: 0 },
      totalesTarjeta: { ingresos: 100, egresos: 450, neto: -350, saldo: 0 },
      transferencias: [],
      egresosFijos: 0,
      egresosVariables: 600,
      egresosPorCategoria: [{ categoria_id: "cat-1", nombre: "Comida", monto: 600 }],
      ingresosPorCliente: [],
      recurrentesCobrados: [],
      transacciones: [
        {
          id: "tx-123",
          user_id: "u-1",
          categoria_id: "cat-1",
          monto: 450,
          fecha: "2026-09-14",
          descripcion: "Supermercado HEB despensa semanal",
          metodo_pago: "tarjeta",
          creado_en: "2026-09-14T12:00:00Z",
          categoria: { id: "cat-1", nombre: "Comida", tipo: "egreso", grupo: "variable" },
        },
        {
          id: "tx-124",
          user_id: "u-1",
          categoria_id: "cat-1",
          monto: 150,
          fecha: "2026-09-10",
          descripcion: "Pollo asado domingo",
          metodo_pago: "efectivo",
          creado_en: "2026-09-10T14:00:00Z",
          categoria: { id: "cat-1", nombre: "Comida", tipo: "egreso", grupo: "variable" },
        },
      ],
      totalTransaccionesMes: 2,
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
  assert.match(prompt, /Supermercado HEB despensa semanal/);
  assert.match(prompt, /Pollo asado domingo/);
  assert.match(prompt, /id:tx-123/);
  assert.match(prompt, /TOP 5 COMPRAS INDIVIDUALES/);
});
