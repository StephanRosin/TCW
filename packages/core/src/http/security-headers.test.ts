import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PUBLIC_SECURITY_HEADERS, TCW3D_IMPORTMAP_HASH } from "./security-headers.js";

test("Public-CSP erlaubt Self-Framing für den 3D-Rundgang und Google-Maps", () => {
  const csp = PUBLIC_SECURITY_HEADERS["Content-Security-Policy"];
  const frameSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("frame-src "));
  assert.ok(frameSrc, "frame-src-Direktive vorhanden");
  // 'self' ist nötig, damit der /tcw3d-iframe auf der Waidcup-Seite geladen wird.
  assert.match(frameSrc!, /'self'/, "frame-src erlaubt 'self'");
  assert.match(frameSrc!, /https:\/\/www\.google\.com/, "frame-src erlaubt weiterhin Google Maps");
});

test("Public-CSP schützt weiterhin gegen fremdes Framing (frame-ancestors 'self')", () => {
  const csp = PUBLIC_SECURITY_HEADERS["Content-Security-Policy"];
  assert.match(csp, /frame-ancestors 'self'/);
});

test("script-src erlaubt den Importmap-Hash des 3D-Rundgangs (Guard gegen Drift)", () => {
  const indexHtmlPath = fileURLToPath(
    new URL("../../../../apps/waidcup-public/public/tcw3d/index.html", import.meta.url),
  );
  const html = readFileSync(indexHtmlPath, "utf8");
  const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  assert.ok(match, "Inline-Importmap in tcw3d/index.html gefunden");
  const computed = `sha256-${createHash("sha256").update(match![1], "utf8").digest("base64")}`;
  // Wenn dieser Test bricht, hat sich die Importmap der 3D-App geändert:
  // TCW3D_IMPORTMAP_HASH in security-headers.ts auf `computed` aktualisieren.
  assert.equal(
    computed,
    TCW3D_IMPORTMAP_HASH,
    "Importmap-Hash weicht ab – TCW3D_IMPORTMAP_HASH aktualisieren",
  );
  assert.ok(
    PUBLIC_SECURITY_HEADERS["Content-Security-Policy"].includes(TCW3D_IMPORTMAP_HASH),
    "CSP script-src enthält den Importmap-Hash",
  );
});
