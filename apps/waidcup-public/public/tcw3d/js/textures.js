import * as THREE from 'three';

const loader = new THREE.TextureLoader();

// Cache of already-loaded textures, keyed by path+repeat+colorSpace, so
// repeated calls for the same texture set (e.g. one pbr() per court/segment)
// reuse a single THREE.Texture/GPU upload instead of re-fetching and
// re-uploading the same file over and over.
const _texCache = new Map();

// Directories where a nor.jpg 404 has already been observed — remembered so
// we don't keep re-requesting (and re-logging) a normal map that doesn't exist.
const _noNormalMap = new Set();

export function loadTex(path, { repeat = [1, 1], srgb = false, onError } = {}) {
  const key = `${path}|${repeat[0]},${repeat[1]}|${srgb}`;
  const cached = _texCache.get(key);
  if (cached) return cached;

  const tex = loader.load(path, undefined, undefined,
    () => {
      console.warn(`Textur fehlt: ${path} — Fallback-Farbe aktiv`);
      onError?.();
    });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  _texCache.set(key, tex);
  return tex;
}

// Per-directory in-flight/resolved nor.jpg probe, so that several pbr()
// calls for the same directory issued back-to-back in the same tick (e.g.
// concrete is used with three different repeats across props.js) share a
// single real network request instead of each independently 404-ing.
const _norProbes = new Map();

/**
 * Fetches `${dir}/nor.jpg` at most once per directory (any repeat), then
 * hands every caller — immediate or queued — a texture clone with its own
 * `repeat`. `cb(tex|null)` is invoked once resolved (`null` on 404).
 */
function withNormalMap(dir, repeat, cb) {
  if (_noNormalMap.has(dir)) { cb(null); return; }

  let probe = _norProbes.get(dir);
  if (!probe) {
    probe = { tex: null, resolved: false, waiters: [] };
    _norProbes.set(dir, probe);
    const raw = loader.load(`${dir}/nor.jpg`,
      () => {
        probe.tex = raw;
        probe.resolved = true;
        probe.waiters.forEach((fn) => fn(raw));
        probe.waiters = [];
      },
      undefined,
      () => {
        _noNormalMap.add(dir);
        probe.resolved = true;
        probe.waiters.forEach((fn) => fn(null));
        probe.waiters = [];
      });
    raw.wrapS = raw.wrapT = THREE.RepeatWrapping;
    raw.anisotropy = 8;
  }

  const apply = (raw) => {
    if (!raw) { cb(null); return; }
    const nor = raw.clone();
    nor.needsUpdate = true;
    nor.repeat.set(repeat[0], repeat[1]);
    cb(nor);
  };
  if (probe.resolved) apply(probe.tex);
  else probe.waiters.push(apply);
}

/** PBR-Material aus einem Textur-Set-Ordner (diff.jpg [+ nor.jpg]). */
export function pbr({ dir, color = 0xffffff, repeat = [1, 1], roughness = 1, metalness = 0, normalScale = 1 }) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  mat.map = loadTex(`${dir}/diff.jpg`, {
    repeat, srgb: true,
    onError: () => { mat.map = null; mat.needsUpdate = true; },
  });

  // Normal-Map nur setzen, wenn Datei existiert — Existenz zur Ladezeit unbekannt,
  // deshalb optimistisch anfragen; ein 404 wird pro Ordner nur einmal
  // ausgelöst (withNormalMap dedupliziert gleichzeitige Aufrufe).
  withNormalMap(dir, repeat, (nor) => {
    if (!nor) return;
    mat.normalMap = nor;
    mat.normalScale.set(normalScale, normalScale);
    mat.needsUpdate = true;
  });

  return mat;
}
