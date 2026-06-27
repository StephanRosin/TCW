/**
 * MyTennis-Spielersuche mit robuster Namensnormalisierung.
 *
 * Sonderfälle, die erhalten bleiben müssen: Umlaute/Akzente (Hubeková →
 * Hubekova), Apostrophe/Bindestriche (O'Driscoll), zwei Vornamen sowie
 * mehrteilige Nachnamen. Die Suche probiert mehrere Namensvarianten.
 */
const SEARCH_URL = "https://high-scalability.microservices.swisstennis.ch/main-index-query";
const PLAYER_PROFILE_BASE = "https://www.mytennis.ch/de/spieler";

const SEARCH_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Origin: "https://www.mytennis.ch",
  Referer: "https://www.mytennis.ch/",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
};

export interface MyTennisHit {
  id: string;
  name: string;
  classification: string;
  license: string;
  url: string;
}

/** Entfernt diakritische Zeichen (ä→a, é→e), behält Buchstaben. */
function normalizeForSearch(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/** Erzeugt geordnete, deduplizierte Nachnamensvarianten. */
function lastNameVariants(lastName: string): string[] {
  const variants = new Set<string>();
  const add = (value: string): void => {
    const trimmed = value.trim();
    if (trimmed !== "") variants.add(trimmed);
  };
  add(lastName);
  add(normalizeForSearch(lastName));
  const collapsed = lastName.replace(/[-'’]/g, "");
  add(collapsed);
  add(normalizeForSearch(collapsed));
  const parts = lastName.split(/[-'’]/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1] ?? "";
    add(last);
    add(normalizeForSearch(last));
  }
  return [...variants];
}

interface NameQuery {
  first: string;
  last: string;
}

function buildQueries(fullName: string): NameQuery[] {
  const parts = fullName.trim().split(/\s+/).filter((part) => part !== "");
  if (parts.length < 2) {
    return [];
  }
  const first = parts[0]!;
  const lastOnly = parts[parts.length - 1]!;
  const rest = parts.slice(1).join(" ");

  const queries = new Map<string, NameQuery>();
  const addQueries = (firstValue: string, lastValue: string): void => {
    for (const last of lastNameVariants(lastValue)) {
      for (const candidateFirst of new Set([firstValue, normalizeForSearch(firstValue)])) {
        const query = { first: candidateFirst, last };
        queries.set(`${query.first}|${query.last}`.toLowerCase(), query);
      }
    }
  };
  addQueries(first, lastOnly);
  if (rest !== lastOnly) {
    addQueries(first, rest);
  }
  return [...queries.values()];
}

async function searchOnce(query: NameQuery, timeoutMs: number): Promise<MyTennisHit[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(SEARCH_URL, {
      method: "POST",
      headers: SEARCH_HEADERS,
      body: JSON.stringify({ keyword: `${query.first} ${query.last}`.trim(), offset: 0, limit: 50 }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as {
      hits?: { hits?: Array<{ _source?: Record<string, unknown> }> };
    };
    const hits = payload.hits?.hits ?? [];
    return hits
      .map((hit) => hit._source)
      .filter((source): source is Record<string, unknown> => source?.type === "player")
      .map((source) => ({
        id: String(source.rawId ?? ""),
        name: String(source.title ?? "–"),
        classification: String(source.classification ?? ""),
        license: String(source.number ?? ""),
        url: `${PLAYER_PROFILE_BASE}/${source.rawId}`,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/** Sucht über alle Namensvarianten und dedupliziert die Treffer nach URL. */
export async function searchPlayers(fullName: string, timeoutMs: number): Promise<MyTennisHit[]> {
  const queries = buildQueries(fullName);
  const byUrl = new Map<string, MyTennisHit>();
  for (const query of queries) {
    for (const hit of await searchOnce(query, timeoutMs)) {
      if (hit.url !== "" && !byUrl.has(hit.url)) {
        byUrl.set(hit.url, hit);
      }
    }
  }
  return [...byUrl.values()];
}

function scoreHit(hit: MyTennisHit, firstName: string, lastName: string): number {
  const hitName = normalizeForSearch(hit.name).toLowerCase();
  const first = normalizeForSearch(firstName).toLowerCase();
  const last = normalizeForSearch(lastName).toLowerCase();
  const full = `${first} ${last}`;
  const reversed = `${last} ${first}`;
  if (hitName === full || hitName === reversed) return 5;
  if (hitName.includes(first) && hitName.includes(last)) return 4;
  if (hitName.includes(last)) return 3;
  if (hitName.includes(first)) return 1;
  return 0;
}

/** Wählt den plausibelsten Treffer für einen Namen. */
export function chooseBestHit(
  hits: MyTennisHit[],
  firstName: string,
  lastName: string,
): MyTennisHit | null {
  let best: MyTennisHit | null = null;
  let bestScore = 0;
  for (const hit of hits) {
    const score = scoreHit(hit, firstName, lastName);
    if (score > bestScore) {
      best = hit;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}
