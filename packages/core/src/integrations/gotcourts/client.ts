/**
 * GotCourts-Client (serverseitig): Login → ApiKey → Reservationsliste.
 *
 * Bildet den Ablauf der bestehenden cm-platz-Integration nach:
 *  1. GET /de/                       – Session-Cookies setzen
 *  2. POST /de/api2/public/login/web – anmelden (form-urlencoded)
 *  3. GET /user/apikey               – ApiKey holen
 *  4. GET /api/secured/club/reservation/list?clubId&date – Belegung
 *
 * Cookies werden manuell weitergereicht (fetch hat keinen Cookie-Jar).
 */
const BASE_URL = "https://apps.gotcourts.com";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64; rv:151.0) Gecko/20100101 Firefox/151.0";

export interface GotCourtsCredentials {
  email: string;
  password: string;
  clubId: number;
  timeoutMs: number;
}

type CookieJar = Map<string, string>;

function rememberCookies(jar: CookieJar, response: Response): void {
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";", 1)[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq > 0) {
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
}

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(
  jar: CookieJar,
  path: string,
  options: { method?: "GET" | "POST"; body?: string; apiKey?: string; timeoutMs: number },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Accept-Language": "de,en-US;q=0.9,en;q=0.8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${BASE_URL}/de/`,
    };
    const existing = cookieHeader(jar);
    if (existing !== "") headers.Cookie = existing;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
    }
    if (options.apiKey) headers["X-GOTCOURTS"] = `ApiKey="${options.apiKey}"`;
    const response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body,
      signal: controller.signal,
    });
    rememberCookies(jar, response);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/** Meldet sich an und liefert (Cookie-Jar, ApiKey) für gesicherte Abrufe. */
async function login(credentials: GotCourtsCredentials): Promise<{ jar: CookieJar; apiKey: string }> {
  const jar: CookieJar = new Map();
  await request(jar, "/de/", { timeoutMs: credentials.timeoutMs });

  const body = new URLSearchParams({
    username: credentials.email,
    password: credentials.password,
    rememberMe: "true",
    captchaToken: "",
  }).toString();
  const loginResponse = await request(jar, "/de/api2/public/login/web", {
    method: "POST",
    body,
    timeoutMs: credentials.timeoutMs,
  });
  const loginJson = (await loginResponse.json()) as { status?: string };
  if (loginJson.status !== "success" && loginJson.status !== "ok") {
    // GotCourts liefert bei Erfolg status "success"; andernfalls abbrechen.
    if (!loginResponse.ok) {
      throw new Error(`GotCourts-Login fehlgeschlagen (HTTP ${loginResponse.status}).`);
    }
  }

  const keyResponse = await request(jar, "/user/apikey", { timeoutMs: credentials.timeoutMs });
  const keyJson = (await keyResponse.json()) as { apiKey?: string };
  if (!keyJson.apiKey) {
    throw new Error("GotCourts lieferte keinen ApiKey.");
  }
  return { jar, apiKey: keyJson.apiKey };
}

/** Rohstruktur der Reservationsliste (nur die genutzten Felder). */
export interface GotCourtsRawCourt {
  id: number;
  label: string;
}
export interface GotCourtsRawEntry {
  courtId: number;
  startTime: number;
  endTime: number;
  text?: string;
  shortDesc?: string;
  type?: string;
}
export interface GotCourtsReservationList {
  courts: GotCourtsRawCourt[];
  reservations: GotCourtsRawEntry[];
  blockings: GotCourtsRawEntry[];
}

/** Holt die Belegung eines Tages ("YYYY-MM-DD"). */
export async function fetchReservationList(
  credentials: GotCourtsCredentials,
  date: string,
): Promise<GotCourtsReservationList> {
  const { jar, apiKey } = await login(credentials);
  const query = new URLSearchParams({ clubId: String(credentials.clubId), date }).toString();
  const response = await request(jar, `/api/secured/club/reservation/list?${query}`, {
    apiKey,
    timeoutMs: credentials.timeoutMs,
  });
  if (!response.ok) {
    throw new Error(`GotCourts-Reservationsliste fehlgeschlagen (HTTP ${response.status}).`);
  }
  const json = (await response.json()) as {
    response?: {
      club?: { courts?: GotCourtsRawCourt[] };
      reservations?: GotCourtsRawEntry[];
      blockings?: GotCourtsRawEntry[];
    };
  };
  const payload = json.response ?? {};
  return {
    courts: payload.club?.courts ?? [],
    reservations: payload.reservations ?? [],
    blockings: payload.blockings ?? [],
  };
}
