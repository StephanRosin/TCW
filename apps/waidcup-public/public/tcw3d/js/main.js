import * as THREE from 'three';
import { createScene, createSky, createLights, createGround } from './world.js';
import { buildCourtRow } from './tennis.js';
import { buildForest, buildTerracePlateau, buildClubhouse, buildRestaurant } from './props.js';
import { buildEntrance } from './entrance.js';
import { buildScreens } from './screens.js';
import { createPlayer } from './player.js';
import { createBalls } from './balls.js';
import { groundHeight } from './collision.js';
import { initMusic } from './audio.js';

const app = document.getElementById('app');

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
app.appendChild(renderer.domElement);

// --- Scene / sky / lights / ground ---
const scene = createScene();
const sunDir = createSky(scene);
createLights(scene, sunDir);
createGround(scene);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1200);

// --- Facility ---
const { courtX } = buildCourtRow(scene);

// Note: the clubhouse lives on the north side of the courts (see buildClubhouse
// below), which is why the north fence has no windscreen there (clear sightline
// from the clubhouse/terrace onto the courts).

// --- Terrace plateau (Task 6): ground-height model + grandstand steps ---
buildTerracePlateau(scene);

// --- Clubhouse + pergola terrace (Task 7) ---
buildClubhouse(scene);

// --- Restaurant: second long building spanning courts 4-6, east of the clubhouse ---
buildRestaurant(scene);

// --- Entrance portal: stone arch, TCW logo, Waidcup poster, forecourt plaza ---
const { startPos, lookTarget } = buildEntrance(scene);

// --- Standing screens on the tennis-club terrace (placeholder panels; ---
// wired up for a future companion WebApp via window.__tcw.setScreen).
const screenPanels = buildScreens(scene);

// --- Forest ring ---
buildForest(scene, 1000, 64, 230);

// --- Player ---
const player = createPlayer(camera, renderer.domElement, startPos, lookTarget);
scene.add(camera);

// --- Ball werfen (linke Maustaste laden/loslassen) ---
const powerRing = document.getElementById('power-ring');
const balls = createBalls(scene, camera, powerRing);
const dom = renderer.domElement;
const isLocked = () => document.pointerLockElement === dom;
dom.addEventListener('mousedown', (e) => { if (e.button === 0 && isLocked()) balls.startCharge(); });
window.addEventListener('mouseup', (e) => { if (e.button === 0) balls.release(); });
// Ladung abbrechen (nicht werfen), wenn der Pointer-Lock verloren geht.
document.addEventListener('pointerlockchange', () => { if (!isLocked()) balls.cancel(); });
window.addEventListener('blur', () => balls.cancel());

// --- Terrace music: positional speaker on the bar wall, alternating tracks.
// Playback only starts on the "Rundgang starten" click (autoplay policy).
const music = initMusic(camera, scene);

// --- Overlay wiring ---
const overlay = document.getElementById('overlay');
const playBtn = document.getElementById('play');
const loading = document.getElementById('loading');

playBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
  player.start();
  music.start();   // resumes AudioContext + kicks off the track chain (guarded against double-start)
});
player.onStop = () => overlay.classList.remove('hidden');

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Debug handle (harmless; handy for inspecting the scene from the console).
window.__tcw = { scene, camera, renderer, music: music.audio };

window.__tcw.teleport = (x, z, yawDeg = 0) => {
  camera.position.set(x, 1.7 + groundHeight(x, z), z);
  camera.rotation.set(0, yawDeg * Math.PI / 180, 0);
  player.setView?.(x, z, yawDeg);   // keeps the controller's yaw/pitch in sync with the teleport
};

// --- Standing-screen API (for a future companion WebApp) ----------------
// `screens[i]` is the panel Mesh (east -> west, i = 0..3). `setScreen(i, source)`
// accepts a THREE.Texture, HTMLCanvasElement, HTMLImageElement or
// HTMLVideoElement, wraps it in the right texture type, sets sRGB colour
// space, and assigns it to the panel's material map. The placeholder panel
// material is tinted dark (0x0d1420) so it reads as an "off" screen; since
// three.js multiplies map x color, a texture assigned without resetting the
// colour to white would render near-black. `setScreen(i, null)` clears the
// map and restores the dark placeholder. Textures created by setScreen
// itself (from a canvas/video/image source) are tracked via
// `panel.userData.ownedTexture` and disposed on the next call; a
// caller-supplied THREE.Texture is never disposed by this API.
window.__tcw.screens = screenPanels;
window.__tcw.setScreen = (i, source) => {
  const panel = screenPanels[i];
  if (!panel) { console.warn(`setScreen: invalid screen index ${i}`); return; }

  // Dispose the previous texture only if setScreen created it itself.
  if (panel.userData.ownedTexture) panel.material.map?.dispose?.();
  panel.userData.ownedTexture = false;

  if (source == null) {
    panel.material.map = null;
    panel.material.color.set(0x0d1420);
    panel.material.needsUpdate = true;
    return;
  }

  let tex, owned = true;
  if (source instanceof THREE.Texture) {
    tex = source;
    owned = false;   // caller owns it; never dispose it from here
  } else if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    tex = new THREE.VideoTexture(source);
  } else if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    tex = new THREE.CanvasTexture(source);
  } else if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    tex = new THREE.Texture(source);
    tex.needsUpdate = true;
  } else {
    console.warn(`setScreen: unsupported source type for screen ${i}`, source);
    return;
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  panel.material.map = tex;
  panel.material.color.set(0xffffff);   // undo the dark placeholder tint so the map shows at full brightness
  panel.material.needsUpdate = true;
  panel.userData.ownedTexture = owned;
};

// --- Loop ---
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  player.update(dt);
  balls.update(dt);
  renderer.render(scene, camera);
}

// Hide the loading screen once the first frame is ready.
requestAnimationFrame(() => {
  loading.classList.add('hidden');
  animate();
});
