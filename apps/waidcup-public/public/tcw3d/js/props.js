import * as THREE from 'three';
import { addBox, PLATEAU, RAMPS, LAWN, LAWN_STAIR, GROTTO_WALK, groundHeight } from './collision.js';
import { pbr, loadTex } from './textures.js';

export const wood = (c = 0x8a5a33) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 });
export const metalDark = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.5, metalness: 0.6 });

/** A simple café table (round top on a stem). Returns world position of the top. `r` is the tabletop radius. */
export function buildTable(scene, x, z, color = 0xf3f1ea, y = 0, r = 0.42) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const topMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 24), topMat);
  top.position.y = 0.72; top.castShadow = true; g.add(top);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 10), metalDark);
  stem.position.y = 0.36; g.add(stem);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.67, r * 0.71, 0.04, 14), metalDark);
  foot.position.y = 0.02; g.add(foot);
  scene.add(g);
  addBox(x - r, z - r, x + r, z + r);
  return new THREE.Vector3(x, y + 0.72, z);
}

/** A rectangular café table (wood top on 4 legs). `w` = X extent, `d` = Z extent. */
export function buildRectTable(scene, x, z, w = 0.8, d = 1.6, color = 0xf3f1ea, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const topMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), topMat);
  top.position.y = 0.72; top.castShadow = true; g.add(top);
  const legH = 0.72, inset = 0.08;
  for (const [lx, lz] of [
    [-w / 2 + inset, -d / 2 + inset], [w / 2 - inset, -d / 2 + inset],
    [-w / 2 + inset, d / 2 - inset], [w / 2 - inset, d / 2 - inset],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, legH, 8), metalDark);
    leg.position.set(lx, legH / 2, lz); leg.castShadow = true; g.add(leg);
  }
  scene.add(g);
  addBox(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
  return new THREE.Vector3(x, y + 0.72, z);
}

/** A simple chair. */
export function buildChair(scene, x, z, rotY = 0, color = 0x3a4a5a, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.44), mat);
  seat.position.y = 0.46; seat.castShadow = true; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.05), mat);
  back.position.set(0, 0.68, -0.2); g.add(back);
  const legMat = metalDark;
  for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 6), legMat);
    leg.position.set(lx, 0.23, lz); g.add(leg);
  }
  scene.add(g);
}

/** A parasol / umbrella. */
export function buildUmbrella(scene, x, z, color = 0x2f6fb0, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 10), wood(0x6b6b6b));
  pole.position.y = 1.15; g.add(pole);
  // Rounded canopy: a shallow polar cap of a sphere (dome), replacing the old cone shape.
  const canopyR = 1.6;
  const canopyBaseY = 1.8;
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(canopyR, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide })
  );
  canopy.position.y = canopyBaseY; canopy.castShadow = true; g.add(canopy);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), wood(0x555555));
  cap.position.y = canopyBaseY + canopyR + 0.05; g.add(cap);
  scene.add(g);
  addBox(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
}

/**
 * A large parasol (scaled-up variant of buildUmbrella) for the round table:
 * canopy radius ~2.2, rim height ~3.2 above the terrace floor so players
 * can walk under it. Only the pole gets a (small) collider.
 */
export function buildBigUmbrella(scene, x, z, color = 0xc03030, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const canopyR = 2.2;
  const thetaLength = Math.PI / 2.6;
  // Rim (bottom edge of the spherical-cap canopy) sits at canopyBaseY +
  // canopyR*cos(thetaLength); solved so the rim lands at ~3.2 m.
  const rimY = 3.2;
  const canopyBaseY = rimY - canopyR * Math.cos(thetaLength);
  const poleH = canopyBaseY + 0.5;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, poleH, 10), wood(0x6b6b6b));
  pole.position.y = poleH / 2; g.add(pole);
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(canopyR, 16, 8, 0, Math.PI * 2, 0, thetaLength),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide })
  );
  canopy.position.y = canopyBaseY; canopy.castShadow = true; g.add(canopy);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), wood(0x555555));
  cap.position.y = canopyBaseY + canopyR + 0.06; g.add(cap);
  scene.add(g);
  addBox(x - 0.15, z - 0.15, x + 0.15, z + 0.15);   // pole-only collider
}

/** A backless wooden bench (seat slats + legs only, no backrest). */
export function buildBenchBackless(scene, x, z, rotY = 0, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const m = wood(0x9a6a3f);
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.12), m);
    slat.position.set(0, 0.45, -0.18 + i * 0.16); slat.castShadow = true; g.add(slat);
  }
  for (const lx of [-0.8, 0.8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.4), wood(0x6f4a2a));
    leg.position.set(lx, 0.225, -0.1); g.add(leg);
  }
  scene.add(g);
  // Local footprint half-extents (X=0.9, Z=0.3) rotated by rotY into an axis-aligned box.
  const halfX = Math.abs(0.9 * Math.cos(rotY)) + Math.abs(0.3 * Math.sin(rotY));
  const halfZ = Math.abs(0.9 * Math.sin(rotY)) + Math.abs(0.3 * Math.cos(rotY));
  addBox(x - halfX, z - halfZ, x + halfX, z + halfZ);
}

/** Kopfzeilen-Textur „TCW | Gast" für den Zählapparat (weiss auf dunkel). */
function scoreboardLabelTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 82;
  const g = c.getContext('2d');
  g.fillStyle = '#161a20'; g.fillRect(0, 0, 512, 82);
  g.font = 'bold 46px Arial'; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillStyle = '#ffffff';
  g.fillText('TCW', 135, 44);
  g.fillText('Gast', 377, 44);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/**
 * Tennis-Zählapparat neben der Bank (Referenz: Abakus-Zähler): 1.8-m-Pfosten mit
 * einer Kopfzeile „TCW | Gast" und darunter zwei Kugelbalken – durch jeden läuft
 * ein Draht mit Schiebekugeln, der an beiden Enden herausragt. Kugeln zur Mitte
 * geschoben: links rot (TCW), rechts gelb (Gast). Unten 6 (Spiele), oben 2 (Sätze).
 */
