/**
 * Bespielt die vier In-World-Screens der 3D-App vom Waidcup-Host aus. Wartet auf
 * das von der 3D-App exponierte window.__tcw (same-origin im iframe), malt pro
 * Screen ein Canvas und ruft __tcw.setScreen(index, canvas). Standort/Infos
 * werden einmalig gesetzt, Order of Play und Live alle 20 s neu gemalt.
 *
 * Die Canvases werden im Dokument des IFRAMES erzeugt (win.document): setScreen
 * prüft den Quelltyp per `instanceof HTMLCanvasElement` in seiner eigenen Realm –
 * ein im Eltern-Dokument erzeugtes Canvas würde als „unsupported source" abgelehnt.
 */
import { useEffect } from "react";
import { waidcupApi } from "../../api/client.js";
import {
  buildInfosModel,
  buildLiveModel,
  buildLocationModel,
  buildOrderOfPlayModel,
} from "./screenModel.js";
import { createScreenCanvas, paintScreen } from "./screenPainter.js";

export type ScreenKind = "location" | "infos" | "orderofplay" | "live";

export const SCREEN_INDEX: Record<ScreenKind, number> = {
  location: 0,
  infos: 1,
  orderofplay: 2,
  live: 3,
};

export interface TcwScreenApi {
  setScreen(index: number, source: HTMLCanvasElement | null): void;
}

const REFRESH_MS = 20_000;
const READY_POLL_MS = 250;
const READY_TIMEOUT_MS = 20_000;

type Translate = (key: string) => string;

function tcwOf(win: Window | null): TcwScreenApi | null {
  const api = (win as unknown as { __tcw?: TcwScreenApi } | null)?.__tcw;
  return api && typeof api.setScreen === "function" ? api : null;
}

/** Malt ein Model in ein (wiederverwendetes) Canvas und legt es auf den Screen. */
function push(tcw: TcwScreenApi, index: number, canvas: HTMLCanvasElement, model: Parameters<typeof paintScreen>[1]): void {
  paintScreen(canvas, model);
  tcw.setScreen(index, canvas);
}

export function useScreenDriver(getWindow: () => Window | null, t: Translate, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    let readyTimer: ReturnType<typeof setInterval> | null = null;

    // Persistente Canvases für die dynamischen Screens; erst in start() im
    // iframe-Dokument erzeugt (siehe Modulkommentar).
    let oopCanvas: HTMLCanvasElement | null = null;
    let liveCanvas: HTMLCanvasElement | null = null;

    async function refreshDynamic(tcw: TcwScreenApi): Promise<void> {
      if (!oopCanvas || !liveCanvas) return;
      try {
        const [oop, live] = await Promise.all([waidcupApi.orderOfPlay(), waidcupApi.live()]);
        if (cancelled || !oopCanvas || !liveCanvas) return;
        push(tcw, SCREEN_INDEX.orderofplay, oopCanvas, buildOrderOfPlayModel(oop.today, t));
        push(tcw, SCREEN_INDEX.live, liveCanvas, buildLiveModel(live, t));
      } catch {
        // Netz-/API-Fehler: Screens behalten ihren letzten Stand, kein Absturz.
      }
    }

    async function start(tcw: TcwScreenApi, win: Window): Promise<void> {
      const doc = win.document;
      oopCanvas = createScreenCanvas(doc);
      liveCanvas = createScreenCanvas(doc);
      await (doc.fonts?.ready ?? Promise.resolve());
      if (cancelled) return;
      push(tcw, SCREEN_INDEX.location, createScreenCanvas(doc), buildLocationModel(t));
      push(tcw, SCREEN_INDEX.infos, createScreenCanvas(doc), buildInfosModel(t));
      await refreshDynamic(tcw);
      if (cancelled) return;
      refreshTimer = setInterval(() => {
        const current = tcwOf(getWindow());
        if (current) void refreshDynamic(current);
      }, REFRESH_MS);
    }

    const deadline = Date.now() + READY_TIMEOUT_MS;
    readyTimer = setInterval(() => {
      const win = getWindow();
      const tcw = tcwOf(win);
      if (tcw && win) {
        if (readyTimer) clearInterval(readyTimer);
        readyTimer = null;
        void start(tcw, win);
      } else if (Date.now() > deadline && readyTimer) {
        clearInterval(readyTimer);
        readyTimer = null; // 3D-App ohne Screen-API: Tour läuft, Screens bleiben dunkel.
      }
    }, READY_POLL_MS);

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
      if (readyTimer) clearInterval(readyTimer);
    };
  }, [getWindow, t, active]);
}
