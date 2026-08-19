/**
 * ESLint-Flat-Config für das Monorepo.
 *
 * - Basis: ESLint- und typescript-eslint-Empfehlungen (ohne typgestützte Regeln,
 *   damit der Lauf schnell bleibt; Typprüfung übernimmt `tsc -b`).
 * - Browser-Pakete (web-public/web-admin) zusätzlich mit den React-Hooks-Regeln.
 * - Node-Pakete (Server, Core, Shared, Skripte) mit Node-Globals.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.d.ts",
      // Vendorter Snapshot der 3D-App aus dem separaten 3DTCW-Repo. Fremder
      // Code, der hier nur mitdeployt wird - Lint-Regeln dieses Projekts
      // gelten dafuer nicht.
      "apps/waidcup-public/public/tcw3d/**",
      // Werkzeug-Skripte der Claude-Skills, kein Anwendungscode.
      ".claude/skills/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: [
      "apps/web-public/**/*.{ts,tsx}",
      "apps/web-admin/**/*.{ts,tsx}",
      "apps/waidcup-public/**/*.{ts,tsx}",
      "packages/tournament-ui/**/*.{ts,tsx}",
    ],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Bewusst aus: Die Lade-Hooks (useResource/useAsync) und die Admin-Formulare
      // setzen State in Effects nach einem Fetch bzw. beim Seeden von Entwürfen aus
      // geladenen Daten – das idiomatische Async-Muster. Die korrektheitskritischen
      // Regeln rules-of-hooks und exhaustive-deps bleiben aktiv.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["apps/*-server/**/*.ts", "packages/**/*.ts", "scripts/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
);
