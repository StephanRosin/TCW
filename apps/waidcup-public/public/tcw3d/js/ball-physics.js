// Reine Ballphysik (kein Three.js/DOM) – unit-testbar mit `node --test`.
// Ein Ballzustand: { pos:{x,y,z}, vel:{x,y,z}, resting:boolean }.

export const GRAVITY = 9.81;          // m/s^2
export const BALL_R = 0.045;          // m (Tennisball leicht vergrößert für Sichtbarkeit)
export const RESTITUTION = 0.75;      // vertikaler Bounce (Tennisball auf Hartplatz ~0.73)
export const BOUNCE_TANGENT = 0.9;    // Horizontalverlust je Bodenaufprall
export const ROLL_FRICTION = 2.5;     // Rollreibung pro Sekunde am Boden
export const AIR_DRAG = 0.1;          // Luftwiderstand pro Sekunde
export const REST_SPEED = 0.35;       // m/s: darunter am Boden -> Ruhe

const clamp = (v, lo, hi) => {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
};

/** Kugel gegen AABB-Box (Boden 0 bis b.top). Reflektiert vel an der Kontaktnormale. */
function resolveBox(pos, vel, b) {
  const top = b.top ?? Infinity;
  const cx = clamp(pos.x, b.minX, b.maxX);
  const cy = clamp(pos.y, 0, top);
  const cz = clamp(pos.z, b.minZ, b.maxZ);
  let nx = pos.x - cx, ny = pos.y - cy, nz = pos.z - cz;
  const d2 = nx * nx + ny * ny + nz * nz;
  if (d2 >= BALL_R * BALL_R) return;              // keine Berührung

  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    nx /= d; ny /= d; nz /= d;
    const push = BALL_R - d;
    pos.x += nx * push; pos.y += ny * push; pos.z += nz * push;
  } else {
    // Zentrum in der Box: entlang der kleinsten Penetration herausdrücken (ohne Unterseite).
    const pl = pos.x - b.minX, pr = b.maxX - pos.x;
    const pf = pos.z - b.minZ, pk = b.maxZ - pos.z;
    const pu = top - pos.y;
    const m = Math.min(pl, pr, pf, pk, pu);
    nx = ny = nz = 0;
    if (m === pl) { nx = -1; pos.x = b.minX - BALL_R; }
    else if (m === pr) { nx = 1; pos.x = b.maxX + BALL_R; }
    else if (m === pf) { nz = -1; pos.z = b.minZ - BALL_R; }
    else if (m === pk) { nz = 1; pos.z = b.maxZ + BALL_R; }
    else { ny = 1; pos.y = top + BALL_R; }
  }
  const vn = vel.x * nx + vel.y * ny + vel.z * nz;
  if (vn < 0) {
    const j = (1 + RESTITUTION) * vn;
    vel.x -= j * nx; vel.y -= j * ny; vel.z -= j * nz;
  }
}

/**
 * Integriert einen Ball um EINEN Schritt dt (Sekunden). Mutiert `state` und gibt
 * es zurück. `groundFn(x,z)` liefert die Bodenhöhe, `colliders` die AABB-Boxen
 * (mit optionalem `top`). Für dünne Wände in kleinen Schritten aufrufen (der
 * Renderer substept, siehe balls.js), damit nichts durchtunnelt.
 */
export function stepBall(state, dt, groundFn, colliders) {
  if (state.resting) return state;
  const p = state.pos, v = state.vel;

  v.y -= GRAVITY * dt;
  const drag = Math.max(0, 1 - AIR_DRAG * dt);
  v.x *= drag; v.y *= drag; v.z *= drag;

  p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;

  const h = groundFn(p.x, p.z);
  if (p.y - BALL_R <= h) {
    p.y = h + BALL_R;
    if (v.y < 0) { v.y = -v.y * RESTITUTION; v.x *= BOUNCE_TANGENT; v.z *= BOUNCE_TANGENT; }
    const rf = Math.max(0, 1 - ROLL_FRICTION * dt);
    v.x *= rf; v.z *= rf;
    if (Math.hypot(v.x, v.y, v.z) < REST_SPEED) { v.x = v.y = v.z = 0; state.resting = true; }
  }

  for (const b of colliders) resolveBox(p, v, b);
  return state;
}
