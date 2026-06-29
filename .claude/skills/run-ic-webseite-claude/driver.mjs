#!/usr/bin/env node
// Dependency-free Chromium DevTools-Protocol driver for the TCW Spielbetrieb
// web apps. No Playwright / no chromium-cli needed — just the system
// `chromium` binary and Node >= 22 (global WebSocket + fetch).
//
// Usage:  pipe a newline-separated script to stdin, e.g.
//   node driver.mjs <<'EOF'
//   nav http://localhost:5173
//   wait-for text=Teams
//   screenshot public-home
//   click button:has-text(Herren)
//   screenshot public-herren
//   console-errors
//   EOF
//
// Commands (one per line, # = comment, blank lines ignored):
//   nav <url>                 navigate and wait for load
//   wait-for <sel>            wait until selector exists (css, or `text=...`)
//   click <sel>              click first match (css, or `text=...`)
//   fill <sel> <value>        set an input value the React way (native setter)
//   type <text>              dispatch keystrokes to the focused element
//   eval <js>                 evaluate JS in the page, print the result
//   text <sel>               print textContent of first match
//   screenshot [name]        full-page PNG -> screenshots/<name>.png (+ latest.png)
//   console-errors           print collected console.error + page exceptions
//   sleep <ms>               wait (use sparingly; prefer wait-for)
//
// Screenshots land in <skill>/screenshots/. `latest.png` always points at
// the most recent one.

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "screenshots");
mkdirSync(SHOTS, { recursive: true });

const CHROME = process.env.CHROMIUM_BIN || "chromium";
const PORT = Number(process.env.CDP_PORT || 9333);
const WIDTH = Number(process.env.CDP_WIDTH || 1280);
const HEIGHT = Number(process.env.CDP_HEIGHT || 2200);

// ---- launch headless chromium -------------------------------------------
const userDir = join("/tmp", `ic-cdp-${PORT}`);
const chrome = spawn(CHROME, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${userDir}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "ignore"] });

function cleanup() { try { chrome.kill("SIGKILL"); } catch {} }
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });

// ---- find the page target's websocket -----------------------------------
async function pageWs() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await r.json();
      const page = targets.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* chromium not ready yet */ }
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error("Chromium DevTools endpoint never came up");
}

// ---- minimal CDP client over WebSocket ----------------------------------
const ws = new WebSocket(await pageWs());
const pending = new Map();
const errors = [];
let nextId = 1;

await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    return;
  }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    errors.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
  }
  if (msg.method === "Runtime.exceptionThrown") {
    errors.push("EXCEPTION: " + (msg.params.exceptionDetails.exception?.description
      || msg.params.exceptionDetails.text));
  }
};

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

await send("Page.enable");
await send("Runtime.enable");
await send("DOM.enable");

// JS helper injected for selectors: supports css and `text=substring`
const finder = (sel) => `(() => {
  const s = ${JSON.stringify(sel)};
  if (s.startsWith('text=')) {
    const t = s.slice(5);
    const els = [...document.querySelectorAll('button,a,h1,h2,h3,span,div,li,td,th,label')];
    return els.find(e => e.textContent && e.textContent.includes(t)) || null;
  }
  // pseudo :has-text(...) support  ->  tag:has-text(Label)
  const m = s.match(/^(.*):has-text\\((.*)\\)$/);
  if (m) {
    const base = m[1] || '*';
    return [...document.querySelectorAll(base)].find(e => e.textContent && e.textContent.includes(m[2])) || null;
  }
  return document.querySelector(s);
})()`;

// ---- command implementations --------------------------------------------
async function nav(url) {
  const loaded = new Promise((res) => {
    const h = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === "Page.loadEventFired") { ws.removeEventListener("message", h); res(); }
    };
    ws.addEventListener("message", h);
  });
  await send("Page.navigate", { url });
  await Promise.race([loaded, new Promise((r) => setTimeout(r, 20000))]);
}

async function waitFor(sel, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evalJs(`!!${finder(sel)}`)) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`wait-for timed out: ${sel}`);
}

async function click(sel) {
  const ok = await evalJs(`(() => { const el = ${finder(sel)}; if (!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true; })()`);
  if (!ok) throw new Error(`click: not found: ${sel}`);
}

async function fill(sel, value) {
  const ok = await evalJs(`(() => {
    const el = ${finder(sel)};
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!ok) throw new Error(`fill: not found: ${sel}`);
}

async function screenshot(name) {
  const file = `${name || "shot"}.png`;
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const path = join(SHOTS, file);
  writeFileSync(path, Buffer.from(data, "base64"));
  copyFileSync(path, join(SHOTS, "latest.png"));
  console.log(`screenshot -> ${path}`);
}

// ---- run the piped script -----------------------------------------------
const script = await new Promise((res) => {
  let buf = "";
  process.stdin.on("data", (c) => (buf += c));
  process.stdin.on("end", () => res(buf));
});

for (const raw of script.split("\n")) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const sp = line.indexOf(" ");
  const cmd = sp === -1 ? line : line.slice(0, sp);
  const arg = sp === -1 ? "" : line.slice(sp + 1).trim();
  try {
    switch (cmd) {
      case "nav": await nav(arg); console.log(`nav ${arg}`); break;
      case "wait-for": await waitFor(arg); console.log(`wait-for ok: ${arg}`); break;
      case "click": await click(arg); console.log(`click ${arg}`); break;
      case "fill": { const i = arg.indexOf(" "); await fill(arg.slice(0, i), arg.slice(i + 1)); console.log(`fill ${arg.slice(0, i)}`); break; }
      case "type": await send("Input.insertText", { text: arg }); console.log(`type ${arg}`); break;
      case "eval": console.log("eval ->", JSON.stringify(await evalJs(arg))); break;
      case "text": console.log("text ->", await evalJs(`(${finder(arg)})?.textContent?.trim() ?? null`)); break;
      case "screenshot": await screenshot(arg); break;
      case "console-errors": console.log(errors.length ? "CONSOLE ERRORS:\n" + errors.join("\n") : "no console errors"); break;
      case "sleep": await new Promise((r) => setTimeout(r, Number(arg))); break;
      default: console.error(`unknown command: ${cmd}`);
    }
  } catch (e) {
    console.error(`ERROR on "${line}": ${e.message}`);
    process.exitCode = 1;
  }
}

ws.close();
cleanup();
process.exit(process.exitCode || 0);
