import { test } from "node:test";
import assert from "node:assert";
import { toNum } from "./utils";

/**
 * P-3: toNum debe parsear el formato numérico colombiano (coma decimal, punto de
 * miles) en la rama string, sin alterar la rama `number`. Antes hacía
 * replace(/,/g,"") global → "1.234.567,89" se volvía 1.234.
 */

test("P-3: strings en formato colombiano (coma decimal, punto miles)", () => {
  assert.strictEqual(toNum("1.234.567,89"), 1234567.89);
  assert.strictEqual(toNum("1.234,5"), 1234.5);
  assert.strictEqual(toNum("1234,56"), 1234.56);
});

test("P-3: la rama number queda intacta", () => {
  assert.strictEqual(toNum(1234567.89), 1234567.89);
  assert.strictEqual(toNum(0), 0);
  assert.strictEqual(toNum(-500.25), -500.25);
});

test("P-3: vacíos y no numéricos → 0", () => {
  assert.strictEqual(toNum(""), 0);
  assert.strictEqual(toNum("abc"), 0);
  assert.strictEqual(toNum(null), 0);
  assert.strictEqual(toNum(undefined), 0);
});

test("P-3: casos anglosajón / sin separador siguen funcionando", () => {
  assert.strictEqual(toNum("1234.56"), 1234.56); // punto decimal solo
  assert.strictEqual(toNum("1234"), 1234);
  assert.strictEqual(toNum("1.234.567,00"), 1234567);
});
