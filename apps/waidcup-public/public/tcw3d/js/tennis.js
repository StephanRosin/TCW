import * as THREE from 'three';
import { addBox } from './collision.js';
import { pbr, loadTex } from './textures.js';
import { wood, metalDark, buildBenchBackless, buildUmbrella, buildScoreboard } from './props.js';

// --- Regulation court dimensions (metres) ---
const COURT_L = 23.77;   // baseline to baseline (along local Z)
const COURT_W = 10.97;   // doubles width (along local X)
const SINGLES_W = 8.23;
const SERVICE_FROM_NET = 6.40;

// --- Row layout: 6 courts side by side, sharing one enclosure ---
export const COURT_PITCH = 15.6;
export const ROW_COURTS = 6;
export const ENC = { minX: -48.8, maxX: 48.8, minZ: -18, maxZ: 18, h: 4 };

// Gate gap in the north fence (world x, half-width 1.1 m each).
// -31.2: main access, between courts 1 and 2 — lands at the raised terrace's
// staircase (see RAMPS in collision.js). There used to be a second gate at
// +40 (east access), but the grotto walkway's retaining edge boxed it in
// from outside (dead end), so it was removed — the north fence is now
// continuous there.
const GATE_W = 2.2;
const GATE_H = 2.2;
const GATE_X = [-31.2];

// Shared materials / textures (built once, reused across all 6 courts).
let _netMat, _ballMat, _brushMat;

function netMaterial() {
  if (_netMat) return _netMat;
  // Halbtransparentes dunkles Netz statt feiner Maschentextur: die feine
  // Maschen-Cutout-Textur wurde aus Distanz/flachem Winkel zu einem pixeligen
  // Dither-„Balken" minifiziert. depthWrite:false, damit Objekte dahinter
  // durchscheinen; renderOrder wird beim Mesh gesetzt.
  _netMat = new THREE.MeshBasicMaterial({ color: 0x161616, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  return _netMat;
}

function ballMaterial() {
  if (_ballMat) return _ballMat;
  _ballMat = new THREE.MeshStandardMaterial({ color: 0xd8e63c, roughness: 0.6 });
  return _ballMat;
}

function brushMaterial() {
  if (_brushMat) return _brushMat;
  _brushMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.9 });
  return _brushMat;
}

/**
 * Spielfeldlinien als flache Geometrie-Streifen (statt einer Linientextur): so
 * werden sie auch aus der Distanz/bei flachem Blickwinkel immer durchgehend
 * gerastert (mit MSAA), ohne das Mipmap-Verschwinden/Stricheln einer Textur.
 */
function buildCourtLines(group, cx) {
  const lw = 0.05;                        // Linienbreite (m)
  const dW = COURT_W / 2, sW = SINGLES_W / 2, hL = COURT_L / 2, svc = SERVICE_FROM_NET;
  const mat = new THREE.MeshBasicMaterial({ color: 0xf4f4f0 });
  const strip = (x, z, w, l) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
    s.rotation.x = -Math.PI / 2;         // flach auf den Platz legen
    s.position.set(cx + x, 0.036, z);
    group.add(s);
  };
  strip(0, -hL, COURT_W + lw, lw);        // Grundlinie Nord
  strip(0, hL, COURT_W + lw, lw);         // Grundlinie Süd
  strip(-dW, 0, lw, COURT_L);             // Doppel-Seitenlinie West
  strip(dW, 0, lw, COURT_L);              // Doppel-Seitenlinie Ost
  strip(-sW, 0, lw, COURT_L);             // Einzel-Seitenlinie West
  strip(sW, 0, lw, COURT_L);              // Einzel-Seitenlinie Ost
  strip(0, -svc, SINGLES_W, lw);          // Aufschlaglinie Nord
  strip(0, svc, SINGLES_W, lw);           // Aufschlaglinie Süd
  strip(0, 0, lw, 2 * svc);               // T-/Mittellinie
  strip(0, -hL + 0.15, lw, 0.3);          // Mittelmarke Grundlinie Nord
  strip(0, hL - 0.15, lw, 0.3);           // Mittelmarke Grundlinie Süd
}

/** Line markings + net for one court centred at world x = cx (net runs along X at z = 0). */
function addCourtMarkings(group, cx) {
  buildCourtLines(group, cx);
  addNet(group, cx);
}

