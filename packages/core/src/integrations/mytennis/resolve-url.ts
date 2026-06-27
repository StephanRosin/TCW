/**
 * Auflösung der MyTennis-Spielerprofil-URL über die Suchschnittstelle.
 *
 * Ein Treffer wird nur akzeptiert, wenn die Lizenznummer exakt übereinstimmt,
 * damit keine falschen Profile verlinkt werden.
 */
const SEARCH_URL = "https://high-scalability.microservices.swisstennis.ch/main-index-query";
const PLAYER_PROFILE_BASE = "https://www.mytennis.ch/de/spieler";

const SEARCH_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Origin: "https://www.mytennis.ch",
  Referer: "https://www.mytennis.ch/",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
};

function normalizeLicense(value: string): string {
  return value.replace(/\D+/g, "");
}

interface SearchHit {
  _source?: { type?: string; number?: string | number; rawId?: string | number };
}

/** Liefert die Profil-URL des Spielers mit passender Lizenz oder "". */
export async function resolveMyTennisPlayerUrl(
  firstName: string,
  lastName: string,
  license: string,
  timeoutMs: number,
): Promise<string> {
  const targetLicense = normalizeLicense(license);
  if (targetLicense === "") {
    return "";
  }
  const keyword = `${firstName} ${lastName}`.trim();
  if (keyword === "") {
    return "";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(SEARCH_URL, {
      method: "POST",
      headers: SEARCH_HEADERS,
      body: JSON.stringify({ keyword, offset: 0, limit: 10 }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return "";
    }
    const payload = (await response.json()) as { hits?: { hits?: SearchHit | SearchHit[] } };
    const hits = payload.hits?.hits;
    const list = Array.isArray(hits) ? hits : hits ? [hits] : [];
    for (const hit of list) {
      const source = hit._source;
      if (source?.type === "player" && normalizeLicense(String(source.number ?? "")) === targetLicense) {
        return `${PLAYER_PROFILE_BASE}/${source.rawId}`;
      }
    }
    return "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}
