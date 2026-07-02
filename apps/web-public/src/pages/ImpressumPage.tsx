/**
 * Impressum Page - Legal information and LLM credit
 */
import type { JSX } from "react";

export function ImpressumPage(): JSX.Element {
  return (
    <div style={{ maxWidth: "800px", margin: "2rem auto", padding: "1rem" }}>
      <h1>Impressum</h1>

      <section style={{ marginTop: "2rem" }}>
        <h2>Verantwortlich für den Inhalt</h2>
        <p>
          <strong>Interclub (TCW)</strong><br />
          Musterstraße 123<br />
          8000 Zürich<br />
          Schweiz
        </p>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Kontakt</h2>
        <p>
          E-Mail: <a href="mailto:contact@interclub.ch">contact@interclub.ch</a><br />
          Website: <a href="/">Zurück zur Startseite</a>
        </p>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Technologie</h2>
        <p>
          Diese Website wurde mit Hilfe von <strong>Claude Haiku 4.5</strong> entwickelt.
          Claude Haiku ist ein KI-Sprachmodell von Anthropic, das bei der Implementierung
          dieser Webanwendung verwendet wurde.
        </p>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Haftungsausschluss</h2>
        <p>
          Der Autor übernimmt keinerlei Gewähr für die Aktualität, Korrektheit, Vollständigkeit
          oder Qualität der bereitgestellten Informationen. Haftungsansprüche gegen den Autor,
          die sich auf Schäden materieller oder ideeller Art beziehen, die durch die Nutzung
          oder Nichtnutzung der dargebotenen Informationen bzw. durch die Nutzung fehlerhafter
          und unvollständiger Informationen verursacht wurden, sind ausgeschlossen.
        </p>
      </section>

      <div style={{ marginTop: "3rem", paddingTop: "2rem", borderTop: "1px solid #ccc" }}>
        <p>
          <a href="/" style={{ color: "#0066cc", textDecoration: "none" }}>← Zurück zur Startseite</a>
        </p>
      </div>
    </div>
  );
}
