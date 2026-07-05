import * as THREE from 'three';
import { addBox, PLATEAU } from './collision.js';
import { pbr, loadTex } from './textures.js';

/**
 * The entrance portal, built directly at the terrace: a wood-facade arch
 * wall (same wood recipe as the clubhouse, matching the TCW6 reference
 * photo) that players walk through from the
 * forecourt onto the deep terrace, with a round TCW logo plaque and a big
 * Waidcup poster on the east (forecourt) face.
 *
 * Everything lives in a group offset to the plateau top (y = PLATEAU.h =
 * 1.5); local Y therefore reads as "height above the terrace/forecourt
 * ground" throughout this file.
 */
export function buildEntrance(scene) {
  const group = new THREE.Group();
  group.position.set(0, PLATEAU.h, 0);
  scene.add(group);

  const wallX = -12;          // wall centreline
  // Wall now runs all the way to the walkway edge (z=-21.3) so it joins the
  // terrace's south retaining wall/hedge with no gap at the x=-12 corner.
  const wallMinZ = -36, wallMaxZ = -21.3;   // 14.7 m span
  const wallCz = (wallMinZ + wallMaxZ) / 2;   // -28.65 (wall midpoint, NOT the arch — see below)
  const wallLen = wallMaxZ - wallMinZ;         // 14.7
  const wallH = 3.6;
  const wallThickness = 0.6;

  // Arch opening sits near the SOUTH end of the wall (forecourt/tribune
  // corner), leaving a long run of wood facade to the north for the Waidcup poster.
  // NOTE on the local->world mapping: the wall mesh is rotated rotation.y =
  // +PI/2, so local shape-X maps to world Z as `wallCz - localX` (NOT
  // `wallCz + localX`) — verified against the actual rendered geometry.
  // archLocalX must therefore be `wallCz - archWorldZ`, the inverse of the
  // naive `archWorldZ - wallCz` (which mirrors the hole to the wrong end
  // of the wall).
  const archWorldZ = -24.0;
  const archLocalX = wallCz - archWorldZ;   // local shape-X offset of the hole (-4.65)

  // --- Wood-facade arch wall ----------------------------------------------
  const shape = new THREE.Shape();
  const hw = wallLen / 2;
  shape.moveTo(-hw, 0); shape.lineTo(hw, 0); shape.lineTo(hw, wallH); shape.lineTo(-hw, wallH); shape.closePath();

  const jambHalfW = 1.3, jambH = 1.9;
  const hole = new THREE.Path();
  hole.moveTo(archLocalX - jambHalfW, 0);
  hole.lineTo(archLocalX - jambHalfW, jambH);
  hole.absarc(archLocalX, jambH, jambHalfW, Math.PI, 0, true);   // semicircle apex at jambH + jambHalfW = 3.2
  hole.lineTo(archLocalX + jambHalfW, 0);
  hole.closePath();
  // NOTE: the hole must stay flush with the outer shape's own Y=0 bottom
  // edge (NOT sunk below it) — a hole path that exits the outer contour
  // fails to triangulate correctly and ExtrudeGeometry silently renders the
  // wall solid, with no arch opening at all. Fixed below instead by
  // lifting the whole wall mesh a couple cm off the deck.
  shape.holes.push(hole);

  const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: wallThickness, bevelEnabled: false });
  // Same wood-PBR recipe as the clubhouse/restaurant facade (Task 10's
  // facadeMat in props.js: color 0xb0925f, roughness 0.85), so the entrance
  // wall reads as part of the same building family. Repeat is scaled down
  // from the facade's [8, 1.5] over its 42 m length to this wall's 14.7 m
  // length, keeping the same texel density; the height repeat (1.5) is
  // unchanged since both walls share the same 3.6 m height.
  const wallMat = pbr({ dir: 'assets/textures/wood', color: 0xb0925f, repeat: [8 * (wallLen / 42), 1.5], roughness: 0.85 });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  // Shape-X (wall length) rotates onto world Z, shape-Z (thickness) onto world X.
  // Y is raised 2 cm off the deck: the arch hole's bottom edge sweeps into a
  // real horizontal "sill" quad (ExtrudeGeometry extrudes every contour
  // edge, hole included) that would otherwise sit exactly coplanar with the
  // terrace deck's paving top and z-fight with it in the open archway — the
  // only place it's ever exposed (elsewhere it's buried under solid wall).
  wall.position.set(wallX - wallThickness / 2, 0.02, wallCz);
  wall.rotation.y = Math.PI / 2;
  wall.castShadow = true; wall.receiveShadow = true;
  group.add(wall);

  // Colliders either side of the arch passage (world coords; the passage
  // itself is free between z -25.3..-22.7, matching the arch opening). The
  // south jamb collider ends exactly at the plateau's south edge (z=-21.3),
  // flush with the retaining-wall collider east of x=-12 (see
  // buildTerracePlateau) — no walkable gap at the corner.
  addBox(-12.35, -36, -11.65, -25.3);
  addBox(-12.35, -22.7, -11.65, -21.3);

  // --- Round TCW logo plaque, east (forecourt) face, on the SOUTH jamb ---
  // (the short 1.4 m wall stub z -22.7..-21.3), immediately left of the arch
  // as the player arrives (user-left = south in the plaza arrival view).
  const logoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  logoMat.map = loadTex('assets/logos/tcw-logo.jpg', {
    srgb: true,
    onError: () => { logoMat.map = null; logoMat.color.set(0x26418f); logoMat.needsUpdate = true; },
  });
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), logoMat);
  logo.position.set(-11.62, 1.9, -22.0);
  logo.rotation.y = Math.PI / 2;   // normal -> +X, faces the arriving player
  group.add(logo);

  // --- Big Waidcup poster, on the long north wall section (user-right on
  // arrival), kept well clear of the arch opening (opening starts at
  // z=-25.3; poster stays north of that with a >=1.2 m gap) so it never
  // crowds the entrance. Sized off the source PNG's aspect ratio so it
  // never looks stretched.
  const posterAspect = 797 / 866;   // assets/logos/waidcup.png (portrait poster)
  const posterH = 3.0, posterW = posterH * posterAspect;
  const posterMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  posterMat.map = loadTex('assets/logos/waidcup.png', {
    srgb: true,
    onError: () => { posterMat.map = null; posterMat.color.set(0x3d8f3d); posterMat.needsUpdate = true; },
  });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(posterW, posterH), posterMat);
  poster.position.set(-11.62, 1.9, -30.0);
  poster.rotation.y = Math.PI / 2;   // faces the arriving player, same as the logo
  group.add(poster);

  // --- Plaza greenery, at the COURT side of the plaza (the natural
  // boundary between the Grotto walkway and the TCW terrace), NOT near the
  // buildings/entrance. Sits just north of (behind) the terrace's south
  // parapet wall, on the plaza itself. A dense run of overlapping bush
  // clusters (radius 0.6-1.6 m, slight x/z jitter so it doesn't read as a
  // mechanical repeat) reads as a proper green boundary rather than a thin
  // line of puny bushes. The bed is wide (x -2..9.5) and a full bay deep
  // (z -21.4..-23.6ish), densest near the original z -21.4..-23 line and
  // thinning out toward z -23.6, so it grows toward the buildings/arch side
  // without ever reaching the walking corridor (z -25.5..-24.3, kept clear
  // on purpose — see the walk-route check where this file is used). Every
  // cluster is sunk well below the plateau floor plane (deep enough that
  // its lowest point sits >=0.15 m below floor level, so it visibly plants
  // into the deck instead of floating above it) — see the dy values below,
  // each chosen so localY (= r*0.85 + dy) keeps the blob's bottom (localY -
  // r) at least 0.15 below the group's local floor plane (y=0). No collider
  // is added for bushes, by design (walkable-through greenery).
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x2e5c28, roughness: 1, flatShading: true });
  function buildBush(x, z, r, dy = 0) {
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), bushMat);
    bush.position.set(x, r * 0.85 + dy, z);
    bush.castShadow = true; bush.receiveShadow = true;
    group.add(bush);
  }
  const bushClusters = [
    // Front row (z -21.4..-22.2, closest to the court-side line).
    { x: -2.0, z: -21.6, r: 1.0, dy: -0.15 },
    { x: -0.6, z: -21.9, r: 1.3, dy: -0.20 },
    { x: 0.8, z: -21.5, r: 0.9, dy: -0.16 },
    { x: 2.2, z: -22.0, r: 1.4, dy: -0.22 },
    { x: 3.6, z: -21.6, r: 1.0, dy: -0.15 },
    { x: 5.0, z: -21.9, r: 1.2, dy: -0.19 },
    { x: 6.4, z: -21.5, r: 0.8, dy: -0.15 },
    { x: 7.8, z: -21.8, r: 1.1, dy: -0.17 },
    { x: 9.0, z: -21.5, r: 0.9, dy: -0.15 },
    // Second, deeper row (z -22.4..-23.1) doubling the bed's depth toward
    // the buildings/arch side.
    { x: -1.5, z: -22.4, r: 1.1, dy: -0.16 },
    { x: -0.2, z: -22.9, r: 1.3, dy: -0.21 },
    { x: 1.2, z: -22.5, r: 1.0, dy: -0.15 },
    { x: 2.6, z: -23.1, r: 1.0, dy: -0.15 },
    { x: 4.0, z: -22.7, r: 1.1, dy: -0.17 },
    { x: 5.4, z: -23.0, r: 1.2, dy: -0.19 },
    { x: 6.8, z: -22.6, r: 0.9, dy: -0.15 },
    { x: 8.2, z: -22.9, r: 1.0, dy: -0.15 },
    // Sparse outliers thinning toward the walk corridor; kept well clear of
    // z=-24.3 so the corridor to the arch (z -25.5..-24.3) stays visually
    // and physically open.
    { x: -1.0, z: -23.6, r: 0.7, dy: -0.15 },
    { x: 2.0, z: -23.5, r: 0.6, dy: -0.15 },
    { x: 5.0, z: -23.6, r: 0.7, dy: -0.15 },
    { x: 8.0, z: -23.5, r: 0.6, dy: -0.15 },
  ];
  for (const b of bushClusters) buildBush(b.x, b.z, b.r, b.dy);

  // A broad, sprawling-crown tree ("ausladende Krone") anchored in the
  // plaza greenery: a short trunk + a wide, flattened canopy built from
  // overlapping icosahedra (rather than the tall narrow conifers used in
  // the forest ring), so it overhangs both the plaza and the drop to the
  // courts side. Only the trunk gets a (small) collider — the overhanging
  // crown stays walkable-under.
  {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4127, roughness: 1 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x3f7532, roughness: 1, flatShading: true });
    // 50% bigger than the original sapling-scale tree: thicker tapered trunk
    // (0.24 at the base narrowing to 0.20) and a wider, higher crown (~7 m
    // overall width) so it reads as a mature shade tree in the plaza.
    const tx = 3.5, tz = -21.9, trunkH = 4.8, trunkR = 0.24;
    // Trunk runs from the plateau floor (local y 0) up into the crown so it
    // visibly enters the lowest crown blob instead of leaving a floating gap.
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.20, trunkR, trunkH, 8), trunkMat);
    trunk.position.set(tx, trunkH / 2, tz);
    trunk.castShadow = true;
    group.add(trunk);

    // Crown sits at y=5.5, well above the trunk top (4.8) but still deeply
    // overlapped by the blobs' own radii (1.6-2.5 m), so it never floats.
    const crownY = 5.5;
    const crownBlobs = [
      { dx: 0, dz: 0, r: 2.5 },
      { dx: 1.75, dz: 0.7, r: 1.75 },
      { dx: -1.75, dz: 0.7, r: 1.75 },
      { dx: 0.6, dz: -1.9, r: 1.6 },
      { dx: -0.7, dz: -1.75, r: 1.6 },
      { dx: 0.3, dz: 2.0, r: 1.6 },
    ];
    for (const b of crownBlobs) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(b.r, 0), crownMat);
      blob.position.set(tx + b.dx, crownY, tz + b.dz);
      blob.scale.y = 0.55;
      blob.castShadow = true; blob.receiveShadow = true;
      group.add(blob);
    }

    addBox(tx - trunkR * 1.5, tz - trunkR * 1.5, tx + trunkR * 1.5, tz + trunkR * 1.5);
  }

  // Weiter hinten (östlich) neben dem Büsche-Beet, Blick nach Westen auf das
  // Platz-Tor (x=-31.2, z=-18). Der Standpunkt liegt südlich der Büsche
  // (Beet bis z=-23.6) im offenen Bereich; die Terrassen-Screens (z=-25.8)
  // liegen dabei links im Blickfeld.
  const startPos = new THREE.Vector3(-3.0, 0, -24.0);
  const lookTarget = new THREE.Vector3(-31.2, 0, -18.5);
  return { startPos, lookTarget };
}
