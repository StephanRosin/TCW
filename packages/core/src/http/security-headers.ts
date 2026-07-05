/**
 * Sicherheits-HTTP-Header für Public- und Admin-Server.
 *
 * Framework-unabhängig als einfache Schlüssel/Wert-Tabelle, damit beide Server
 * (Fastify) sie über einen onSend-Hook setzen können.
 */
// SHA-256 der inline <script type="importmap"> des 3D-Rundgangs
// (apps/waidcup-public/public/tcw3d/index.html). Erlaubt genau dieses eine
// Inline-Skript unter strenger CSP (kein 'unsafe-inline'); ohne die Importmap
// kann die 3D-App den Bare-Specifier "three" nicht auflösen. Ein Guard-Test
// berechnet den Hash aus der index.html neu (bricht bei künftigem Drift).
export const TCW3D_IMPORTMAP_HASH = "sha256-xYMmED1D3yo68reiI6d0pzfkimg21wG1wTBh9Sl7jVQ=";

const PUBLIC_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' '${TCW3D_IMPORTMAP_HASH}'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  // 'self' für den eingebetteten 3D-Rundgang (/tcw3d im iframe der Waidcup-Seite),
  // dazu die Google-Maps-Karte auf der Standort-Seite; wir selbst bleiben durch
  // frame-ancestors 'self' weiterhin gegen fremdes Framing geschützt.
  "frame-src 'self' https://www.google.com",
].join("; ");

const COMMON_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/** Header für den öffentlichen Server inklusive strenger Content-Security-Policy. */
export const PUBLIC_SECURITY_HEADERS: Record<string, string> = {
  ...COMMON_SECURITY_HEADERS,
  "Content-Security-Policy": PUBLIC_CONTENT_SECURITY_POLICY,
};

const ADMIN_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

/** Header für den internen Admin-Server inkl. CSP (Defense-in-Depth). */
export const ADMIN_SECURITY_HEADERS: Record<string, string> = {
  ...COMMON_SECURITY_HEADERS,
  "Content-Security-Policy": ADMIN_CONTENT_SECURITY_POLICY,
};
