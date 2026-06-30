import assert from "node:assert/strict";
import { test } from "node:test";
import { readResponseText } from "./http.js";

function responseWith(bytes: Uint8Array, contentType: string): Response {
  return new Response(bytes, { headers: { "content-type": contentType } });
}

test("readResponseText: rohe ISO-8859-1-Bytes korrekt dekodieren (Playoff-Umlaute)", async () => {
  // "Grünfeld" als ISO-8859-1: ü = 0xFC. So liefert DrawResults die Umlaute.
  const bytes = new Uint8Array([0x47, 0x72, 0xfc, 0x6e, 0x66, 0x65, 0x6c, 0x64]);
  const text = await readResponseText(responseWith(bytes, "text/html;charset=iso-8859-1"));
  assert.equal(text, "Grünfeld");
});

test("readResponseText: numerische Entities bleiben unverändert (ASCII)", async () => {
  const bytes = new TextEncoder().encode("M&#246;hrlen");
  const text = await readResponseText(responseWith(bytes, "text/html;charset=iso-8859-1"));
  assert.equal(text, "M&#246;hrlen");
});

test("readResponseText: UTF-8-Antwort wird als UTF-8 dekodiert", async () => {
  const bytes = new TextEncoder().encode("Möhrlen");
  const text = await readResponseText(responseWith(bytes, "text/html;charset=utf-8"));
  assert.equal(text, "Möhrlen");
});

test("readResponseText: fehlendes Charset fällt auf utf-8 zurück", async () => {
  const bytes = new TextEncoder().encode("Müller");
  const text = await readResponseText(responseWith(bytes, "text/html"));
  assert.equal(text, "Müller");
});