export function buildScoreboard(scene, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);

  const metalMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.7, roughness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.6, metalness: 0.2 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2b100, roughness: 0.4 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd12f2f, roughness: 0.4 });
  const beadGeo = new THREE.SphereGeometry(0.045, 14, 10);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 10), metalMat);
  post.position.set(0, 0.9, 0); post.castShadow = true; g.add(post);

  const beamW = 1.5, beamH = 0.16, beamD = 0.14;

  // Kopfzeile „TCW | Gast" oben über den beiden Kugelbalken.
  const headerH = 0.24, headerY = 1.66;
  const header = new THREE.Mesh(new THREE.BoxGeometry(beamW, headerH, 0.05), darkMat);
  header.position.set(0, headerY, 0); header.castShadow = true; g.add(header);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(beamW, headerH),
    new THREE.MeshBasicMaterial({ map: scoreboardLabelTexture(), toneMapped: false }),
  );
  label.position.set(0, headerY, 0.027); g.add(label);

  const buildBeam = (y, perSideCount) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(beamW, beamH, beamD), darkMat);
    beam.position.set(0, y, 0); beam.castShadow = true; g.add(beam);

    const beadZ = beamD / 2 + 0.03, wireLen = beamW + 0.5;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, wireLen, 6), metalMat);
    wire.rotation.z = Math.PI / 2; wire.position.set(0, y, beadZ); g.add(wire);
    for (const ex of [-wireLen / 2, wireLen / 2]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), metalMat);
      cap.position.set(ex, y, beadZ); g.add(cap);
    }

    // Kugeln zur Mitte geschoben: links rot (TCW), rechts gelb (Gast).
    const spacing = 0.095, gapMid = 0.06;
    for (let b = 0; b < perSideCount; b++) {
      const left = new THREE.Mesh(beadGeo, red);
      left.position.set(-gapMid - b * spacing, y, beadZ); left.castShadow = true; g.add(left);
      const right = new THREE.Mesh(beadGeo, yellow);
      right.position.set(gapMid + b * spacing, y, beadZ); right.castShadow = true; g.add(right);
    }
  };

  buildBeam(1.42, 2);  // oberer Balken (Sätze): 2 Kugeln pro Seite
  buildBeam(1.18, 6);  // unterer Balken (Spiele): 6 Kugeln pro Seite
}

/**
 * The raised terrace plateau north of the courts (deepened): a solid
 * platform (+1.5 m) carrying the clubhouse, entrance portal and terrace
 * furniture. Its south edge has a concrete retaining wall with a low hedge
 * on top, except in the RAMPS X-range where sitting steps (grandstand)
 * lead down to ground level — the walkable ramp aligned with the west
 * north-fence gate; `groundHeight()` in collision.js provides the smooth Y
 * ramp players actually walk on. The plateau is bounded on the west, north
 * and east by thin colliders (forest side / clubhouse back / court-side
 * retaining wall); the south edge is either the ramp or the retaining wall.
 */
