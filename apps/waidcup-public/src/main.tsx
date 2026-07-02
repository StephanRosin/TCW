import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { getStoredTheme } from "@tcw/tournament-ui";
import "@tcw/shared/styles/app.css";
import "./styles/waidcup.css";

// Gespeichertes Farbthema früh anwenden (Default: Club) – wie auf der Hauptseite.
document.documentElement.dataset.theme = getStoredTheme();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root-Element #root wurde nicht gefunden.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
