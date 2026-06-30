/**
 * Gemeinsame Low-Level-HTTP-Anfrage an Swisstennis-Hosts (Wettbewerbs-Servlets
 * und MyTennis-Spielersuche). Einziger Netzwerk-Einstieg: setzt Timeout/Abbruch
 * und prüft den Statuscode. Das Parsen (XML bzw. JSON) bleibt beim Aufrufer.
 */
export interface SwisstennisRequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

/** Führt eine Anfrage mit Timeout aus und wirft bei Nicht-200-Status. */
export async function requestSwisstennis(url: string, options: SwisstennisRequestOptions): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Swisstennis antwortete mit HTTP ${response.status} für ${url}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/** Liest den Charset-Namen aus einem Content-Type-Header (Default utf-8). */
function charsetOf(contentType: string | null): string {
  const match = /charset=([^;]+)/i.exec(contentType ?? "");
  return (match?.[1] ?? "utf-8").trim().toLowerCase();
}

/** TextDecoder für das Charset, mit Fallback auf utf-8 bei unbekanntem Label. */
function decoderFor(charset: string) {
  try {
    return new TextDecoder(charset);
  } catch {
    return new TextDecoder("utf-8");
  }
}

/**
 * Liest den Antworttext anhand des im Content-Type deklarierten Charsets.
 *
 * Nötig, weil einige Swisstennis-Servlets (z. B. DrawResults der Playoffs)
 * Umlaute als rohe ISO-8859-1-Bytes liefern. `Response.text()` dekodiert nach
 * Fetch-Spezifikation immer als UTF-8 und würde diese Bytes zerstören
 * (Grünfeld → Gr�nfeld). Andere Servlets liefern dieselben Umlaute als
 * numerische Entities – diese sind reines ASCII und überstehen jede Kodierung.
 */
export async function readResponseText(response: Response): Promise<string> {
  const charset = charsetOf(response.headers.get("content-type"));
  const buffer = await response.arrayBuffer();
  return decoderFor(charset).decode(buffer);
}