export function buildTerracePlateau(scene) {
  const p = PLATEAU;
  const deckH = p.h;                 // 1.5
  const cx = (p.minX + p.maxX) / 2;
  const cz = (p.minZ + p.maxZ) / 2;
  const width = p.maxX - p.minX;
  const depth = p.maxZ - p.minZ;

  // --- Top deck: paving over the whole plateau -----------------------------
  const pavingTop = pbr({ dir: 'assets/textures/paving', color: 0xb7b0a0, repeat: [18, 9], roughness: 0.95 });
  const concreteSide = pbr({ dir: 'assets/textures/concrete', color: 0x9a958c, repeat: [20, 1.5], roughness: 0.9 });

  const deckGeo = new THREE.BoxGeometry(width, deckH, depth);
  // Face order: +x, -x, +y (top), -y (bottom), +z, -z
  const deck = new THREE.Mesh(deckGeo, [concreteSide, concreteSide, pavingTop, concreteSide, concreteSide, concreteSide]);
  deck.position.set(cx, deckH / 2, cz);
  deck.castShadow = true; deck.receiveShadow = true;
  scene.add(deck);

  // --- South retaining wall + hedge, full height (1.5 m) only west of the
  // stairs — the strip in between (LAWN.minX..LAWN.maxX) is the half-height
  // lawn terrace built further below, which gets its own (shorter) edge
  // treatment instead of this wall. East of the lawn (x -12..10, behind the
  // entrance wall) gets a Mäuerchen-style parapet instead of a hedge — see
  // below. ------------------------------------------------------------
  const wallSegments = [
    { minX: p.minX, maxX: RAMPS[0].minX },        // -48..-33 (west of the stairs)
    // x=10..48 has no edge wall/hedge here — the plateau itself extends all
    // the way to the court fence there (the Grotto walkway, built below).
  ];

  const wallMat = pbr({ dir: 'assets/textures/concrete', color: 0x9a958c, repeat: [8, 1], roughness: 0.9 });
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x3d6b2e, roughness: 1 });
  const wallThickness = 0.3, hedgeH = 0.5, hedgeDepth = 0.5;
  // Every parapet-style wall built on top of a floor/retaining surface sinks
  // this far below that surface's nominal top (instead of sitting exactly
  // coplanar with it), so there's never a hairline gap or z-fighting seam
  // where the two meshes meet — the visible top height is unaffected since
  // only the hidden bottom shifts down.
  const parapetSink = 0.1;

  for (const seg of wallSegments) {
    const w = seg.maxX - seg.minX;
    const segCx = (seg.minX + seg.maxX) / 2;

    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, deckH, wallThickness), wallMat);
    wall.position.set(segCx, deckH / 2, p.maxZ);
    wall.castShadow = true; wall.receiveShadow = true;
    scene.add(wall);

    const hedge = new THREE.Mesh(new THREE.BoxGeometry(w, hedgeH, hedgeDepth), hedgeMat);
    hedge.position.set(segCx, deckH + hedgeH / 2, p.maxZ);
    hedge.castShadow = true; hedge.receiveShadow = true;
    scene.add(hedge);

    // Thin collider along the south edge/railing (fixed sliver: hugs p.maxZ).
    addBox(seg.minX, p.maxZ - 0.3, seg.maxX, p.maxZ + 0.15);
  }

  // --- Retaining wall face only (no hedge) east of the lawn, x -12..10
  // (behind the entrance wall): the plaza-edge parapet built just below
  // replaces the hedge that used to sit here, but the structural retaining
  // wall holding up the plateau itself stays exactly as before. -----------
  {
    const rMinX = LAWN.maxX, rMaxX = GROTTO_WALK.minX;   // -12..10
    const rw = rMaxX - rMinX, rCx = (rMinX + rMaxX) / 2;
    const retWall = new THREE.Mesh(new THREE.BoxGeometry(rw, deckH, wallThickness), wallMat);
    retWall.position.set(rCx, deckH / 2, p.maxZ);
    retWall.castShadow = true; retWall.receiveShadow = true;
    scene.add(retWall);
    addBox(rMinX, p.maxZ - 0.3, rMaxX, p.maxZ + 0.15);
  }

  // --- Plaza-edge parapet (x -11.65..10, behind the entrance wall): a
  // Mäuerchen-style wall (0.8 m above the plateau floor, same look/height as
  // the walkway end walls built below) replacing what used to be a thin
  // hedge here. Centered exactly on the plateau's ground-texture change line
  // (z = PLATEAU.maxZ = -21, i.e. p.maxZ) rather than offset south of it like
  // the old hedge, which left a visible sliver of paving showing south of
  // the planting. Butts flush against the entrance wall's south jamb at its
  // west end (x=-11.65, matching entrance.js's south-jamb collider) and
  // against the walkway's west end-wall at its east end (x=10, matching
  // GROTTO_WALK.minX) — one continuous barrier line, no corner gaps. The
  // retaining wall face at z=-21 (holding up the plateau itself) is
  // untouched; this only adds the parapet-level barrier on top of it.
  {
    const plazaWallMinX = -11.65, plazaWallMaxX = GROTTO_WALK.minX;   // -11.65..10
    const pw = plazaWallMaxX - plazaWallMinX, pCx = (plazaWallMinX + plazaWallMaxX) / 2;
    const pH = 0.8, pThick = 0.25, pZ = GROTTO_WALK.minZ;   // -21.05; top at world y = deckH + pH = 2.3
    const plazaMat = pbr({ dir: 'assets/textures/concrete', color: 0x9a958c, repeat: [pw / 5, 1], roughness: 0.9 });
    const plazaWall = new THREE.Mesh(new THREE.BoxGeometry(pw, pH + parapetSink, pThick), plazaMat);
    plazaWall.position.set(pCx, deckH + pH / 2 - parapetSink / 2, pZ);
    plazaWall.castShadow = true; plazaWall.receiveShadow = true;
    scene.add(plazaWall);
    addBox(plazaWallMinX, pZ - pThick / 2, plazaWallMaxX, pZ + pThick / 2);
  }

  // --- East retaining wall (plateau's east edge, facing the courts) ------
  // Extended south to GROTTO_WALK.maxZ (-18.3) so it keeps facing the courts
  // along the full depth of the Grotto walkway extension, not just the
  // original plateau depth.
  const eastWallH = 1.5;
  const eastMinZ = p.minZ, eastMaxZ = GROTTO_WALK.maxZ;
  const eastDepth = eastMaxZ - eastMinZ, eastCz = (eastMinZ + eastMaxZ) / 2;
  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, eastWallH, eastDepth), wallMat);
  eastWall.position.set(p.maxX, eastWallH / 2, eastCz);
  eastWall.castShadow = true; eastWall.receiveShadow = true;
  scene.add(eastWall);
  addBox(p.maxX - 0.3, eastMinZ, p.maxX + 0.35, eastMaxZ);

  // Hedge on top of the east wall only runs the original plateau depth —
  // south of z=-21 that's the open-view walkway along the fence, not a
  // planted edge.
  const eastHedge = new THREE.Mesh(new THREE.BoxGeometry(0.5, hedgeH, depth), hedgeMat);
  eastHedge.position.set(p.maxX, eastWallH + hedgeH / 2, cz);
  eastHedge.castShadow = true; eastHedge.receiveShadow = true;
  scene.add(eastHedge);

  // --- Grotto walkway extension (x 10..48): the plateau pushed out to the
  // court fence, flush with the terrace above (no ramp, same 1.5 m height —
  // see GROTTO_WALK in collision.js). Paving deck + a south retaining face
  // at the new edge (z=-18.3) + a west "step" wall at x=10 closing the gap
  // against the shorter plateau (behind the entrance wall) to its west. ---
  {
    const gw = GROTTO_WALK.maxX - GROTTO_WALK.minX;
    const gcx = (GROTTO_WALK.minX + GROTTO_WALK.maxX) / 2;
    const gd = GROTTO_WALK.maxZ - GROTTO_WALK.minZ;
    const gcz = (GROTTO_WALK.minZ + GROTTO_WALK.maxZ) / 2;
    const walkDeck = new THREE.Mesh(
      new THREE.BoxGeometry(gw, deckH, gd),
      [concreteSide, concreteSide, pavingTop, concreteSide, concreteSide, concreteSide]
    );
    walkDeck.position.set(gcx, deckH / 2, gcz);
    walkDeck.castShadow = true; walkDeck.receiveShadow = true;
    scene.add(walkDeck);

    // South retaining face (visible from the courts) + fall collider —
    // covers the full width of the walkway, so it never has an unguarded edge.
    addBox(GROTTO_WALK.minX, GROTTO_WALK.maxZ - 0.15, GROTTO_WALK.maxX, GROTTO_WALK.maxZ + 0.15);

    // West step wall: closes the cliff at x=10 where the walkway (1.5 m)
    // meets the shorter ground-level strip to its west (behind the
    // entrance wall, x -12..10 at z -21..-18.3). Fall collider straddles
    // x=10 for the walkway's z-span only (-21..-18.3) — it does NOT block
    // the plateau->walkway transition, which happens further north: the
    // plateau top (z<=-21) is contiguous across x=10 (both PLATEAU and
    // GROTTO_WALK read 1.5 there), so players walk onto the walkway by
    // crossing x=10 while still north of z=-21, then turning south.
    const stepWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, deckH, gd), wallMat);
    stepWall.position.set(GROTTO_WALK.minX, deckH / 2, gcz);
    stepWall.castShadow = true; stepWall.receiveShadow = true;
    scene.add(stepWall);
    addBox(9.7, GROTTO_WALK.minZ, 10.3, GROTTO_WALK.maxZ);

    // East end cap: the "East retaining wall" built above already blocks
    // movement past x=48 (its collider spans the full z depth, including
    // this walkway strip), but that wall's top is flush with the walkway
    // surface (both sit at y=1.5) — standing on the walkway there is no
    // parapet above floor level, so the view reads as an open edge straight
    // into the forest at ground level beyond. This low parapet (matching
    // the Grotto Mäuerchen: 0.8 m, same concrete) closes that visual gap;
    // its own collider is added too, redundant with the east wall's but
    // harmless (belt-and-braces for this specific strip).
    const capH = 0.8;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, capH + parapetSink, gd), wallMat);
    cap.position.set(GROTTO_WALK.maxX, deckH + capH / 2 - parapetSink / 2, gcz);
    cap.castShadow = true; cap.receiveShadow = true;
    scene.add(cap);
    addBox(GROTTO_WALK.maxX - 0.3, GROTTO_WALK.minZ, GROTTO_WALK.maxX + 0.35, GROTTO_WALK.maxZ);

    // West end cap: mirrors the east end cap above. The "stepWall" built
    // earlier in this block already closes the cliff at x=10 down to ground
    // level, but its top is flush with the walkway floor (both at deckH),
    // so — same as the east end before its cap was added — walking west
    // along the walkway reads as an open edge with no barrier above floor
    // level. This low parapet (matching the Grotto Mäuerchen: 0.8 m, same
    // concrete) closes that visual gap. It spans z -21..-18.3 only (the
    // walkway's own footprint, same as the existing fall collider at x=10
    // added above), so it does NOT block the plaza->walkway route, which
    // crosses x=10 further north (z<=-21, outside this span).
    const westCap = new THREE.Mesh(new THREE.BoxGeometry(0.3, capH + parapetSink, gd), wallMat);
    westCap.position.set(GROTTO_WALK.minX, deckH + capH / 2 - parapetSink / 2, gcz);
    westCap.castShadow = true; westCap.receiveShadow = true;
    scene.add(westCap);
    addBox(GROTTO_WALK.minX - 0.35, GROTTO_WALK.minZ, GROTTO_WALK.minX + 0.3, GROTTO_WALK.maxZ);
  }

  // West / north edge colliders (forest side / clubhouse-back side stay solid boundaries).
  addBox(p.minX - 0.3, p.minZ, p.minX + 0.3, p.maxZ);
  addBox(p.minX, p.minZ - 0.3, p.maxX, p.minZ + 0.3);

  // --- Main staircase (the single RAMPS zone) ------------------------------
  const woodMat = pbr({ dir: 'assets/textures/wood', color: 0x8a5a33, repeat: [6, 1], roughness: 0.85 });
  const stepHeights = [1.375, 1.125, 0.875, 0.625, 0.375, 0.125];
  const stepDepth = 0.4, stepH = 0.25;

  for (const ramp of RAMPS) {
    const w = ramp.maxX - ramp.minX;
    const rampCx = (ramp.minX + ramp.maxX) / 2;
    stepHeights.forEach((topY, i) => {
      const stepZ = p.maxZ + stepDepth / 2 + i * stepDepth;  // -20.8, -20.4, ..., -18.8
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, stepH, stepDepth), woodMat);
      step.position.set(rampCx, topY - stepH / 2, stepZ);
      step.castShadow = true; step.receiveShadow = true;
      scene.add(step);
    });
  }

  // Handrails both sides of the staircase, following the slope from the
  // terrace top (z=-21, y=1.5) down to ground (z=-18.6, y=0). Colliders hug
  // both rail lines so the player can't fall off the side of the stairs.
  buildStairRailing(scene, RAMPS[0].minX - 0.1, RAMPS[0].maxX + 0.1, p.maxZ, p.maxZ + p.stepDepth, p.h, 0);

  // --- Half-height lawn terrace (between the main stairs and the entrance
  // wall): a lower deck at LAWN.h (0.75) whose north face is simply the
  // exposed lower half of the main deck's own south face (the deck box
  // already runs the full 1.5 m down to ground) — the lawn platform covers
  // the bottom half of that face, leaving a 0.75 m "cliff" above the lawn
  // that the terrace-edge hedge below sits on top of. -----------------------
  {
    const grassTop = pbr({ dir: 'assets/textures/grass', color: 0x5a8a3c, repeat: [6, 1], roughness: 1 });
    const lw = LAWN.maxX - LAWN.minX, lcx = (LAWN.minX + LAWN.maxX) / 2;
    const ld = LAWN.maxZ - LAWN.minZ, lcz = (LAWN.minZ + LAWN.maxZ) / 2;
    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(lw, LAWN.h, ld),
      [concreteSide, concreteSide, grassTop, concreteSide, concreteSide, concreteSide]
    );
    lawn.position.set(lcx, LAWN.h / 2, lcz);
    lawn.castShadow = true; lawn.receiveShadow = true;
    scene.add(lawn);

    // South retaining edge (drop to ground level) — the lawn box's own
    // south face already reads as the wall; just add the fall collider.
    addBox(LAWN.minX, LAWN.maxZ - 0.15, LAWN.maxX, LAWN.maxZ + 0.15);

    // East cap where the lawn meets the entrance-wall line (x=-12): a small
    // concrete end-wall + hedge on top, closing the lawn off from the
    // full-height ground east of the entrance wall, plus a fall collider.
    const capWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, LAWN.h, ld), wallMat);
    capWall.position.set(LAWN.maxX, LAWN.h / 2, lcz);
    capWall.castShadow = true; capWall.receiveShadow = true;
    scene.add(capWall);
    const capHedge = new THREE.Mesh(new THREE.BoxGeometry(0.5, hedgeH, ld), hedgeMat);
    capHedge.position.set(LAWN.maxX, LAWN.h + hedgeH / 2, lcz);
    capHedge.castShadow = true; capHedge.receiveShadow = true;
    scene.add(capHedge);
    addBox(LAWN.maxX - 0.15, LAWN.minZ, LAWN.maxX + 0.2, LAWN.maxZ);

    // Terrace-edge hedge above the lawn (continuation of the terrace-edge
    // hedge line), continuous except the small hedge-gap passage (LAWN_STAIR).
    const hedgeSegs = [
      { minX: LAWN.minX, maxX: LAWN_STAIR.minX },
      { minX: LAWN_STAIR.maxX, maxX: LAWN.maxX },
    ];
    for (const seg of hedgeSegs) {
      const segW = seg.maxX - seg.minX;
      if (segW <= 0) continue;
      const segCx = (seg.minX + seg.maxX) / 2;
      const hedge = new THREE.Mesh(new THREE.BoxGeometry(segW, hedgeH, hedgeDepth), hedgeMat);
      hedge.position.set(segCx, deckH + hedgeH / 2, p.maxZ);
      hedge.castShadow = true; hedge.receiveShadow = true;
      scene.add(hedge);
      addBox(seg.minX, p.maxZ - 0.3, seg.maxX, p.maxZ + 0.15);
    }

    // Small stair through the hedge gap (no railing): 3 wood treads from the
    // terrace top down to the lawn, matching the LAWN_STAIR ramp in
    // groundHeight() exactly (same lerp formula) so the visual steps line
    // up with what the player actually walks on.
    const sw = LAWN_STAIR.maxX - LAWN_STAIR.minX, scx = (LAWN_STAIR.minX + LAWN_STAIR.maxX) / 2;
    for (let i = 0; i < 3; i++) {
      const z = p.maxZ + stepDepth / 2 + i * stepDepth;          // -20.8, -20.4, -20.0
      const topY = p.h + ((z - p.maxZ) / 1.2) * (LAWN.h - p.h);   // same lerp as groundHeight()
      const step = new THREE.Mesh(new THREE.BoxGeometry(sw, stepH, stepDepth), woodMat);
      step.position.set(scx, topY - stepH / 2, z);
      step.castShadow = true; step.receiveShadow = true;
      scene.add(step);
    }
  }
}

