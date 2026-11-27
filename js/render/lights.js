// MARSOUPILAMI · render/lights.js
// Sun, sky hemisphere light and the LED canopy (RectAreaLight) on the solver's radiometric scale.
import * as THREE from 'three';
import { G } from '../geometry/dome-shape.js';
import { S0 } from '../physics/mars-environment.js';
import { params, state } from '../state.js';
import { ledAddPerWatt } from '../physics/leds.js';
import { scene } from './scene.js';

// ---------------------------------------------------------------- lights
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-45, right:45, top:45, bottom:-45, near:1, far:300 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xd9a066, 0x5a3420, 1);
scene.add(hemi);
const ledLight = new THREE.RectAreaLight(0xff0000, 0, 2*G.Rp, 2*G.Rp);
ledLight.visible = false; scene.add(ledLight);
function rectFormFactor(a, b, d){ // E/(πL) on the axis of a Lambertian 2a×2b rectangle at distance d
  d = Math.max(d, 0.05); const x=a/d, y=b/d, sx=Math.sqrt(1+x*x), sy=Math.sqrt(1+y*y);
  return (x/sx*Math.atan(y/sx) + y/sy*Math.atan(x/sy)) / Math.PI;
}
function updateLedLight(){
  const y = Math.max(0.6, (state.stats.waterBottom ?? (G.H - G.hookGap)) - 0.12);
  // RectAreaLight emits along local −Z; lookAt() would aim +Z, so rotate instead of lookAt.
  ledLight.position.set(0, y, 0);
  ledLight.rotation.set(-Math.PI/2, 0, 0);
  // square with the same area as the LED canopy (so total emitted power = W/m² × canopy area)
  const side = Math.sqrt(state.stats.canopyA || (2*G.Rp)**2); ledLight.width = side; ledLight.height = side;
  const F = rectFormFactor(side/2, side/2, y);
  // Same scale as the sun: DirectionalLight intensity 3.2 ≡ S0 W/m² of broadband sunlight, i.e. render
  // irradiance per channel = (solver sun-equivalent W) × 3.2/S0. The LEDs add W × a_c solver units per
  // channel (a = ledAddPerWatt()), so the light colour is a/max(a) and the floor irradiance of its
  // strongest channel is W × max(a) × 3.2/S0. RectAreaLight.intensity is luminance; E = π·L·F at the centre.
  const a = ledAddPerWatt(), am = Math.max(a.r, a.g, a.b, 1e-9);
  ledLight.color.setRGB(a.r/am, a.g/am, a.b/am);
  const E = Math.max(0, params.ledW) * am * (3.2 / S0);
  ledLight.intensity = (params.ledW > 0 && F > 1e-6) ? E / (Math.PI * F) : 0;
  ledLight.visible = params.ledW > 0;
}

export { hemi, ledLight, rectFormFactor, sun, updateLedLight };
