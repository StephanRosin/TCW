import * as THREE from 'three';

/**
 * Positional terrace music: a small speaker box mounted on the bar's
 * wooden wall (south face, near the top) plays two tracks alternately,
 * forever (track1 -> track2 -> track1 -> ...), audible on the plaza/
 * entrance (~20-28 m away) but silent at the Grotto terrace (30-60 m away).
 *
 * Playback must only start after a user gesture (browser autoplay policy),
 * so this module builds the audio graph eagerly but exposes `start()` for
 * the caller to invoke from a click handler.
 */
const TRACKS = ['assets/audio/track1.mp3', 'assets/audio/track2.mp3'];

export function initMusic(camera, scene) {
  const listener = new THREE.AudioListener();
  camera.add(listener);

  const audio = new THREE.PositionalAudio(listener);
  // refDistance 6: Dämpfung beginnt schon wenige Schritte neben dem
  // Lautsprecher (bei 10 lag die ganze Terrasse im "volle Lautstärke"-Radius).
  audio.setRefDistance(6);
  audio.setMaxDistance(38);
  audio.setRolloffFactor(1);
  audio.setDistanceModel('linear');
  audio.setVolume(0.1);

  // Small dark-grey speaker box on the bar wooden wall's south face, near
  // the top (wall spans x -19..-12.4, z=-33.8, height 3.6 -> baseY 1.5).
  const speakerMat = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.6, metalness: 0.3 });
  const speaker = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.25), speakerMat);
  speaker.position.set(-16, 3.6, -33.5);
  speaker.castShadow = true;
  speaker.add(audio);
  scene.add(speaker);

  const loader = new THREE.AudioLoader();
  const buffers = [null, null];

  async function loadTrack(i) {
    try {
      buffers[i] = await loader.loadAsync(TRACKS[i]);
    } catch (err) {
      console.warn(`[audio] failed to load ${TRACKS[i]}:`, err);
      buffers[i] = null;
    }
  }
  const loaded = Promise.all([loadTrack(0), loadTrack(1)]);

  let current = 0;
  function playNext() {
    // Alternate forever; a missing/failed track is skipped so the other
    // one keeps looping instead of crashing the chain.
    for (const _track of TRACKS) {
      const idx = current;
      const buf = buffers[idx];
      current = (current + 1) % TRACKS.length;
      if (buf) {
        audio.setBuffer(buf);
        audio.onEnded = () => { audio.isPlaying = false; playNext(); };
        audio.play();
        return;
      }
      console.warn(`[audio] track ${idx} unavailable, skipping`);
    }
    console.warn('[audio] no terrace-music tracks available');
  }

  let started = false;
  function start() {
    if (started) return;   // guard against double-start (e.g. double click)
    started = true;
    if (listener.context.state === 'suspended') listener.context.resume();
    loaded.then(playNext);
  }

  return { start, audio, speaker };
}
