import { test } from "node:test";
import assert from "node:assert/strict";
import { paginaHistorial, patronBusqueda, valorLogico } from "./search";
import { esFechaISO, esMesCalendario, rangoDelMes } from "./dates";
import { parsearMonto, redondearMonto } from "./format";

test("no se guardan importes truncados o ambiguos", () => {
  for (const valor of ["100abc", "1,000.00", "1.001", "1e3", "", "Infinity"]) assert.equal(Number.isNaN(parsearMonto(valor)), true, valor);
  assert.equal(parsearMonto(" 12,50 "), 12.5);
  assert.equal(parsearMonto("-12.50"), -12.5);
  assert.equal(redondearMonto(1.005), 1.01);
  assert.equal(redondearMonto(-1.005), -1.01);
});

test("el historial limita y normaliza offsets no válidos", () => {
  assert.deepEqual(paginaHistorial(Infinity, NaN), { limite: 50, offset: 0 });
  assert.deepEqual(paginaHistorial(100, -4), { limite: 50, offset: 0 });
  assert.deepEqual(paginaHistorial(3.8, 50.9), { limite: 3, offset: 50 });
});
test("los signos de búsqueda se conservan dentro de un valor entre comillas", () => {
  assert.equal(valorLogico('café, ("casa")'), '"café, (\\"casa\\")"');
  assert.equal(patronBusqueda('  50%_  '), '%50\\%\\_%');
});
test("fechas y límites de calendario", () => {
  assert.equal(esFechaISO("2026-02-29"), false);
  assert.equal(esFechaISO("2024-02-29"), true);
  assert.equal(esMesCalendario(1999, 12), false);
  assert.equal(esMesCalendario(2100, 12), true);
  assert.deepEqual(rangoDelMes(2026, 12), { inicio: "2026-12-01", finExclusivo: "2027-01-01" });
});
