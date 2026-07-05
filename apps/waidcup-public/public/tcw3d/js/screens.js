import * as THREE from 'three';
import { addBox, PLATEAU } from './collision.js';

// Row position on the tennis-club terrace (the white rectangles in the
// TCWLayout2 sketch), east -> west; facing south toward the walkway/courts
// (a player entering along the z≈-23.5 arch lane sees the fronts to their right).
const SCREEN_X = [-15, -19.5, -24, -28.5];
const SCREEN_Z = -25.8;
const PANEL_W = 2.2;
const PANEL_H = PANEL_W * 1.1;              // ~2.42, hochkant – reicht fast bis zum Boden (mehr Platz für Inhalt)
const PANEL_Y = PANEL_H / 2 + 0.12;        // Unterkante ~0.12 über dem Terrassenboden

/**
 * Four free-standing display screens on the tennis-club terrace, each a
 * dark frame + 16:9 panel on a center-pole stand, facing south toward the
 * walkway/courts. Panels start with a dark placeholder material (color
 * 0x0d1420, no map) and are meant to be driven by a future companion
 * WebApp — see `window.__tcw.setScreen` in main.js, which swaps in a
 * texture, canvas or video element at runtime (resetting the material
 * colour to white so the map isn't tinted dark), or resets the panel to
 * its placeholder when called with `null`.
 *
 * Returns the 4 panel meshes, ordered east -> west (matches SCREEN_X).
 */
export function buildScreens(scene) {
  const baseY = PLATEAU.h;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1f22, roughness: 0.6, metalness: 0.3 });
  const standMat = new THREE.MeshStandardMaterial({ color: 0x33383d, roughness: 0.5, metalness: 0.5 });

  const panels = [];
  for (const x of SCREEN_X) {
    const g = new THREE.Group();
    g.position.set(x, baseY, SCREEN_Z);
    // Panel normal is +Z local by default -> world +Z (south), toward the
    // walkway/courts; no rotation needed.
    scene.add(g);

    // Dark frame, slightly oversized so it reads as a bezel behind the panel.
    const frame = new THREE.Mesh(new THREE.BoxGeometry(PANEL_W + 0.12, PANEL_H + 0.12, 0.06), frameMat);
    frame.position.set(0, PANEL_Y, 0);
    frame.castShadow = true; g.add(frame);

    // Placeholder panel — dark, true colour (no tone-mapping tint), swappable at runtime.
    const panelMat = new THREE.MeshBasicMaterial({ color: 0x0d1420, toneMapped: false });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_H), panelMat);
    panel.position.set(0, PANEL_Y, 0.035);
    g.add(panel);
    panels.push(panel);

    // Das bodennahe Panel steht auf einem flachen Sockel (keine hohe Stange mehr).
    const base = new THREE.Mesh(new THREE.BoxGeometry(PANEL_W + 0.3, 0.12, 0.5), standMat);
    base.position.set(0, 0.06, 0);
    base.castShadow = true; base.receiveShadow = true; g.add(base);

    addBox(x - 1.1, SCREEN_Z - 0.15, x + 1.1, SCREEN_Z + 0.15);
  }
  return panels;
}
