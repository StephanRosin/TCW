// Simple axis-aligned collision. All colliders are boxes in the XZ plane.
// The player is treated as a circle of a given radius and pushed out of any box it overlaps.

export const colliders = [];

// --- Ground height model (Task 6) ---------------------------------------
// North of the courts, a raised terrace plateau carries the future clubhouse
// (Task 7) and entrance walkway (Task 8). Two ramp zones (aligned with the
// north-fence gates) let players walk up/down between plateau and ground.
export const PLATEAU = { minX: -48, maxX: 48, minZ: -48, maxZ: -21, h: 1.5, stepDepth: 2.4 };
// A single narrow staircase, aligned with the gate-to-court-1/2 corridor at
// x=-31.2 — the only place the full-height (1.5 m) terrace steps down to
// ground level. East of it (x -29.5..-12) the terrace steps down only half
// as far, onto the half-height lawn (see LAWN below); east of the lawn
// (x=-12..48, behind the entrance wall) the south edge is a continuous
// full-height retaining wall — see buildTerracePlateau, which derives its
// wall segments from these ranges.
export const RAMPS = [ { minX: -33, maxX: -29.5 } ];

// Half-height lawn terrace east of the main stairs: the plateau's south
// edge drops only 0.75 m here (instead of the full 1.5 m), down to a grass
// deck that runs alongside the main staircase before dropping the
// remaining 0.75 m to ground level at LAWN.maxZ.
export const LAWN = { minX: -29.5, maxX: -12, minZ: -21, maxZ: -18.6, h: 0.75 };
// Small hedge-gap stair down from the terrace onto the lawn (no railing) —
// a short lerp from PLATEAU.h to LAWN.h over the same 1.2 m the hedge gap
// spans, so the visual steps (buildTerracePlateau) line up with this ramp.
export const LAWN_STAIR = { minX: -28.2, maxX: -27.0 };

// Grotto walkway: the plateau's south edge pushed all the way out to the
// court fence for x=10..48 (the Grotto Mäuerchen + terrace's own frontage),
// so the walkway runs flush with the fence instead of stepping down to
// ground first. Same height as the plateau (1.5) — no ramp, just a deeper
// footprint; see buildTerracePlateau for the extra deck/wall geometry.
// minZ (-21.05) is the parapet centerline shared with the plaza-edge wall
// and the Grotto Mäuerchen, so the whole entrance->walkway->terrace parapet
// reads as one continuous straight line (see buildTerracePlateau/
// buildRestaurant for the wall segments built along it).
export const GROTTO_WALK = { minX: 10, maxX: 48, minZ: -21.05, maxZ: -18.3, h: 1.5 };

export function groundHeight(x, z) {
  const p = PLATEAU;
  if (x < p.minX || x > p.maxX) return 0;
  if (z >= p.minZ && z <= p.maxZ) return p.h;

  // Grotto walkway extension (checked before the ramp/lawn logic below —
  // its x-range (10..48) doesn't overlap RAMPS/LAWN anyway, but it's the
  // same south-of-the-plateau shape so it belongs alongside them).
  if (x >= GROTTO_WALK.minX && x <= GROTTO_WALK.maxX && z > GROTTO_WALK.minZ && z <= GROTTO_WALK.maxZ) {
    return GROTTO_WALK.h;
  }

  // Main staircase: full 1.5 -> 0 ramp, limited to the RAMPS x-range.
  if (z > p.maxZ && z <= p.maxZ + p.stepDepth) {
    const r = RAMPS[0];
    if (x >= r.minX && x <= r.maxX) {
      return p.h * (1 - (z - p.maxZ) / p.stepDepth);
    }
  }

  // Half-height lawn terrace (its own x/z strip, independent of RAMPS).
  if (x >= LAWN.minX && x <= LAWN.maxX && z > LAWN.minZ && z <= LAWN.maxZ) {
    if (x >= LAWN_STAIR.minX && x <= LAWN_STAIR.maxX && z <= -19.8) {
      const t = (z - LAWN.minZ) / 1.2;   // 0 at z=-21, 1 at z=-19.8
      return p.h + t * (LAWN.h - p.h);   // lerp 1.5 -> 0.75
    }
    return LAWN.h;
  }

  return 0;
}

/** Register an axis-aligned box collider (world coordinates). */
export function addBox(minX, minZ, maxX, maxZ) {
  colliders.push({ minX, minZ, maxX, maxZ });
}

/** Add a thin wall between two points (only horizontal/vertical walls). */
export function addWall(x1, z1, x2, z2, thickness = 0.15) {
  const t = thickness / 2;
  addBox(
    Math.min(x1, x2) - t, Math.min(z1, z2) - t,
    Math.max(x1, x2) + t, Math.max(z1, z2) + t
  );
}

/**
 * Resolve the player position against all colliders.
 * Mutates `pos` (a THREE.Vector3) in place, only touching x and z.
 */
export function resolveCollisions(pos, radius) {
  for (const b of colliders) {
    // Closest point on the box to the circle centre.
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const distSq = dx * dx + dz * dz;

    if (distSq > radius * radius) continue;

    if (distSq > 1e-8) {
      // Outside the box but within radius: push straight out.
      const dist = Math.sqrt(distSq);
      const push = radius - dist;
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
    } else {
      // Centre is inside the box: push out along the axis of least penetration.
      const penLeft = pos.x - b.minX;
      const penRight = b.maxX - pos.x;
      const penFront = pos.z - b.minZ;
      const penBack = b.maxZ - pos.z;
      const minPen = Math.min(penLeft, penRight, penFront, penBack);
      if (minPen === penLeft) pos.x = b.minX - radius;
      else if (minPen === penRight) pos.x = b.maxX + radius;
      else if (minPen === penFront) pos.z = b.minZ - radius;
      else pos.z = b.maxZ + radius;
    }
  }
}
