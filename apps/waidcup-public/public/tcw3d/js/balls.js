import * as THREE from 'three';
import { stepBall, BALL_R } from './ball-physics.js';
import { groundHeight, colliders } from './collision.js';

const CHARGE_TIME = 1.2;        // s bis Maximalladung
const THROW_COOLDOWN = 1.0;     // s zwischen Würfen (max 1 Ball/s)
const SPEED_MIN = 6;            // m/s bei 0 % Ladung
const SPEED_MAX = 20;           // m/s bei 100 % Ladung
const LIFETIME = 8;             // s bis der Ball verschwindet
const FADE = 0.6;               // s Ausblendzeit am Ende
const SUBSTEP = 1 / 240;        // fixe Physik-Schrittweite (verhindert Tunneling)

const GREEN = new THREE.Color(0x3fd15f);
const RED = new THREE.Color(0xe0453a);

/**
 * Ball-Werfen im Rundgang. `ringEl` ist das Crosshair-Ring-Overlay; es bekommt
 * `--charge` (0..1), `--ring-color` und die Klasse `active` während des Ladens.
 */
export function createBalls(scene, camera, ringEl) {
  const geo = new THREE.SphereGeometry(BALL_R, 16, 12);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xd6e34c, roughness: 0.85, metalness: 0 });
  const balls = [];               // { mesh, pos, vel, resting, age }
  let now = 0;
  let charging = false;
  let chargeStart = 0;
  let lastThrow = -Infinity;

  function startCharge() {
    if (charging) return;
    if (now - lastThrow < THROW_COOLDOWN) return;   // Cooldown aktiv
    charging = true;
    chargeStart = now;
  }

  function cancel() {
    charging = false;
    ringEl.classList.remove('active');
  }

  function release() {
    if (!charging) return;
    charging = false;
    ringEl.classList.remove('active');
    const t = Math.min(1, (now - chargeStart) / CHARGE_TIME);
    const speed = SPEED_MIN + t * (SPEED_MAX - SPEED_MIN);
    spawn(speed);
    lastThrow = now;
  }

  function spawn(speed) {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const origin = camera.position.clone().addScaledVector(forward, 0.5);
    origin.y -= 0.2;                                 // knapp unter Augenhöhe abwerfen
    const mesh = new THREE.Mesh(geo, baseMat.clone());
    mesh.position.copy(origin);
    mesh.castShadow = true;
    scene.add(mesh);
    balls.push({
      mesh,
      pos: { x: origin.x, y: origin.y, z: origin.z },
      vel: { x: forward.x * speed, y: forward.y * speed, z: forward.z * speed },
      resting: false,
      age: 0,
    });
  }

  function updateRing() {
    if (!charging) { ringEl.classList.remove('active'); return; }
    const t = Math.min(1, (now - chargeStart) / CHARGE_TIME);
    ringEl.classList.add('active');
    ringEl.style.setProperty('--charge', String(t));
    ringEl.style.setProperty('--ring-color', '#' + GREEN.clone().lerp(RED, t).getHexString());
  }

  function update(dt) {
    now += dt;
    updateRing();

    // Physik in festen Sub-Schritten (stabil gegen Tunneling durch dünne Wände).
    const steps = Math.max(1, Math.min(8, Math.ceil(dt / SUBSTEP)));
    const sub = dt / steps;

    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.age += dt;
      for (let s = 0; s < steps; s++) stepBall(b, sub, groundHeight, colliders);
      b.mesh.position.set(b.pos.x, b.pos.y, b.pos.z);

      // Ausblenden gegen Ende der Lebensdauer.
      const remaining = LIFETIME - b.age;
      if (remaining < FADE) {
        b.mesh.material.transparent = true;
        b.mesh.material.opacity = Math.max(0, remaining / FADE);
      }
      if (b.age >= LIFETIME) {
        scene.remove(b.mesh);
        b.mesh.material.dispose();               // geklontes Material; geo ist geteilt (nicht disposen)
        balls.splice(i, 1);
      }
    }
  }

  return { update, startCharge, release, cancel };
}