function addNet(group, cx) {
  const halfLen = 6.4;   // net extends slightly past doubles sidelines
  const netH = 1.07;

  // Net fabric
  const net = new THREE.Mesh(new THREE.PlaneGeometry(halfLen * 2, netH), netMaterial());
  net.position.set(cx, netH / 2, 0);
  net.renderOrder = 1;
  group.add(net);

  // White tape top (Kopfband)
  const topTape = new THREE.Mesh(
    new THREE.BoxGeometry(halfLen * 2, 0.06, 0.03),
    new THREE.MeshBasicMaterial({ color: 0xf2f2ee })
  );
  topTape.position.set(cx, netH, 0);
  topTape.castShadow = true;
  group.add(topTape);

  // White tape reinforcement bottom
  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(halfLen * 2, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xf2f2ee, side: THREE.DoubleSide })
  );
  band.position.set(cx, 0.03, 0.001);
  group.add(band);

  // Posts
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.4 });
  for (const sx of [-halfLen, halfLen]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 10), postMat);
    post.position.set(cx + sx, 0.6, 0);
    post.castShadow = true;
    group.add(post);
  }
  // Centre strap
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, netH, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xf2f2ee }));
  strap.position.set(cx, netH / 2, 0);
  group.add(strap);

  // Kollision: dünne Box entlang des Netzes, damit man nicht hindurchlaufen kann
  // (um das Netz herum bleibt über die Platzlücken frei).
  addBox(cx - halfLen, -0.06, cx + halfLen, 0.06, netH);   // netH ≈ 1.07: Ball fliegt drüber
}

/** Visual door frame (uprights + lintel) marking a gate opening in the fence. */
function buildGateFrame(group, x, z, width, height) {
  const mat = metalDark;
  const postW = 0.08;
  for (const dx of [-width / 2, width / 2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(postW, height, postW), mat);
    post.position.set(x + dx, height / 2, z);
    post.castShadow = true;
    group.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + postW, postW, postW), mat);
  lintel.position.set(x, height, z);
  group.add(lintel);
}

/**
 * Shared perimeter fence around the whole enclosure (windscreen + chain-link).
 * North side is built as two segments so the gate opening is visually open.
 */
// Netz-Textur (Maschendraht-Optik) – lazy erzeugt und für alle Netze/Zäune geteilt.
let _netCanvas = null;
function netCanvas() {
  if (_netCanvas) return _netCanvas;
  const N = 128;
  const c = document.createElement('canvas');
  c.width = N; c.height = N;
  const g = c.getContext('2d');
  g.clearRect(0, 0, N, N);
  g.strokeStyle = 'rgba(18,26,18,0.8)'; g.lineWidth = 3;   // dünnere Drähte (relativ zur Masche)
  // Zwei Scharen 45°-Diagonalen bilden grössere Rautenmaschen; auf dem
  // quadratischen Canvas nahtlos kachelbar (RepeatWrapping).
  const s = 32;
  for (let k = -N; k < 2 * N; k += s) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k + N, N); g.stroke();   // Steigung +1
    g.beginPath(); g.moveTo(k + N, 0); g.lineTo(k, N); g.stroke();   // Steigung -1
  }
  _netCanvas = c;
  return c;
}

/** Netzwand als Plane mit gekachelter Rautenmaschen-Textur, unrotiert. */
function netMesh(len, height) {
  const tex = new THREE.CanvasTexture(netCanvas());
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(len, height);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, roughness: 1 });
  return new THREE.Mesh(new THREE.PlaneGeometry(len, height), mat);
}