/**
 * Simple sloped handrails on both sides of the main staircase: posts + a
 * single top rail following the slope from the terrace top (`zTop`/`yTop`)
 * down to ground level (`zBottom`/`yBottom`), plus a thin fall collider
 * along each rail line so the player can't step off the side of the stairs.
 */
function buildStairRailing(scene, xLeft, xRight, zTop, zBottom, yTop, yBottom) {
  const dz = zBottom - zTop, dy = yBottom - yTop;
  const len = Math.sqrt(dz * dz + dy * dy);
  const dir = new THREE.Vector3(0, dy, dz).normalize();
  const postCount = 5;
  const railH = 0.9;

  for (const x of [xLeft, xRight]) {
    for (let i = 0; i <= postCount; i++) {
      const t = i / postCount;
      const z = zTop + t * dz;
      const y = yTop + t * dy;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, railH, 8), metalDark);
      post.position.set(x, y + railH / 2, z);
      post.castShadow = true;
      scene.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), metalDark);
    rail.position.set(x, (yTop + yBottom) / 2 + railH, (zTop + zBottom) / 2);
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    scene.add(rail);

    addBox(x - 0.08, Math.min(zTop, zBottom), x + 0.08, Math.max(zTop, zBottom));
  }
}

/**
 * A slatted wooden pergola (posts + beams + slats only, no greenery), built
 * as a group so it can be dropped onto the plateau (`y` = base offset, e.g.
 * PLATEAU.h).
 */
