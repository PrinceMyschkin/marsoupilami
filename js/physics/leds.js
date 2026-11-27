// MARSOUPILAMI · physics/leds.js
// Red grow LEDs (620 + 660 nm): channel data, mix, PAR / lux / electrical power, and the
// auto white balance (Duv = 0) solver including its sol-integrated DLI.
import * as THREE from 'three';
import { irradiance, sunVector } from './mars-environment.js';
import { params, state } from '../state.js';
import { interiorTransmission, tunnelModel } from './light-transport.js';
import { ledChannel, mixColour } from './colour.js';

// Two-channel red grow LEDs just under the pillows (one mixed luminous ceiling over the plateau).
// 620 nm: orange-red, closer to the eye's red / better colour rendering (high lm/W).
// 660 nm: deep red, most efficient for photosynthesis (chlorophyll peak, higher wall-plug and µmol/J).
// Default mix 60 % 620 / 40 % 660: 620 nm does the white balance (about 5× more visual red per watt,
// close to the eye's red), 660 nm adds photosynthetic photons (chlorophyll peak, higher wall-plug and
// µmol/J) so the LED share of the DLI does not vanish when auto-balance only needs a little red.
const LED_MAX = 100;
const LED_TARGET_RED_SHARE = 1/3;   // sunlight's share in the R/G/B bars (reference only; auto targets Duv = 0)
const LED_CH = {
  620: { nm:620, umol:5.18, eta:0.38, lm:255, ...ledChannel(620) },   // r ≈ 14.6 sun-W per optical W
  660: { nm:660, umol:5.52, eta:0.52, lm:44.5, ...ledChannel(660) },  // r ≈ 2.8
};
function ledMix620(){ return THREE.MathUtils.clamp(params.ledMix620 ?? 0.6, 0, 1); }
function ledSplit(total){ const f=ledMix620(), t=Math.max(0,total); return { f, w620:t*f, w660:t*(1-f) }; }
function ledAddPerWatt(){ const f=ledMix620(), a=LED_CH[620], b=LED_CH[660];
  return { r:f*a.r+(1-f)*b.r, g:f*a.g+(1-f)*b.g, b:f*a.b+(1-f)*b.b }; }
function ledParPerWatt(){ const f=ledMix620(); return f*LED_CH[620].umol + (1-f)*LED_CH[660].umol; }
function ledLuxOf(w620, w660){ return w620*LED_CH[620].lm + w660*LED_CH[660].lm; }
function ledElecOf(w620, w660){ return w620/LED_CH[620].eta + w660/LED_CH[660].eta; }
// initial auto-balance state (read by the info panel and window.__mars before the first updateLight)
state.ledAutoState = { raw:0, applied:0, clamped:false, targetShare: LED_TARGET_RED_SHARE, outShare: LED_TARGET_RED_SHARE, inShare:0, mixShare:0, rgb:{r:0,g:0,b:0}, f:1.0, w620:0, w660:0 };
function waterFilteredRGB(I, w, bag, tm, fracDir){
  const tT = params.tunnels ? (fracDir*(tm.kDir||0) + (1-fracDir)*(tm.kDif||0)) : 0;
  const keep = params.tunnels ? (tm.keep ?? 1) : 1;
  const ch = c => keep*(fracDir*w.direct[c] + (1-fracDir)*w.diffuse[c])*bag * I.glob + tT * I.glob;
  return { r: ch('r'), g: ch('g'), b: ch('b') };
}
function ledWForWhiteBalance(rgb){           // 0 when there is no sunlight (night)
  // Auto-balance target: Duv = 0, i.e. the mixed light lies on the Planckian (blackbody) locus.
  // Water leaves the light above the locus (blue-green, Duv > 0); red LED light moves it down. Adding red
  // cannot fix the green-vs-blue deficit, so "R share = 1/3" overshot into pink; Duv = 0 is the closest
  // red-only light gets to white (a cool daylight white). Duv falls monotonically with W -> bisection.
  if (rgb.r + rgb.g + rgb.b <= 1e-9) return 0;
  if (mixColour(rgb, 0).Duv <= 0) return 0;               // already on the pink side without LEDs
  let lo = 0, hi = LED_MAX;
  while (mixColour(rgb, hi).Duv > 0){ lo = hi; hi *= 2; if (hi > 10*LED_MAX) return hi; }   // unreachable within the cap
  for (let k=0;k<40;k++){ const m = (lo+hi)/2; if (mixColour(rgb, m).Duv > 0) lo = m; else hi = m; }
  return (lo+hi)/2;
}
function computeLedAuto(I, w, bag, tm, fracDir){
  const rgb = waterFilteredRGB(I, w, bag, tm, fracDir);
  const raw = ledWForWhiteBalance(rgb);
  const applied = THREE.MathUtils.clamp(raw, 0, LED_MAX);
  const add = ledAddPerWatt(), { f, w620, w660 } = ledSplit(applied);
  const sum0 = rgb.r+rgb.g+rgb.b, addR = add.r*applied, addG = add.g*applied, addB = add.b*applied;
  const sum1 = sum0 + addR + addG + addB;
  return { rgb, raw, applied, clamped: raw > LED_MAX, targetShare: LED_TARGET_RED_SHARE,
    outShare: I.glob>0 ? LED_TARGET_RED_SHARE : 0,
    inShare: sum0>0 ? rgb.r/sum0 : 0,
    mixShare: sum1>0 ? (rgb.r+addR)/sum1 : 0, f, w620, w660, sunCol: sum0>0 ? mixColour(rgb, 0) : null };
}
function dliLedAuto(){ // integrate the auto setpoint over one 24.66 h sol (same time grid as sunlight DLI)
  let s=0; const steps=96, L = params.pillows ? params.layers : 0, parW=ledParPerWatt();
  for (let k=0;k<steps;k++){
    const h=(k+0.5)/steps*24, sv=sunVector(h, params.lat, params.decl), I=irradiance(sv.y, params.tau);
    if (I.glob<=0) continue;
    const elev=Math.asin(THREE.MathUtils.clamp(sv.y,-1,1)), {w,bag}=interiorTransmission(L, elev);
    const tm=tunnelModel(L, elev), fracDir=I.dir/I.glob;
    const led=THREE.MathUtils.clamp(ledWForWhiteBalance(waterFilteredRGB(I,w,bag,tm,fracDir)), 0, LED_MAX);
    s += led*parW*(88775/steps);
  }
  return s/1e6;
}

export { computeLedAuto, dliLedAuto, LED_CH, LED_MAX, ledAddPerWatt, ledMix620, ledSplit };
