import assert from "node:assert/strict";
import { test } from "node:test";
import { SCREEN_INDEX } from "./screenDriver.js";

test("SCREEN_INDEX bildet die vier Screens auf die 3D-Indizes 0..3 ab", () => {
  assert.equal(SCREEN_INDEX.location, 0);
  assert.equal(SCREEN_INDEX.infos, 1);
  assert.equal(SCREEN_INDEX.orderofplay, 2);
  assert.equal(SCREEN_INDEX.live, 3);
});
