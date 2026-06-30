import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSwisstennisXml } from "./xml.js";

test("parseSwisstennisXml: Text als String, Attribute als Felder, Zahlen typisiert", () => {
  const obj = parseSwisstennisXml(
    '<root><Title>Abstieg</Title><draw alevel="2" rposition="0"><name>Anna Muster</name></draw></root>',
  ) as { root: { Title: string; draw: { alevel: number; rposition: number; name: string } } };
  assert.equal(obj.root.Title, "Abstieg");
  assert.equal(obj.root.draw.alevel, 2);
  assert.equal(obj.root.draw.rposition, 0);
  assert.equal(obj.root.draw.name, "Anna Muster");
});

test("parseSwisstennisXml: numerische Entities werden dekodiert (Umlaute)", () => {
  const obj = parseSwisstennisXml(
    "<root><a>M&#246;hrlen</a><b>L&#252;thi</b><c>B&#252;chi</c></root>",
  ) as { root: { a: string; b: string; c: string } };
  assert.equal(obj.root.a, "Möhrlen");
  assert.equal(obj.root.b, "Lüthi");
  assert.equal(obj.root.c, "Büchi");
});
