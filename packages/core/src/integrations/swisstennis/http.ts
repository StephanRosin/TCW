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