function buildPergola(scene, cx, cz, w, d, y = 0) {
  const g = new THREE.Group();
  g.position.set(cx, y, cz);
  scene.add(g);

  const postMat = wood(0x8a5a33);
  const beamMat = wood(0x9a6a40);
  const hw = w / 2, hd = d / 2, top = 2.6;

  // Corner + mid posts (world-space colliders; the meshes hang off the group).
  for (const px of [-hw, 0, hw]) {
    for (const pz of [-hd, hd]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, top, 10), postMat);
      post.position.set(px, top / 2, pz);
      post.castShadow = true; g.add(post);
      addBox(cx + px - 0.15, cz + pz - 0.15, cx + px + 0.15, cz + pz + 0.15);
    }
  }
  // Perimeter beams (long axis)
  for (const pz of [-hd, hd]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 0.14), beamMat);
    beam.position.set(0, top, pz); beam.castShadow = true; g.add(beam);
  }
  // Cross slats
  const n = Math.floor(w / 0.5);
  for (let i = 0; i <= n; i++) {
    const x = -hw + (i / n) * w;
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, d + 0.2), beamMat);
    slat.position.set(x, top + 0.08, 0); g.add(slat);
  }

  return g;
}

/**
 * A simple wooden railing (posts + 2 rails) with a thin collider behind it —
 * used as the barrier at the plateau's north edge, behind the clubhouse.
 */
function buildRailing(scene, minX, maxX, z, baseY) {
  const postMat = wood(0x6b4a2e);
  const railMat = wood(0x8a5a33);
  const span = maxX - minX;
  const n = Math.max(1, Math.round(span / 3));
  const railH = 1.0;

  for (let i = 0; i <= n; i++) {
    const x = minX + (i / n) * span;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, railH, 8), postMat);
    post.position.set(x, baseY + railH / 2, z);
    post.castShadow = true; scene.add(post);
  }
  for (const ry of [0.5, 1.0]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(span, 0.08, 0.08), railMat);
    rail.position.set((minX + maxX) / 2, baseY + ry, z);
    scene.add(rail);
  }
  addBox(minX, z - 0.3, maxX, z + 0.3);
}

/**
 * Shared shell for the two long terrace-side buildings (clubhouse and
 * restaurant): a 42x7 m dark wood-slat block with a flat overhanging roof
 * and a white window band + glass insets on the south (court-facing)
 * facade. `opts.signage(scene, cx, baseY, southZ)` adds whatever goes on
 * the facade beyond the window band (a logo rondell, a sign board, ...).
 * Returns the footprint so the caller can add its own furniture/terrace.
 */
function buildLongBuilding(scene, cx, cz, { signage, floors = 1 } = {}) {
  const p = PLATEAU;
  const baseY = p.h;   // 1.5 — plateau top
  const bw = 42, bd = 7, floorH = 3.6, bh = floorH * floors;
  const southZ = cz + bd / 2;   // facing the courts, +Z
  const northZ = cz - bd / 2;   // back of the building

  // Note: the wood diff.jpg texture already carries a dark-brown photographic
  // colour, so the tint here must stay light (it multiplies the texture,
  // not replace it) — 0x4a3826 previously double-darkened the facade to
  // near-black under normal daylight; 0xb0925f keeps a "dark wood-slat" look
  // while still reading clearly.
  const facadeMat = pbr({ dir: 'assets/textures/wood', color: 0xb0925f, repeat: [8, 1.5], roughness: 0.85 });
  const building = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), facadeMat);
  building.position.set(cx, baseY + bh / 2, cz);
  building.castShadow = true; building.receiveShadow = true;
  scene.add(building);
  addBox(cx - bw / 2, northZ, cx + bw / 2, southZ);

  // Flat overhanging roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 1, 0.25, bd + 1),
    new THREE.MeshStandardMaterial({ color: 0x3c3630, roughness: 0.8 }));
  roof.position.set(cx, baseY + bh + 0.1, cz);
  roof.castShadow = true; scene.add(roof);

  // Satteldach oben drauf (First entlang der Längsseite). Als Dreiecks-Prisma
  // per ExtrudeGeometry gebaut, mit leichtem Dach- und Giebelüberstand.
  const roofPeak = 2.4;
  const halfD = bd / 2 + 0.6;
  const gableLen = bw + 1.2;
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-halfD, 0);
  gableShape.lineTo(halfD, 0);
  gableShape.lineTo(0, roofPeak);
  gableShape.lineTo(-halfD, 0);
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: gableLen, bevelEnabled: false });
  gableGeo.translate(0, 0, -gableLen / 2);
  gableGeo.rotateY(Math.PI / 2);
  const gable = new THREE.Mesh(gableGeo, new THREE.MeshStandardMaterial({ color: 0x6b4a38, roughness: 0.85 }));
  gable.position.set(cx, baseY + bh + 0.2, cz);
  gable.castShadow = true; gable.receiveShadow = true;
  scene.add(gable);

  // Darker glass insets over the band. depthWrite: false + a later
  // renderOrder keeps this transparent pane from competing unpredictably
  // with other transparent objects (e.g. the court lines/net used to lose
  // that sort and disappear when viewed through the glass).
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.6, emissive: 0x2a281f, emissiveIntensity: 0.12 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x6fa0c8, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.65, depthWrite: false });
  const insetCount = 7, insetW = 3.6, bandW = 38;
  // Fensterband + Glaseinsätze nur im Erdgeschoss – die obere Etage (falls
  // vorhanden) bleibt bewusst fensterlos.
  {
    const bandY = baseY + 2.1;
    const band = new THREE.Mesh(new THREE.PlaneGeometry(38, 1.0), bandMat);
    band.position.set(cx, bandY, southZ + 0.02);
    scene.add(band);
    for (let i = 0; i < insetCount; i++) {
      const t = (i + 0.5) / insetCount - 0.5;
      const inset = new THREE.Mesh(new THREE.PlaneGeometry(insetW, 0.8), glassMat);
      inset.position.set(cx + t * bandW, bandY, southZ + 0.03);
      inset.renderOrder = 1;
      scene.add(inset);
    }
  }

  signage?.(scene, cx, baseY, southZ);

  return { bw, bd, bh, baseY, southZ, northZ };
}

