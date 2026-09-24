import test from "node:test";
import assert from "node:assert/strict";
import { diaCobroEnMes, fechaCobroEnMesVisto } from "@/components/recurring/dates";
import { filterTransactions } from "@/components/transactions/filter-transactions";
import type { TransaccionConCategoria } from "./types";

test("un cobro del día 31 permanece dentro del mes seleccionado", () => {
  assert.equal(diaCobroEnMes(2024, 2, 31), 29);
  assert.equal(fechaCobroEnMesVisto(2025, 2, 31, false, "2025-09-24"), "2025-02-28");
  assert.equal(fechaCobroEnMesVisto(2025, 9, 31, true, "2025-09-24"), "2025-09-24");
});

test("los filtros combinan texto, categoría y método sin modificar la lista original", () => {
  const items: TransaccionConCategoria[] = [
    {
      id: "1", user_id: "u", categoria_id: "c", monto: 50, fecha: "2025-09-01",
      descripcion: "Proyecto azul", creado_en: "2025-09-01", metodo_pago: "efectivo",
      categoria: { id: "c", nombre: "Honorarios", tipo: "ingreso", grupo: null },
      cliente: { id: "cl", nombre: "Ana" },
    },
    {
      id: "2", user_id: "u", categoria_id: "e", monto: 20, fecha: "2025-09-02",
      descripcion: "Café", creado_en: "2025-09-02", metodo_pago: "tarjeta",
      categoria: { id: "e", nombre: "Comida", tipo: "egreso", grupo: "variable" },
    },
  ];

  const resultado = filterTransactions(items, { busqueda: " ANA ", tipo: "ingreso", metodo: "efectivo" });
  assert.deepEqual(resultado.map((item) => item.id), ["1"]);
  assert.equal(items.length, 2);
  assert.deepEqual(filterTransactions(items, { busqueda: "comida", tipo: "ingreso", metodo: "todos" }), []);
});
