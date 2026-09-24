import assert from "node:assert/strict";
import test from "node:test";
import { montoPositivo } from "./dashboard/validation";

test("normaliza importes positivos a centavos", () => {
  assert.equal(montoPositivo(12.345), 12.35);
});

test("rechaza importes que se convertirían en cero", () => {
  assert.throws(() => montoPositivo(0.001), /mayor a 0/);
  assert.throws(() => montoPositivo(Number.NaN), /mayor a 0/);
  assert.throws(() => montoPositivo(-1), /mayor a 0/);
});
