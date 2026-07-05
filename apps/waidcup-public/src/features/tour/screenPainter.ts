/**
 * Zeichnet ein ScreenModel als „Anzeigetafel" auf ein 1000×1100-Canvas
 * (Hochformat, passend zu den bodennahen Screens der 3D-Szene). Zwei Layouts:
 * Fliesstext (Standort/Infos) und Match-Tabelle in Sektionen „Jetzt"/„Danach"
 * (Order of Play/Live). Bewusst schlicht und kontraststark (Light-Mode) für
 * gute Lesbarkeit aus der Distanz.
 */
import type { ScreenModel, TextLine } from "./screenModel.js";

export const SCREEN_W = 1000;
export const SCREEN_H = 1100;
const PAD = 48;
const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

interface Palette {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  rule: string;
}

const DARK: Palette = { bg: "#0d1420", fg: "#f2f5fb", muted: "#9fb0c8", accent: "#7fc4ff", rule: "#26364d" };
const LIGHT: Palette = { bg: "#f7f9fc", fg: "#101722", muted: "#4a5666", accent: "#0a66c2", rule: "#d3dae4" };

// `doc` erlaubt, das Canvas im Dokument des iframes zu erzeugen: die setScreen-
// API der 3D-App prüft `instanceof HTMLCanvasElement` in ihrer eigenen Realm,
// weshalb ein im Eltern-Dokument erzeugtes Canvas dort abgelehnt würde.
export function createScreenCanvas(doc: Document = document): HTMLCanvasElement {
  const canvas = doc.createElement("canvas");
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  return canvas;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (text === "") return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

function paintHeader(ctx: CanvasRenderingContext2D, model: ScreenModel, p: Palette): number {
  ctx.fillStyle = p.accent;
  ctx.font = `700 44px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(model.title, PAD, PAD + 40);
  ctx.strokeStyle = p.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + 60);
  ctx.lineTo(SCREEN_W - PAD, PAD + 60);
  ctx.stroke();
  return PAD + 108; // y-Start des Inhalts
}

function paintText(ctx: CanvasRenderingContext2D, model: ScreenModel, p: Palette, startY: number): void {
  let y = startY;
  const maxWidth = SCREEN_W - 2 * PAD;
  for (const line of model.textLines ?? ([] as TextLine[])) {
    ctx.fillStyle = line.emphasis ? p.fg : p.muted;
    ctx.font = `${line.emphasis ? "600" : "400"} 26px ${FONT}`;
    for (const wrapped of wrap(ctx, line.text, maxWidth)) {
      ctx.fillText(wrapped, PAD, y);
      y += 36;
    }
  }
}

function paintTable(ctx: CanvasRenderingContext2D, model: ScreenModel, p: Palette, startY: number): void {
  let y = startY;
  for (const section of model.sections ?? []) {
    // Sektionsüberschrift („Jetzt" / „Danach") – bei leerer Überschrift entfällt sie
    // (z. B. der einspaltige Tagesspielplan Order of Play).
    if (section.heading) {
      ctx.fillStyle = p.accent;
      ctx.font = `700 30px ${FONT}`;
      ctx.fillText(section.heading, PAD, y);
      y += 44;
    }

    // Spaltenköpfe.
    ctx.font = `600 22px ${FONT}`;
    ctx.fillStyle = p.muted;
    for (const col of section.columns) ctx.fillText(col.header, col.x, y);
    y += 36;

    if (section.rows.length === 0) {
      ctx.fillStyle = p.muted;
      ctx.font = `400 24px ${FONT}`;
      ctx.fillText(section.note ?? "", PAD, y);
      y += 40;
    } else {
      ctx.font = `400 26px ${FONT}`;
      const LINE_H = 30;
      for (const row of section.rows) {
        ctx.fillStyle = p.fg;
        // Zellen können mehrzeilig sein (Doppel: ein Paar pro Zeile).
        const cellLines = row.map((cell) => cell.split("\n"));
        const maxLines = Math.max(1, ...cellLines.map((lines) => lines.length));
        row.forEach((cell, i) => {
          const col = section.columns[i];
          if (!col) return;
          const next = section.columns[i + 1];
          const maxWidth = (next ? next.x : SCREEN_W - PAD) - col.x - 12;
          cellLines[i]!.forEach((line, li) => {
            ctx.fillText(ellipsize(ctx, line, maxWidth), col.x, y + li * LINE_H);
          });
        });
        y += maxLines * LINE_H + 10;
      }
      if (section.note) {
        ctx.fillStyle = p.muted;
        ctx.font = `400 22px ${FONT}`;
        ctx.fillText(section.note, PAD, y);
        y += 32;
      }
    }
    y += 34; // Abstand zwischen den Sektionen
  }
}

export function paintScreen(canvas: HTMLCanvasElement, model: ScreenModel): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const p = model.theme === "light" ? LIGHT : DARK;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const startY = paintHeader(ctx, model, p);
  if (model.layout === "text") paintText(ctx, model, p, startY);
  else paintTable(ctx, model, p, startY);
}