function buildEnclosureFence(group) {
  const { minX, maxX, minZ, maxZ, h } = ENC;
  const fenceH = h * 1.2;   // Zäune 20% höher als die Grundhöhe h
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3f3a, roughness: 0.7, metalness: 0.3 });

  // Umzäunung als Rautennetz-Wand über die volle (erhöhte) Höhe fenceH.
  const buildSide = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len <= 0.01) return;
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    const angle = Math.atan2(z2 - z1, x2 - x1);

    const net = netMesh(len, fenceH);
    net.position.set(mx, fenceH / 2, mz);
    net.rotation.y = -angle;
    group.add(net);

    // Posts every ~4 m along the segment.
    const postStep = 4;
    const n = Math.max(1, Math.round(len / postStep));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, fenceH, 8), postMat);
      p.position.set(px, fenceH / 2, pz);
      p.castShadow = true;
      group.add(p);
    }
  };

  // South, west, east — durchgehende Seiten.
  buildSide(minX, maxZ, maxX, maxZ);   // south
  buildSide(minX, minZ, minX, maxZ);   // west
  buildSide(maxX, minZ, maxX, maxZ);   // east

  // North (Klubhaus-Seite) — zwei Segmente, an der Tor-Lücke offen.
  buildSide(minX, minZ, GATE_X[0] - GATE_W / 2, minZ);
  buildSide(GATE_X[0] + GATE_W / 2, minZ, maxX, minZ);

  for (const gx of GATE_X) buildGateFrame(group, gx, minZ, GATE_W, GATE_H);

  // Über der Tor-Öffnung (am Ende der Treppe) läuft der Zaun oben weiter – nur
  // die Durchgangshöhe (GATE_H) bleibt offen.
  const topH = fenceH - GATE_H;
  if (topH > 0.05) {
    for (const gx of GATE_X) {
      const top = netMesh(GATE_W, topH);
      top.position.set(gx, GATE_H + topH / 2, minZ);   // Nordseite entlang X -> keine Rotation
      group.add(top);
    }
  }
}

/** Perimeter collision boxes, with one 2.2 m gate gap in the north side. */
function addFenceColliders() {
  const { minX, maxX, minZ, maxZ } = ENC;

  addBox(minX - 0.1, maxZ - 0.1, maxX + 0.1, maxZ + 0.1);   // south
  addBox(minX - 0.1, minZ - 0.1, minX + 0.1, maxZ + 0.1);   // west
  addBox(maxX - 0.1, minZ - 0.1, maxX + 0.1, maxZ + 0.1);   // east

  // north, split into 2 segments around the gate gap
  addBox(minX - 0.1, minZ - 0.1, GATE_X[0] - GATE_W / 2, minZ + 0.1);
  addBox(GATE_X[0] + GATE_W / 2, minZ - 0.1, maxX + 0.1, minZ + 0.1);
}

/**
 * A tall floodlight pole.
 */
export function buildFloodlight(scene, x, z, height = 12) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a8f95, roughness: 0.5, metalness: 0.7 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, height, 12), poleMat);
  pole.position.y = height / 2;
  pole.castShadow = true;
  g.add(pole);

  // Cross-arm + 2 lamp heads
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), poleMat);
  arm.position.y = height - 0.2;
  g.add(arm);

  const lampMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.3, metalness: 0.6, emissive: 0x222222 });
  for (const dx of [-0.9, 0.9]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.28), lampMat);
    head.position.set(dx, height - 0.35, 0.2);
    head.rotation.x = 0.5;
    head.castShadow = true;
    g.add(head);
  }

  scene.add(g);
  addBox(x - 0.25, z - 0.25, x + 0.25, z + 0.25);
  return g;
}

