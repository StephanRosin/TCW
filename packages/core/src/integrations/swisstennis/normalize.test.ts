import assert from "node:assert/strict";
import { test } from "node:test";
import { asArray, cleanText, toNumber } from "./normalize.js";

test("asArray glättet Einzelobjekte und filtert null/undefined", () => {
  assert.deepEqual(asArray(["a", "b"]), ["a", "b"]);
  assert.deepEqual(asArray("x"), ["x"]);
  assert.deepEqual(asArray(null), []);
  assert.deepEqual(asArray(undefined), []);
});

test("toNumber liefert endliche Zahl oder Fallback", () => {
  assert.equal(toNumber("5"), 5);
  assert.equal(toNumber("3.5"), 3.5);
  assert.equal(toNumber(undefined), 0);
  assert.equal(toNumber("keine Zahl", -1), -1);
});

test("cleanText ersetzt geschützte Leerzeichen und reduziert Whitespace", () => {
  assert.equal(cleanText("Anna Muster"), "Anna Muster");
  assert.equal(cleanText("  viel   Raum \n hier "), "viel Raum hier");
  assert.equal(cleanText(null), "");
});
