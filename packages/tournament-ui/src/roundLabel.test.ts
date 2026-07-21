import assert from "node:assert/strict";
import { test } from "node:test";
import { translateRound } from "./roundLabel.js";

// Fake-t: gibt "<key>|<number?>" zurück, damit der gewählte Key sichtbar ist.
const t = (key: string, params?: Record<string, string | number>): string =>
  params && "number" in params ? `${key}|${params.number}` : key;

test("translateRound: benannte Runden → passender i18n-Key", () => {
  assert.equal(translateRound("Final", t), "round.final");
  assert.equal(translateRound("Halbfinal", t), "round.semifinal");
  assert.equal(translateRound("Viertelfinal", t), "round.quarterfinal");
  assert.equal(translateRound("Achtelfinal", t), "round.round16");
});

test("translateRound: 1/N-Final-Runden → round.round<Spielerzahl> (bis 1/128)", () => {
  assert.equal(translateRound("1/16 Final", t), "round.round32");
  assert.equal(translateRound("1/32 Final", t), "round.round64");
  assert.equal(translateRound("1/64 Final", t), "round.round128");
  assert.equal(translateRound("1/128 Final", t), "round.round256");
});

test("translateRound: unbekannte Runde (z. B. Gruppe) bleibt unverändert", () => {
  assert.equal(translateRound("Mixed", t), "Mixed");
  assert.equal(translateRound("Gruppe A", t), "Gruppe A");
});

test("translateRound: Runde-N-Fallback nutzt round.round mit Nummer", () => {
  assert.equal(translateRound("Runde 9", t), "round.round|9");
});
