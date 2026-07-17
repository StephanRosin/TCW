/**
 * Waidcup-Adminseite (chromelos, Route #admin): login-geschützt, erst mal nur
 * mit der Aktion „Order of Play aktualisieren" (löst den Sofort-Refresh am
 * Server aus). Die Sichtbarkeit der Seite ist harmlos – jede Aktion prüft
 * serverseitig das Login-Cookie.
 */
import { useEffect, useState, type FormEvent, type JSX } from "react";
import { waidcupApi } from "../../api/client.js";

type Phase = "loading" | "disabled" | "anon" | "authed";

interface RefreshInfo {
  matchesScoped: number;
  written: number;
  at: string;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function LoginForm({ onSuccess }: Readonly<{ onSuccess: () => void }>): JSX.Element {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await waidcupApi.admin.login(password);
      onSuccess();
    } catch (err) {
      setError((err as Error).message === "invalid" ? "Passwort falsch." : "Login fehlgeschlagen.");
      setBusy(false);
    }
  };

  return (
    <form className="wc-admin__card" onSubmit={(event) => void submit(event)}>
      <h1 className="wc-admin__title">Waidcup Admin</h1>
      <label className="wc-admin__label" htmlFor="wc-admin-user">
        Benutzer
      </label>
      <input id="wc-admin-user" className="wc-admin__input" value="admin" readOnly autoComplete="username" />
      <label className="wc-admin__label" htmlFor="wc-admin-pass">
        Passwort
      </label>
      <input
        id="wc-admin-pass"
        className="wc-admin__input"
        type="password"
        value={password}
        autoFocus
        autoComplete="current-password"
        onChange={(event) => setPassword(event.target.value)}
      />
      {error ? <div className="wc-admin__error">{error}</div> : null}
      <button className="wc-admin__btn" type="submit" disabled={busy || password === ""}>
        {busy ? "Anmelden …" : "Anmelden"}
      </button>
    </form>
  );
}

function RefreshPanel({ onLogout }: Readonly<{ onLogout: () => void }>): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<RefreshInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await waidcupApi.admin.refreshOrderOfPlay();
      setInfo({ matchesScoped: result.matchesScoped, written: result.written, at: result.at });
    } catch {
      setError("Aktualisierung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async (): Promise<void> => {
    await waidcupApi.admin.logout();
    onLogout();
  };

  return (
    <div className="wc-admin__card">
      <h1 className="wc-admin__title">Waidcup Admin</h1>
      <div className="wc-admin__section">
        <h2 className="wc-admin__section-title">Order of Play</h2>
        <p className="wc-admin__hint">
          Holt heute &amp; morgen frisch von Swisstennis (Termine und Ergebnisse) – ohne auf den
          regulären Import zu warten.
        </p>
        <button className="wc-admin__btn" type="button" onClick={() => void refresh()} disabled={busy}>
          {busy ? "Aktualisiere …" : "Order of Play aktualisieren"}
        </button>
        {info ? (
          <div className="wc-admin__result">
            ✓ {info.matchesScoped} Partien abgeglichen, {info.written} aktualisiert (heute + morgen).
            <br />
            Stand {timeLabel(info.at)} Uhr.
          </div>
        ) : null}
        {error ? <div className="wc-admin__error">{error}</div> : null}
      </div>
      <button className="wc-admin__logout" type="button" onClick={() => void logout()}>
        Abmelden
      </button>
    </div>
  );
}

export function AdminView(): JSX.Element {
  const [phase, setPhase] = useState<Phase>("loading");

  const loadSession = (): void => {
    waidcupApi.admin
      .session()
      .then((session) => {
        if (!session.enabled) setPhase("disabled");
        else setPhase(session.authenticated ? "authed" : "anon");
      })
      .catch(() => setPhase("anon"));
  };

  useEffect(loadSession, []);

  return (
    <div className="wc-admin">
      {phase === "loading" ? <div className="wc-admin__card">Lädt …</div> : null}
      {phase === "disabled" ? (
        <div className="wc-admin__card">Die Adminseite ist auf diesem Server nicht konfiguriert.</div>
      ) : null}
      {phase === "anon" ? <LoginForm onSuccess={() => setPhase("authed")} /> : null}
      {phase === "authed" ? <RefreshPanel onLogout={() => setPhase("anon")} /> : null}
    </div>
  );
}
