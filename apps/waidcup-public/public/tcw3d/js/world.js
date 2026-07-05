import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { pbr } from './textures.js';

/** Create the scene with fog tuned to blend the forest into a hazy horizon. */
export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe3f5, 150, 380);
  return scene;
}

/** Physically-ish sky with a sun, matching the bright blue clear-day screenshots. */
export function createSky(scene) {
  const sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);

  const u = sky.material.uniforms;
  u.turbidity.value = 2.4;
  u.rayleigh.value = 1.7;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.8;

  // Sun high in the sky (clear summer noon).
  const sun = new THREE.Vector3();
  const elevation = 55;   // degrees above horizon
  const azimuth = 150;    // degrees
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  u.sunPosition.value.copy(sun);

  return sun;
}

/** Sun (directional) + sky/hemisphere fill light, with shadows. */
export function createLights(scene, sunDir) {
  const hemi = new THREE.HemisphereLight(0xdcecff, 0x5a6b3a, 1.4);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff3e0, 2.4);
  sun.position.copy(sunDir).multiplyScalar(160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const s = 120;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);

  return sun;
}

/** Large grassy ground plane with a photoreal PBR grass texture. */
export function createGround(scene) {
  const size = 800;
  const mat = pbr({ dir: 'assets/textures/grass', color: 0x6a8f4a, repeat: [size / 6, size / 6] });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}
