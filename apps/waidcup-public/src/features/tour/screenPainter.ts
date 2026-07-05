/**
 * Zeichnet ein ScreenModel als „Anzeigetafel" auf ein 1024×576-Canvas, das die
 * 3D-App als Textur auf einen In-World-Screen legt. Zwei Layouts: Fliesstext
 * (Standort/Infos) und Match-Tabelle (Order of Play/Live). Bewusst schlicht und
 * kontraststark für gute Lesbarkeit aus der Distanz in der 3D-Szene.
 */
import type { ScreenModel, TextLine } from "./screenModel.js";

export const SCREEN_W = 1024;
export const SCREEN_H = 576;
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

export function createScreenCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
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
  const columns = model.columns ?? [];
  ctx.font = `600 20px ${FONT}`;
  ctx.fillStyle = p.muted;
  for (const col of columns) ctx.fillText(col.header, col.x, startY);
  let y = startY + 40;
  ctx.font = `400 24px ${FONT}`;
  for (const row of model.rows ?? []) {
    ctx.fillStyle = p.fg;
    row.forEach((cell, i) => {
      const col = columns[i];
      if (!col) return;
      const next = columns[i + 1];
      const maxWidth = (next ? next.x : SCREEN_W - PAD) - col.x - 12;
      ctx.fillText(ellipsize(ctx, cell, maxWidth), col.x, y);
    });
    y += 42;
  }
  if (model.note) {
    ctx.fillStyle = p.muted;
    ctx.font = `400 20px ${FONT}`;
    ctx.fillText(model.note, PAD, y);
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
