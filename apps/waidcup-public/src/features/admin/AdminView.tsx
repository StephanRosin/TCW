/**
 * Waidcup-Adminseite (Route #admin): im Look der Waidcup-Seite (gleiche Chrome
 * und Design-Tokens), login-geschützt. Tabs „Order of Play" (Sofort-Refresh)
 * und „Bezahlt" (Bezahlt-Tracking). Bewusst ohne Theme-/Sprachumschalter.
 */
import { useEffect, useState, type FormEvent, type JSX } from "react";
import { waidcupApi } from "../../api/client.js";
import { PaymentsPanel } from "./PaymentsPanel.js";

type Phase = "loading" | "disabled" | "anon" | "authed";
type AdminTab = "refresh" | "payments";

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
    <form className="card wc-admin__card wc-admin__card--login" onSubmit={(event) => void submit(event)}>
      <div className="card__head">Anmeldung</div>
      <div className="wc-admin__card-body">
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
        <button className="wc-admin__primary" type="submit" disabled={busy || password === ""}>
          {busy ? "Anmelden …" : "Anmelden"}
        </button>
      </div>
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
    <div className="card wc-admin__card">
      <div className="card__head">Order of Play &amp; Tableau</div>
      <div className="wc-admin__card-body">
        <p className="wc-admin__hint">
          Holt alles frisch von Swisstennis (Termine, Ergebnisse und Tableaux) – ohne auf den
          regulären Import zu warten.
        </p>
        <button className="wc-admin__primary" type="button" onClick={() => void refresh()} disabled={busy}>
          {busy ? "Aktualisiere …" : "Order of Play & Tableau aktualisieren"}
        </button>
        {info ? (
          <div className="wc-admin__result">
            ✓ Order of Play & Tableaux aktualisiert – {info.matchesScoped} Partien abgeglichen,{" "}
            {info.written} geändert.
            <br />
            Stand {timeLabel(info.at)} Uhr.
          </div>
        ) : null}
        {error ? <div className="wc-admin__error">{error}</div> : null}
      </div>
    </div>
  );
}

export function AdminView(): JSX.Element {
  const [phase, setPhase] = useState<Phase>("loading");
  const [tab, setTab] = useState<AdminTab>("refresh");

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

  const logout = async (): Promise<void> => {
    await waidcupApi.admin.logout();
    setPhase("anon");
  };

  const authed = phase === "authed";

  return (
    <div className="layout">
      <header className="site-header">
        <div className="container">
          <div className="site-header__top">
            <div className="brand">
              <img className="brand__logo" src="/logo-tcw.png" alt="TC Waidberg" />
              <div>
                <div className="brand__eyebrow">Waidcup 2026</div>
                <div className="brand__title">Administration</div>
              </div>
            </div>
            {authed ? (
              <button type="button" className="link-btn wc-admin__logout" onClick={() => void logout()}>
                Abmelden
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {authed ? (
        <nav className="tabbar" aria-label="Adminbereich">
          <div className="container tabbar__inner" role="tablist">
            <button
              type="button"
              role="tab"
              className="tabbar__btn"
              aria-selected={tab === "refresh"}
              onClick={() => setTab("refresh")}
            >
              Order of Play
            </button>
            <button
              type="button"
              role="tab"
              className="tabbar__btn"
              aria-selected={tab === "payments"}
              onClick={() => setTab("payments")}
            >
              Bezahlt
            </button>
          </div>
        </nav>
      ) : null}

      <main className="container wc-admin__main">
        {phase === "loading" ? <div className="wc-admin__note">Lädt …</div> : null}
        {phase === "disabled" ? (
          <div className="wc-admin__note">Die Adminseite ist auf diesem Server nicht konfiguriert.</div>
        ) : null}
        {phase === "anon" ? <LoginForm onSuccess={() => setPhase("authed")} /> : null}
        {authed && tab === "refresh" ? <RefreshTab /> : null}
        {authed && tab === "payments" ? <PaymentsPanel /> : null}
      </main>
    </div>
  );
}
