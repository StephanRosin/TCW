/**
 * Waidcup-Adminseite (chromelos, Route #admin): login-geschützt, erst mal nur
 * mit der Aktion „Order of Play aktualisieren" (löst den Sofort-Refresh am
 * Server aus). Die Sichtbarkeit der Seite ist harmlos – jede Aktion prüft
 * serverseitig das Login-Cookie.
 */
import { useEffect, useState, type FormEvent, type JSX } from "react";
import { waidcupApi } from "../../api/client.js";
import { PaymentsPanel } from "./PaymentsPanel.js";

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

function RefreshTab(): JSX.Element {
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

  return (
    <div className="wc-admin__section">
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
  );
}

type AdminTab = "refresh" | "payments";

function AuthedView({ onLogout }: Readonly<{ onLogout: () => void }>): JSX.Element {
  const [tab, setTab] = useState<AdminTab>("refresh");

  const logout = async (): Promise<void> => {
    await waidcupApi.admin.logout();
    onLogout();
  };

  return (
    <div className="wc-admin__card wc-admin__card--wide">
      <div className="wc-admin__head">
        <h1 className="wc-admin__title">Waidcup Admin</h1>
        <button className="wc-admin__logout" type="button" onClick={() => void logout()}>
          Abmelden
        </button>
      </div>
      <div className="wc-admin__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={tab === "refresh" ? "wc-admin__tab is-active" : "wc-admin__tab"}
          aria-selected={tab === "refresh"}
          onClick={() => setTab("refresh")}
        >
          Order of Play
        </button>
        <button
          type="button"
          role="tab"
          className={tab === "payments" ? "wc-admin__tab is-active" : "wc-admin__tab"}
          aria-selected={tab === "payments"}
          onClick={() => setTab("payments")}
        >
          Bezahlt
        </button>
      </div>
      {tab === "refresh" ? <RefreshTab /> : <PaymentsPanel />}
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
      {phase === "authed" ? <AuthedView onLogout={() => setPhase("anon")} /> : null}
    </div>
  );
}
