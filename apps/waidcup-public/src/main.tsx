import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "@tcw/shared/styles/app.css";
import "./styles/waidcup.css";

// Die Waidcup-Seite läuft fest im Classic/Club-Look (kein Theme-Schalter).
document.documentElement.dataset.theme = "club";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root-Element #root wurde nicht gefunden.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