/** Renders a sponsor banner ({text, bg, fg, sub}) onto a canvas texture. */
function bannerTexture({ text, bg = '#1c5c34', fg = '#ffffff', sub = '' }) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 6; g.strokeRect(8, 8, 1008, 240);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 110px Arial'; g.fillText(text, 512, sub ? 100 : 128);
  if (sub) { g.font = '52px Arial'; g.fillText(sub, 512, 196); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

const WAIDCUP_BANNER = { text: 'WAIDCUP', sub: '18.–26. Juli 2026', bg: '#3d8f3d' };

// Windscreen band is 2.2 m tall (see buildEnclosureFence) — banners sit centred in it.
const BANNER_Y = ENC.h * 0.8;   // ~2/3 der erhöhten Zaunhöhe (fenceH = h*1.2)
const SCREEN_OFFSET = 0.06;   // clearance off the windscreen, toward the court interior

function makeBannerMesh(banner, w = 6, h = 1.5) {
  const mat = new THREE.MeshBasicMaterial({ map: bannerTexture(banner), side: THREE.FrontSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

/** TCW club-logo plane (square). */
function makeTcwLogoMesh(size = 1.5) {
  const logoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide, toneMapped: false });
  logoMat.map = loadTex('assets/logos/tcw-logo.jpg', {
    srgb: true,
    onError: () => { logoMat.map = null; logoMat.color.set(0x26418f); logoMat.needsUpdate = true; },
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), logoMat);
}

/**
 * Waidcup tournament poster logo. The source PNG is a tall poster; cropping
 * it to a wide 6x1.5 band (tried: tex.repeat.set(1,0.25) + offset.set(0,0.55))
 * only shows an unreadable mid-poster slice of player silhouettes with no
 * text, so instead it is shown whole, undistorted, on a square plane —
 * matching the TCW logo plane treatment.
 */
function makeWaidcupLogoMesh(size = 1.5) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide, toneMapped: false });
  mat.map = loadTex('assets/logos/waidcup.png', {
    srgb: true,
    onError: () => { mat.map = null; mat.color.set(0x3d8f3d); mat.needsUpdate = true; },
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
}

/**
 * Club banners + logo planes on the inside of the windscreen: only real
 * content (WAIDCUP tournament text, TCW logo, Waidcup poster logo) — no
 * fake sponsor names. North side has no windscreen (chain-link only, see
 * buildEnclosureFence), so it carries no banners — only south, west, east.
 */
function buildBanners(group) {
  const { minX, maxX, maxZ } = ENC;
  const southZ = maxZ - SCREEN_OFFSET;

  // South — 6 banners alternating WAIDCUP text / Waidcup poster logo.
  const southX = [-36, -22, -8, 6, 20, 34];
  southX.forEach((x, i) => {
    const mesh = i % 2 === 0 ? makeBannerMesh(WAIDCUP_BANNER) : makeWaidcupLogoMesh();
    mesh.position.set(x, BANNER_Y, southZ);
    mesh.rotation.y = Math.PI;   // face -Z, into the court row
    group.add(mesh);
  });

  // West — WAIDCUP text banner, mid-side, facing +X into the enclosure.
  const west = makeBannerMesh(WAIDCUP_BANNER);
  west.position.set(minX + SCREEN_OFFSET, BANNER_Y, 0);
  west.rotation.y = Math.PI / 2;
  group.add(west);

  // East — WAIDCUP text banner, mid-side, facing -X into the enclosure.
  const east = makeBannerMesh(WAIDCUP_BANNER);
  east.position.set(maxX - SCREEN_OFFSET, BANNER_Y, 0);
  east.rotation.y = -Math.PI / 2;
  group.add(east);

  // Two TCW club-logo planes flanking the south banner row.
  for (const x of [-43, 43]) {
    const logo = makeTcwLogoMesh();
    logo.position.set(x, BANNER_Y, southZ);
    logo.rotation.y = Math.PI;
    group.add(logo);
  }
}

/** Deterministic pseudo-random in [0,1), seeded by n (same trick as the forest scatter). */
function detailRand(n) {
  const s = Math.sin(n * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Drag-net stand: net-textured mat lying flat on the clay + a low holder frame. */
function buildDragNetStand(group, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.7), netMaterial());
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = 0.05;
  g.add(mat);

  const frameH = 0.15;
  for (const dz of [-0.35, 0.35]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 0.04), metalDark);
    rail.position.set(0, frameH, dz);
    g.add(rail);
  }
  for (const dx of [-1.0, 1.0]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, frameH, 6), metalDark);
    post.position.set(dx, frameH / 2, 0);
    g.add(post);
  }

  group.add(g);
}

/** A line broom (cylindrical handle + brush box), leaned against the fence. */
function buildBroom(group, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.z = 0.25;   // leaning against the south fence

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), wood(0x8a5a33));
  handle.position.y = 0.75;
  handle.castShadow = true;
  g.add(handle);
  const brush = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.08), brushMaterial());
  brush.position.y = 0.06;
  g.add(brush);

  group.add(g);
}

/** 2-3 scattered tennis balls near the court, plausible clay-side positions. */
function buildBalls(group, cx, index) {
  const ballMat = ballMaterial();
  const count = 2 + (index % 2);
  for (let i = 0; i < count; i++) {
    const rx = (detailRand(index * 13 + i * 3 + 1) - 0.5) * 6;
    const rz = (detailRand(index * 13 + i * 3 + 2) - 0.5) * 8;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.033, 8, 8), ballMat);
    ball.position.set(cx + rx, 0.033, rz);
    ball.castShadow = true;
    group.add(ball);
  }
}

/** Per-court furniture: drag net, broom, scattered balls. */
function addCourtDetails(group, cx, index) {
  buildDragNetStand(group, cx - 3, 16.5);
  buildBroom(group, cx + 2, 17.6);
  buildBalls(group, cx, index);
}