/** Draws `text` onto a canvas texture — same recipe as the fence sponsor banners. */
function signTexture(text, { bg = '#26313a', fg = '#ffffff', fontSize = 110 } = {}) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 6; g.strokeRect(8, 8, 1008, 240);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${fontSize}px Arial`; g.fillText(text, 512, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/**
 * The clubhouse: the shared long-building shell set back at the north edge
 * of the deepened terrace plateau, with a TCW logo rondell on the south
 * facade, a bare wooden pergola over the four rect terrace tables, a
 * walk-in bar niche behind a high wooden wall, a terrace-edge hedge, and a
 * wooden barrier along the plateau's back (north) edge.
 */
export function buildClubhouse(scene) {
  const p = PLATEAU;
  const bx = -23.4, bz = -39.5;

  const { baseY } = buildLongBuilding(scene, bx, bz, {
    floors: 2,
    signage: (scene, cx, baseY, southZ) => {
      // TCW logo rondell on the south facade (faces +Z toward the courts, no
      // rotation needed) — true colours, no tinting/transparency.
      const logoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      logoMat.map = loadTex('assets/logos/tcw-logo.jpg', {
        srgb: true,
        onError: () => { logoMat.map = null; logoMat.color.set(0x26418f); logoMat.needsUpdate = true; },
      });
      const logo = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), logoMat);
      logo.position.set(cx, baseY + 1.9, southZ + 0.06);
      scene.add(logo);
    },
  });

  // --- Pergola over the 4 rect tables (see below) -----------------------
  buildPergola(scene, -21, -30, 15, 4.5, baseY);

  // --- Terrace furniture, laid out per the TCWLayout2 sketch --------------
  const chairColor = 0x3a4a5a;

  // Bar, NE corner against the clubhouse front: a walk-in niche. The bar
  // wall stands full clubhouse height (dark wood-slat facade, matching the
  // building) and hides the counter + fridges from the terrace; staff walk
  // in from a clear aisle behind the equipment (between it and the
  // clubhouse front at z=-36) rather than serving over the wall.
  {
    const wallMinX = -19, wallMaxX = -12.4;
    const wallW = wallMaxX - wallMinX, wallCx = (wallMinX + wallMaxX) / 2;
    const wallZ = -33.8, wallH = 3.6, wallThickness = 0.12;
    const barWallMat = pbr({ dir: 'assets/textures/wood', color: 0xb0925f, repeat: [2, 1.5], roughness: 0.85 });
    const barWall = new THREE.Mesh(new THREE.BoxGeometry(wallW, wallH, wallThickness), barWallMat);
    barWall.position.set(wallCx, baseY + wallH / 2, wallZ);
    barWall.castShadow = true; barWall.receiveShadow = true;
    scene.add(barWall);
    addBox(wallMinX, wallZ - 0.1, wallMaxX, wallZ + 0.1);

    // Equipment (counter + fridges) hugs the wall's north face; a ~1.4 m
    // aisle stays clear between the equipment and the clubhouse front.
    const equipZ = wallZ - wallThickness / 2 - 0.35;   // -34.21, depth-0.7 centred against the wall face

    const counterMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.35, metalness: 0.85 });
    const counterW = 5, counterD = 0.65, counterH = 0.9;
    // Shifted 1.4 m west of the wall's own centre (was -15) so the spare
    // room the fridges need is now on the EAST end of the counter instead
    // of the west end — this is what makes the tap/fridge swap below fit
    // inside the wall footprint (wallMinX -19..wallMaxX -12.4) without the
    // fridges poking out past the wall into the arch passage.
    const counterCx = -16.4;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(counterW, counterH, counterD), counterMat);
    counter.position.set(counterCx, baseY + counterH / 2, equipZ);
    counter.castShadow = true; counter.receiveShadow = true;
    scene.add(counter);
    addBox(counterCx - counterW / 2, equipZ - counterD / 2, counterCx + counterW / 2, equipZ + counterD / 2);

    // Beer tap — chrome column + angled spout + drip tray, west third of the
    // counter, spout overhanging the aisle (north) side.
    const tapX = counterCx - counterW / 2 + counterW / 6;
    const tapMat = new THREE.MeshStandardMaterial({ color: 0xd7dbe0, roughness: 0.15, metalness: 0.95 });
    const tapZ = equipZ - counterD / 2 + 0.08;
    const tapBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 12), tapMat);
    tapBase.position.set(tapX, baseY + counterH + 0.02, tapZ);
    scene.add(tapBase);
    const tapCol = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 10), tapMat);
    tapCol.position.set(tapX, baseY + counterH + 0.165, tapZ);
    scene.add(tapCol);
    const tapHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8), tapMat);
    tapHandle.position.set(tapX, baseY + counterH + 0.31, tapZ - 0.05);
    tapHandle.rotation.x = -Math.PI / 3;
    scene.add(tapHandle);
    const drip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.1), metalDark);
    drip.position.set(tapX, baseY + counterH + 0.01, tapZ - 0.06);
    scene.add(drip);

    // 2 fridges beside the counter (east end), hugging the same wall face;
    // fronts face the aisle (north) so staff can load them from behind.
    const fridgeMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.4, metalness: 0.2 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xd0d0cc, roughness: 0.3, metalness: 0.3 });
    const fridgeW = 0.7, fridgeD = 0.7, fridgeH = 1.8;
    for (const fx of [counterCx + counterW / 2 + fridgeW / 2, counterCx + counterW / 2 + fridgeW * 1.5]) {
      const fridge = new THREE.Mesh(new THREE.BoxGeometry(fridgeW, fridgeH, fridgeD), fridgeMat);
      fridge.position.set(fx, baseY + fridgeH / 2, equipZ);
      fridge.castShadow = true; fridge.receiveShadow = true;
      scene.add(fridge);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(fridgeW - 0.08, fridgeH - 0.1), doorMat);
      door.position.set(fx, baseY + fridgeH / 2, equipZ - fridgeD / 2 - 0.01);
      door.rotation.y = Math.PI;
      scene.add(door);
      addBox(fx - fridgeW / 2, equipZ - fridgeD / 2, fx + fridgeW / 2, equipZ + fridgeD / 2);
    }
  }

  // 4 rectangular tables (1.6 x 0.8, long axis along Z) in a row, 2 chairs
  // on each long side (east + west), all facing the table.
  for (const tx of [-15, -19, -23, -27]) {
    buildRectTable(scene, tx, -30, 0.8, 1.6, 0xf3f1ea, baseY);
    for (const tz of [-30.45, -29.55]) {
      buildChair(scene, tx - 0.7, tz, Math.PI / 2, chairColor, baseY);   // west side, faces east
      buildChair(scene, tx + 0.7, tz, -Math.PI / 2, chairColor, baseY);  // east side, faces west
    }
  }

  // 1 round table (r ~0.8) with 6 chairs arranged radially around it, under
  // a large parasol (pole offset 1.1 m west of the table centre so it reads
  // naturally and clears both the table and the chairs).
  {
    const rx = -38, rz = -31, tableR = 0.8, chairDist = tableR + 0.55;
    buildTable(scene, rx, rz, 0xf3f1ea, baseY, tableR);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const cxp = rx + Math.sin(a) * chairDist;
      const czp = rz + Math.cos(a) * chairDist;
      buildChair(scene, cxp, czp, a + Math.PI, chairColor, baseY);   // faces back toward the table centre
    }
    buildBigUmbrella(scene, rx - 1.1, rz, 0xc03030, baseY);
  }

  // (The old planter hedges flanking the stair mouth were removed: they
  // pre-dated the narrow gated staircase + lawn hedge-gap and one of them
  // sat directly across the new small-stair passage, blocking it. The
  // terrace-edge hedge built in buildTerracePlateau now flanks both stairs.)

  // --- Barrier behind the clubhouse (plateau north edge; spans the whole
  // terrace width, so it is only built once here, not again for the
  // restaurant building to its east). -----------------------------------
  buildRailing(scene, p.minX, p.maxX, -44, baseY);
}

/**
 * The restaurant: a second long building spanning courts 4-6 (mirrored
 * east of the clubhouse), the shared long-building shell with a
 * "TESSIN GROTTO" sign board instead of the TCW rondell, and a restaurant
 * terrace of tables/chairs/umbrellas in front of it. A low concrete wall
 * (with a plaza-side gap) separates the terrace from the walkway that
 * passes it on the courts side, so furniture stays north of z=-26.5.
 */
export function buildRestaurant(scene) {
  const bx = 23.4, bz = -39.5;

  const { baseY } = buildLongBuilding(scene, bx, bz, {
    signage: (scene, cx, baseY, southZ) => {
      const signMat = new THREE.MeshBasicMaterial({ map: signTexture('TESSIN GROTTO', { fontSize: 78 }), side: THREE.FrontSide });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.8), signMat);
      sign.position.set(cx, baseY + 2.8, southZ + 0.06);
      scene.add(sign);
    },
  });

  // Low wall (Mäuerchen) separating the Grotto terrace from the walkway
  // that now runs along the court fence (the Grotto walkway extension in
  // buildTerracePlateau, x 10..48, z -21.05..-18.3): a "natural boundary",
  // not a real barrier, so it stays low (0.8 m). It runs the full x 10..48
  // span except a single 1.6 m gap (x 11.6..13.2) as the terrace's
  // pedestrian entrance from the walkway/plaza side. Centered on z=-21.05 —
  // the SAME centerline as the plaza-edge parapet built in
  // buildTerracePlateau (GROTTO_WALK.minZ) — so the whole run from the
  // entrance wall to the Mäuerchen's east end (x=44) reads as one
  // continuous straight parapet, only interrupted by this entrance gap; at
  // x=10 the walkway's west end-cap wall runs south from this same line to
  // close the walkway (see buildTerracePlateau).
  {
    const mSegments = [ { minX: 10, maxX: 11.6 }, { minX: 13.2, maxX: 44 } ];
    const mH = 0.8, mThick = 0.25, mZ = GROTTO_WALK.minZ;   // -21.05
    const mSink = 0.1;   // embed the base so it never reads as floating (see parapetSink above)
    const mMat = pbr({ dir: 'assets/textures/concrete', color: 0x9a958c, repeat: [6, 1], roughness: 0.9 });
    for (const seg of mSegments) {
      const mW = seg.maxX - seg.minX, mCx = (seg.minX + seg.maxX) / 2;
      const mauerchen = new THREE.Mesh(new THREE.BoxGeometry(mW, mH + mSink, mThick), mMat);
      mauerchen.position.set(mCx, baseY + mH / 2 - mSink / 2, mZ);
      mauerchen.castShadow = true; mauerchen.receiveShadow = true;
      scene.add(mauerchen);
      addBox(seg.minX, mZ - mThick / 2, seg.maxX, mZ + mThick / 2);
    }
  }

  // Restaurant terrace (x 10..40): enlarged with the walkway move — an
  // extra south row now fits between the original tables and the
  // Mäuerchen (z -35..-22.5 is the gained space), all still north of the
  // Mäuerchen (z=-21.5) so nothing pokes into the walkway.
  const chairColor = 0x3a4a5a;
  const northRowZ = -33, midRowZ = -27.3, southRowZ = -23.5;
  const cols = [14, 20, 27, 34];

  for (const x of cols) {
    for (const z of [northRowZ, midRowZ]) {
      buildTable(scene, x, z, 0xf3f1ea, baseY);
      buildChair(scene, x, z - 0.7, 0, chairColor, baseY);
      buildChair(scene, x, z + 0.7, Math.PI, chairColor, baseY);
      buildChair(scene, x - 0.7, z, Math.PI / 2, chairColor, baseY);
    }
  }
  for (const x of [16, 24, 32]) {
    buildTable(scene, x, southRowZ, 0xf3f1ea, baseY);
    buildChair(scene, x, southRowZ - 0.7, 0, chairColor, baseY);
    buildChair(scene, x, southRowZ + 0.7, Math.PI, chairColor, baseY);
    buildChair(scene, x - 0.7, southRowZ, Math.PI / 2, chairColor, baseY);
    buildChair(scene, x + 0.7, southRowZ, -Math.PI / 2, chairColor, baseY);
  }

  buildUmbrella(scene, 14, midRowZ, 0xc03030, baseY);
  buildUmbrella(scene, 20, northRowZ, 0xc03030, baseY);
  buildUmbrella(scene, 27, midRowZ, 0xc03030, baseY);
  buildUmbrella(scene, 34, northRowZ, 0xc03030, baseY);
  buildUmbrella(scene, 16, southRowZ, 0xc03030, baseY);
  buildUmbrella(scene, 32, southRowZ, 0xc03030, baseY);
}

/**
 * A ring of trees around the facility using three instanced meshes (dark
 * conifers, rounded broadleaf, tall spruce) plus a handful of individual
 * trees placed close behind the south/west fence for a "forest right at
 * the courts" feel matching the reference photos. Ring trees are placed in
 * an annulus so the interior stays clear; every tree's foot sits at
 * `groundHeight(x, z)` so none float or sink (matters near the plateau
 * edge, cheap insurance everywhere else since the ground is flat there).
 */
export function buildForest(scene, count = 650, innerR = 75, outerR = 220) {
  // Mischwald: ausschliesslich runde Laubbaum-Kronen (keine Nadelbäume/Tannen),
  // in drei Grössen für Form- und Höhenvariation – insgesamt deutlich höher.
  // (Die drei Slot-Namen bleiben aus Kompatibilität, meinen aber alle Laubbäume.)
  const coniferGeo = new THREE.IcosahedronGeometry(4.0, 0);
  coniferGeo.translate(0, 9.5, 0);
  const coniferMat = new THREE.MeshStandardMaterial({ color: 0x3f7532, roughness: 1, flatShading: true });

  const broadGeo = new THREE.IcosahedronGeometry(3.3, 0);
  broadGeo.translate(0, 8, 0);
  const broadMat = new THREE.MeshStandardMaterial({ color: 0x4c8a3a, roughness: 1, flatShading: true });

  // Grosse, hohe Krone für markante Höhe an der Baumgrenze.
  const spruceGeo = new THREE.IcosahedronGeometry(5.2, 0);
  spruceGeo.translate(0, 12.5, 0);
  const spruceMat = new THREE.MeshStandardMaterial({ color: 0x356a2c, roughness: 1, flatShading: true });

  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.44, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4127, roughness: 1 });

  // 8-10 individual trees close behind the south/west fence (outside the
  // court enclosure and off the plateau), on top of the ring capacity.
  const extraTrees = [
    { x: -20, z: -62 }, { x: -8, z: -64 }, { x: 5, z: -63 }, { x: 18, z: -61 }, { x: -30, z: -63 },
    { x: -62, z: -20 }, { x: -64, z: -8 }, { x: -63, z: 5 }, { x: -61, z: 18 }, { x: -61, z: -28 },
  ];
  const capacity = count + extraTrees.length;

  // Allocate full capacity for all three canopy types; unused slots are
  // parked far below ground.
  const conifer = new THREE.InstancedMesh(coniferGeo, coniferMat, capacity);
  const broad = new THREE.InstancedMesh(broadGeo, broadMat, capacity);
  const spruce = new THREE.InstancedMesh(spruceGeo, spruceMat, capacity);
  const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, capacity);
  conifer.castShadow = broad.castShadow = spruce.castShadow = true;
  conifer.receiveShadow = broad.receiveShadow = spruce.receiveShadow = true;

  const dummy = new THREE.Object3D();
  // deterministic pseudo-random (no Math.random dependency issues), seeded by index
  const rand = (n) => {
    const s = Math.sin(n * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };

  const tmpColor = new THREE.Color();
  /** Sets `mesh`'s instance colour at `index` to `baseHex` scaled by a deterministic 0.85..1.15 factor. */
  const setVariedColor = (mesh, index, baseHex, seed) => {
    const factor = 0.85 + rand(seed) * 0.3;
    tmpColor.set(baseHex).multiplyScalar(factor);
    mesh.setColorAt(index, tmpColor);
  };

  let ci = 0, bi = 0, si = 0, ti = 0;
  const placeTree = (i, x, z) => {
    const s = 0.95 + rand(i + 3.1) * 0.9;
    const rot = rand(i + 5.5) * Math.PI * 2;

    dummy.position.set(x, groundHeight(x, z), z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunk.setMatrixAt(ti++, dummy.matrix);

    const typeRoll = rand(i + 9.9);
    if (typeRoll < 0.4) {
      conifer.setMatrixAt(ci, dummy.matrix);
      setVariedColor(conifer, ci, 0x3f7532, i + 11.2);
      ci++;
    } else if (typeRoll < 0.72) {
      broad.setMatrixAt(bi, dummy.matrix);
      setVariedColor(broad, bi, 0x4c8a3a, i + 11.2);
      bi++;
    } else {
      spruce.setMatrixAt(si, dummy.matrix);
      setVariedColor(spruce, si, 0x356a2c, i + 11.2);
      si++;
    }
  };

  for (let i = 0; i < count; i++) {
    const ang = rand(i + 1) * Math.PI * 2;
    const rad = innerR + rand(i + 7.3) * (outerR - innerR);
    placeTree(i, Math.cos(ang) * rad, Math.sin(ang) * rad);
  }
  extraTrees.forEach((t, k) => placeTree(count + k, t.x, t.z));

  // Park unused instance slots far below ground so they never render.
  const hide = new THREE.Object3D();
  hide.position.set(0, -1000, 0); hide.updateMatrix();
  for (; ci < capacity; ci++) conifer.setMatrixAt(ci, hide.matrix);
  for (; bi < capacity; bi++) broad.setMatrixAt(bi, hide.matrix);
  for (; si < capacity; si++) spruce.setMatrixAt(si, hide.matrix);

  conifer.instanceMatrix.needsUpdate = true;
  broad.instanceMatrix.needsUpdate = true;
  spruce.instanceMatrix.needsUpdate = true;
  trunk.instanceMatrix.needsUpdate = true;
  if (conifer.instanceColor) conifer.instanceColor.needsUpdate = true;
  if (broad.instanceColor) broad.instanceColor.needsUpdate = true;
  if (spruce.instanceColor) spruce.instanceColor.needsUpdate = true;
  scene.add(conifer, broad, spruce, trunk);
}
