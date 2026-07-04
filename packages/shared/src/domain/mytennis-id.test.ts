import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMyTennisId, myTennisUrlFromId } from "./mytennis-id.js";

test("parseMyTennisId: /spieler/<id> und /player/<id>", () => {
  assert.equal(parseMyTennisId("https://www.mytennis.ch/de/spieler/177712"), "177712");
  assert.equal(parseMyTennisId("https://www.mytennis.ch/de/player/900004"), "900004");
  assert.equal(parseMyTennisId("https://www.mytennis.ch/de/spieler/19799660?x=1"), "19799660");
});

test("parseMyTennisId: ungueltig -> null", () => {
  assert.equal(parseMyTennisId(""), null);
  assert.equal(parseMyTennisId(null), null);
  assert.equal(parseMyTennisId("https://example.com/de/spieler/1"), null);
  assert.equal(parseMyTennisId("https://www.mytennis.ch/de/spieler/abc"), null);
});

test("myTennisUrlFromId: string id -> URL", () => {
  assert.equal(
    myTennisUrlFromId("177712"),
    "https://www.mytennis.ch/de/spieler/177712"
  );
});

test("myTennisUrlFromId: number id -> URL", () => {
  assert.equal(
    myTennisUrlFromId(177712),
    "https://www.mytennis.ch/de/spieler/177712"
  );
});

test("myTennisUrlFromId: invalid inputs -> null", () => {
  assert.equal(myTennisUrlFromId(""), null);
  assert.equal(myTennisUrlFromId(null), null);
  assert.equal(myTennisUrlFromId(undefined), null);
  assert.equal(myTennisUrlFromId("abc"), null);
  assert.equal(myTennisUrlFromId("12a"), null);
});

test("myTennisUrlFromId: round-trip with parseMyTennisId", () => {
  const id = "177712";
  const url = myTennisUrlFromId(id);
  assert.equal(parseMyTennisId(url), id);
});
