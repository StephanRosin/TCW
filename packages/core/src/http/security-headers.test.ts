import assert from "node:assert/strict";
import { test } from "node:test";
import { PUBLIC_SECURITY_HEADERS } from "./security-headers.js";

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
