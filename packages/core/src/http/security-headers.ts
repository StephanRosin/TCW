/**
 * Sicherheits-HTTP-Header für Public- und Admin-Server.
 *
 * Framework-unabhängig als einfache Schlüssel/Wert-Tabelle, damit beide Server
 * (Fastify) sie über einen onSend-Hook setzen können.
 */
const PUBLIC_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  // Nur die eingebettete Google-Maps-Karte auf der Standort-Seite; wir selbst
  // bleiben durch frame-ancestors 'self' weiterhin gegen Framing geschützt.
  "frame-src https://www.google.com",
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