/**
 * Build a single row of 6 courts sharing one enclosure (matches the real facility's
 * aerial layout): one continuous clay surface, per-court line markings + nets,
 * a shared perimeter fence with one north-side gate gap, and 5 floodlight masts.
 */
/**
 * Trennnetz zwischen zwei Plätzen: eine `height` m hohe Netzwand entlang Z mit
 * einer `gap` m breiten Lücke in der Mitte. Pfosten an den Enden und Lücken-
 * rändern; Kollider entlang der beiden Segmente.
 */
function buildCourtDivider(group, x, { height = 2, gap = 5, zEnd = 15 } = {}) {
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3f3a, metalness: 0.4, roughness: 0.6 });
  const halfGap = gap / 2;
  const segs = [[-zEnd, -halfGap], [halfGap, zEnd]];
  for (const [z0, z1] of segs) {
    const len = z1 - z0, cz = (z0 + z1) / 2;
    const net = netMesh(len, height);
    net.rotation.y = Math.PI / 2;   // Ebene entlang Z (Normale = X, Richtung Plätze)
    net.position.set(x, height / 2, cz);
    group.add(net);
    addBox(x - 0.08, z0, x + 0.08, z1, height);   // Trennnetz-Höhe (Default 2 m)
  }
  for (const z of [-zEnd, -halfGap, halfGap, zEnd]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, height + 0.1, 8), postMat);
    post.position.set(x, (height + 0.1) / 2, z); post.castShadow = true; group.add(post);
  }
}

export function buildCourtRow(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // One continuous sand surface across the whole enclosure (as seen in the aerial photos).
  const clay = new THREE.Mesh(
    new THREE.PlaneGeometry(ENC.maxX - ENC.minX, ENC.maxZ - ENC.minZ),
    pbr({ dir: 'assets/textures/clay', color: 0xb0532e, repeat: [24, 9] }));
  clay.rotation.x = -Math.PI / 2;
  clay.position.y = 0.02;
  clay.receiveShadow = true;
  group.add(clay);

  const courtX = [];
  for (let i = 0; i < ROW_COURTS; i++) {
    const cx = (i - (ROW_COURTS - 1) / 2) * COURT_PITCH;
    courtX.push(cx);
    addCourtMarkings(group, cx);
    addCourtDetails(group, cx, i);
  }

  // Bank (Z-Achse, rotY = 90°) in jeder Platzlücke; Schirm direkt an das eine
  // Bankende, Punkteanzeige (Abakus) an das andere.
  for (let i = 0; i < courtX.length - 1; i++) {
    const gapX = (courtX[i] + courtX[i + 1]) / 2;
    buildBenchBackless(group, gapX, 0, Math.PI / 2);
    buildUmbrella(group, gapX, 1.15, 0xc03030);
    // Anzeige zeigt nach -X in den westlich anliegenden Platz – so hat jeder
    // der Plätze 1-6 eine ihm zugewandte Tafel.
    buildScoreboard(group, gapX, -1.15, -Math.PI / 2);
  }

  // Extra pair east of court 6, in the corridor between the court and the
  // east fence (x 44.5..48.8: court 6's doubles line ends at 44.485, the
  // east fence collider sits at 48.7).
  buildBenchBackless(group, 46.6, 0, Math.PI / 2);
  buildUmbrella(group, 46.6, 1.15, 0xc03030);
  buildScoreboard(group, 46.6, -1.15, -Math.PI / 2); // zeigt nach -X auf Platz 6

  buildEnclosureFence(group);
  addFenceColliders();
  buildBanners(group);

  // North line: only 2 masts, offset from the centre gate at x = -31.2.
  for (const x of [-COURT_PITCH, COURT_PITCH]) {
    buildFloodlight(scene, x, ENC.minZ - 0.8, 14);
  }
  // South line: 3 masts.
  for (const x of [-COURT_PITCH * 2, 0, COURT_PITCH * 2]) {
    buildFloodlight(scene, x, ENC.maxZ + 0.8, 14);
  }

  // Trennnetz (2 m hoch, ~7 m Lücke in der Mitte) zwischen Platz 4 und 5.
  buildCourtDivider(group, (courtX[3] + courtX[4]) / 2, { gap: 7 });

  return { courtX };
}
