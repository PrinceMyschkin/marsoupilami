// MARSOUPILAMI · render/lighting.js
// updateLight(): sun, sky, interior tint, lamps, LED auto-balance and path-trace sync for the
// current time / dust / layers, then refreshes the info panel.
import * as THREE from 'three';
import { S0, irradiance, sunVector } from '../physics/mars-environment.js';
import { params, state } from '../state.js';
import { interiorTransmission, tunnelModel } from '../physics/light-transport.js';
import { computeLedAuto } from '../physics/leds.js';
import { renderer, scene } from './scene.js';
import { TINT } from './materials.js';
import { hemi, sun, updateLedLight } from './lights.js';
import { PT_SKY_EY, skyMat } from './sky.js';
import { lampHeadMat, lampLights } from '../geometry/terrain.js';
import { upLensMat, upLights } from '../geometry/tethers.js';
import { pillowMat } from '../geometry/pillows.js';
import { sculptMat } from '../geometry/scale-objects.js';
import { diffMat, drawPerf } from '../geometry/tunnels.js';
import { platMats, platformGroup, platformLights } from '../geometry/platform.js';
import { renderInfoPanel } from '../ui/info-panel.js';

let _perf = -1; function drawPerfIfChanged(){ if (_perf !== params.perfOpen){ _perf = params.perfOpen; drawPerf(params.perfOpen/100); } }
function updateLight(){
  const L = state.stats.L ?? params.layers;
  const sv = sunVector(params.time, params.lat, params.decl);
  const elev = Math.asin(THREE.MathUtils.clamp(sv.y,-1,1));
  const az = (Math.atan2(sv.x, -sv.z)*180/Math.PI + 360) % 360;   // from north, clockwise
  const I = irradiance(sv.y, params.tau);
  // sun & sky colour (dust absorbs blue slightly more -> reddened direct beam at low sun)
  const m = Math.max(sv.y, 0.035);
  const sunCol = new THREE.Color(Math.exp(-params.tau*0.92/m), Math.exp(-params.tau*1.0/m), Math.exp(-params.tau*1.12/m));
  const mx = Math.max(sunCol.r, sunCol.g, sunCol.b, 1e-6); sunCol.multiplyScalar(1/mx);
  sun.color.copy(sunCol);
  sun.intensity = 3.2 * I.dni / S0;
  sun.position.copy(sv).multiplyScalar(150); sun.target.position.set(0,0,0);
  sun.visible = sv.y > 0;
  const low = 1 - THREE.MathUtils.smoothstep(sv.y, 0, 0.35);
  hemi.color.setRGB(0.86,0.62,0.42).lerp(new THREE.Color(0.55,0.62,0.85), low*0.35);
  hemi.groundColor.setRGB(0.42,0.26,0.17);
  hemi.intensity = Math.max(0.025, 2.2 * I.dif / (S0*0.35));
  skyMat.uniforms.sunDir.value.copy(sv);
  scene.fog.color.setRGB(0.86,0.62,0.42).multiplyScalar(THREE.MathUtils.clamp(0.02 + I.glob/350, 0.02, 1));
  // interior tint from Beer–Lambert through the water stack
  const { w, bag } = interiorTransmission(L, elev);
  // light tunnels: (1 − fc·capture) of the area keeps the water-filtered light; the captured share goes
  // unfiltered (spectrally flat Al) through the pipe and leaves the diffuser as diffuse light
  const tm = tunnelModel(L, elev);
  TINT.dir.value.setRGB(tm.keep*w.direct.r*bag, tm.keep*w.direct.g*bag, tm.keep*w.direct.b*bag);
  // Interior diffuse on the same radiometric scale as the sun and the LEDs (3.2 ≡ S0 W/m²), per channel
  // exactly what the solver counts as diffuse inside. The hemisphere light's intensity and butterscotch
  // colour are tuned for the outside look, so they are divided out here. Tunnel light leaves the
  // diffusers as diffuse, spectrally flat light.
  const hc = hemi.color, hI = Math.max(hemi.intensity, 1e-6), tunDif = tm.kDir*I.dir + tm.kDif*I.dif;
  const difC = c => (tm.keep*w.diffuse[c]*bag*I.dif + tunDif) * (3.2/S0) / (hI*Math.max(hc[c], 1e-3));
  TINT.dif.value.setRGB(difC('r'), difC('g'), difC('b'));
  // diffuser luminance relative to the outside sky: delivered tunnel flux / diffuser (= mouth) area
  const tunExit = I.glob > 0 && tm.fM > 0 ? (tm.kDir*I.dir + tm.kDif*I.dif)/(tm.fM*I.glob) : 0;
  diffMat.emissiveIntensity = Math.min(4, THREE.MathUtils.clamp(I.glob/450, 0, 1) * tunExit * 0.6);
  drawPerfIfChanged();
  // pillows glow with the sky light they transmit (seen from below)
  const glow = THREE.MathUtils.clamp(I.glob/450, 0, 1) * 0.45;
  pillowMat.emissive.setRGB(0.86*w.diffuse.r*glow, 0.70*w.diffuse.g*glow, 0.55*w.diffuse.b*glow);
  renderer.toneMappingExposure = params.exposure;
  const lampsOn = params.pathLights === 'on' || (params.pathLights === 'auto' && elev < 2*Math.PI/180);
  for (const Lp of lampLights) Lp.intensity = lampsOn ? 1.6 : 0;
  for (const u of upLights) u.intensity = lampsOn ? 2.2 : 0;
  upLensMat.emissiveIntensity = lampsOn ? 1.2 : 0;
  lampHeadMat.emissiveIntensity = lampsOn ? 2.5 : 0;
  const platOn = lampsOn && platformGroup.visible;
  for (const Lp of platformLights) Lp.intensity = platOn ? (Lp.userData.kind==='rail' ? 0.85 : 1.05) : 0;
  platMats.lamp.emissiveIntensity = platOn ? 1.8 : 0;
  sculptMat.envMapIntensity = THREE.MathUtils.clamp(0.03 + I.glob/400, 0.03, 1);
  const fracDir = I.glob>0 ? I.dir/I.glob : 0;
  state.ledAutoState = computeLedAuto(I, w, bag, tm, fracDir);
  if (params.ledAuto){
    params.ledW = state.ledAutoState.applied;
    state.cLedW?.updateDisplay();
    state.cLedW?.disable();
  } else {
    state.cLedW?.enable();
  }
  updateLedLight();
  state.ptEnvK = (3.2*I.dif/S0) / PT_SKY_EY;
  if (state.ptHook) state.ptHook();
  renderInfoPanel({ L, elev, az, I, w, bag, tm, fracDir });
}

export { updateLight };
