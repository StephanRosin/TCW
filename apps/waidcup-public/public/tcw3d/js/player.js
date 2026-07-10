import * as THREE from 'three';
import { resolveCollisions, groundHeight } from './collision.js';

const EYE_HEIGHT = 1.7;
const RADIUS = 0.4;
const WALK = 5.5;
const RUN = 10.5;
const ACCEL = 12;
const WORLD_LIMIT = 240;
const SENS = 0.0022;               // mouse sensitivity (rohe Bewegung, Chromium)
const PITCH_LIMIT = Math.PI / 2 - 0.05;

// Firefox/Safari unterstützen requestPointerLock({unadjustedMovement}) nicht und
// liefern OS-beschleunigte movementX/Y (langsam ~nichts, schnell viel zu viel).
// Diese Potenzkurve rechnet die Geschwindigkeitsabhängigkeit heraus: |d|^COMP_P
// spreizt um einen fixen Mittel-Tempo-Punkt (per COMP_SENS gepinnt: mittlere
// Bewegung ~10 px/Event wirkt wie im rohen Chromium-Pfad, 10·SENS ≈
// COMP_SENS·10^COMP_P). Kleineres COMP_P = stärkere Spreizung: langsame
// Bewegungen werden angehoben, schnelle Flicks stärker gedämpft. Empirisch am
// Firefox/Linux abgestimmt (langsam zu langsam, schnell zu schnell → p=0.65).
const COMP_P = 0.65;
const COMP_SENS = 0.0049;

/**
 * First-person controller with two look modes:
 *  - Pointer Lock (preferred): click to capture the mouse, move freely.
 *  - Drag fallback: if pointer lock is unavailable/denied (e.g. embedded
 *    frames), hold the mouse button and drag to look around.
 * Keyboard movement works whenever the walk has been "started".
 */
export function createPlayer(camera, dom, startPos, lookAt) {
  camera.rotation.order = 'YXZ';
  camera.position.set(startPos.x, EYE_HEIGHT + groundHeight(startPos.x, startPos.z), startPos.z);

  let yaw = 0, pitch = 0;
  if (lookAt) {
    yaw = Math.atan2(-(lookAt.x - startPos.x), -(lookAt.z - startPos.z));
  }

  let started = false;
  let dragging = false;
  let rawMovement = false;   // true = Browser liefert rohe Bewegung (Chromium unadjustedMovement)
  let onStop = () => {};

  const keys = Object.create(null);
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'Escape') stop();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  // Alt-tab / focus loss: release every held key so movement doesn't get
  // "stuck" (e.g. a stuck-W walk) once the window regains focus.
  window.addEventListener('blur', () => {
    for (const code in keys) keys[code] = false;
  });

  const isLocked = () => document.pointerLockElement === dom;

  function applyLook(dx, dy) {   // rohe Pixel × SENS (Touch + Chromium-Pfad)
    yaw -= dx * SENS;
    pitch -= dy * SENS;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  }

  // Firefox/Safari: OS-Beschleunigung per Potenzkurve neutralisieren.
  function applyLookComp(dx, dy) {
    yaw   -= Math.sign(dx) * COMP_SENS * Math.pow(Math.abs(dx), COMP_P);
    pitch -= Math.sign(dy) * COMP_SENS * Math.pow(Math.abs(dy), COMP_P);
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  }

  document.addEventListener('mousemove', (e) => {
    if (!started) return;
    if (!(isLocked() || dragging)) return;
    if (rawMovement) applyLook(e.movementX || 0, e.movementY || 0);
    else applyLookComp(e.movementX || 0, e.movementY || 0);
  });

  // Drag fallback (used when pointer lock is not active).
  dom.addEventListener('mousedown', () => { if (started && !isLocked()) { dragging = true; dom.style.cursor = 'grabbing'; } });
  window.addEventListener('mouseup', () => { dragging = false; dom.style.cursor = ''; });

  // Touch drag (mobile).
  let lastTouch = null;
  dom.addEventListener('touchstart', (e) => { if (started) lastTouch = e.touches[0]; }, { passive: true });
  dom.addEventListener('touchmove', (e) => {
    if (!started || !lastTouch) return;
    const t = e.touches[0];
    applyLook((t.clientX - lastTouch.clientX) * 2.2, (t.clientY - lastTouch.clientY) * 2.2);
    lastTouch = t;
  }, { passive: true });
  dom.addEventListener('touchend', () => { lastTouch = null; }, { passive: true });

  // Tracks the previous locked state so we can detect a locked->unlocked
  // transition (e.g. the user pressed the browser's own Esc-to-unlock, or
  // the frame lost pointer lock for any other reason) and reopen the menu.
  // The drag-look fallback never engages pointer lock, so isLocked() stays
  // false throughout and this transition never fires for that path.
  let wasLocked = false;
  document.addEventListener('pointerlockchange', () => {
    const locked = isLocked();
    document.body.classList.toggle('locked', locked);
    if (!locked) rawMovement = false; // beim Entsperren zurücksetzen (Drag-Fallback kompensiert)
    if (wasLocked && !locked && started) stop();
    wasLocked = locked;
  });

  // Pointer Lock möglichst ohne OS-Mausbeschleunigung anfordern
  // (unadjustedMovement = rohe 1:1-Bewegung, nur Chromium). Löst der Request als
  // Promise auf, liefert der Browser rohe Bewegung (rawMovement = true). Firefox
  // lehnt mit NotSupportedError ab → normaler (OS-beschleunigter) Lock, den die
  // Potenzkurve in applyLookComp kompensiert. Safari kennt die Promise-Form nicht
  // (Rückgabe undefined) → ebenfalls kompensierter Pfad. Scheitert der Lock ganz
  // (z. B. im Frame verweigert), greift weiterhin der Drag-Look (auch kompensiert).
  function requestLock() {
    if (!dom.requestPointerLock) return;
    const result = dom.requestPointerLock({ unadjustedMovement: true });
    if (result && typeof result.then === 'function') {
      result.then(() => { rawMovement = true; }).catch((err) => {
        rawMovement = false;
        if (err?.name === 'NotSupportedError') {
          Promise.resolve(dom.requestPointerLock()).catch(() => {});
        }
      });
    } else {
      rawMovement = false; // void-API (Safari): Option ignoriert, keine rohe Bewegung
    }
  }

  function start() {
    started = true;
    document.body.classList.add('locked');
    requestLock();
  }
  function stop() {
    if (!started) return;
    started = false;
    dragging = false;
    document.body.classList.remove('locked');
    if (isLocked()) document.exitPointerLock?.();
    onStop();
  }

  const velocity = new THREE.Vector3();

  function update(dt) {
    camera.rotation.set(pitch, yaw, 0);
    if (!started) { velocity.set(0, 0, 0); return; }

    const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
    const fwd = { x: -sinY, z: -cosY };   // horizontal forward
    const right = { x: cosY, z: -sinY };

    const f = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
    const s = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);

    let wx = fwd.x * f + right.x * s;
    let wz = fwd.z * f + right.z * s;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }

    const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? RUN : WALK;
    const t = Math.min(1, ACCEL * dt);
    velocity.x += (wx * speed - velocity.x) * t;
    velocity.z += (wz * speed - velocity.z) * t;

    camera.position.x += velocity.x * dt;
    camera.position.z += velocity.z * dt;

    resolveCollisions(camera.position, RADIUS);

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -WORLD_LIMIT, WORLD_LIMIT);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -WORLD_LIMIT, WORLD_LIMIT);

    const targetY = EYE_HEIGHT + groundHeight(camera.position.x, camera.position.z);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, Math.min(1, 10 * dt));
  }

  return {
    update,
    start,
    stop,
    set onStop(fn) { onStop = fn; },
    setView(x, z, yawDeg) {
      camera.position.x = x; camera.position.z = z;
      yaw = yawDeg * Math.PI / 180; pitch = 0;
    },
  };
}
