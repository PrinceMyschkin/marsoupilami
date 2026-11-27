// MARSOUPILAMI · physics/light-transport.js
// Light through the roof: pillow stack + membrane transmission, light-tunnel optics (étendue-limited),
// daily light integral over one sol.
import * as THREE from 'three';
import { G } from '../geometry/dome-shape.js';
import { DIFFUSER_T, FUNNEL_RHO, T_MEMBRANE, pipeT, pipeTdiffuse, waterT } from './optics.js';
import { PAR_PER_W, irradiance, sunVector } from './mars-environment.js';
import { params, state } from '../state.js';

function interiorTransmission(L, elev){
  // w: pillow stack (water + bag films + open gaps, see PILLOW / layerTl); bag: outer membrane only
  return { w: waterT(L, elev), bag: T_MEMBRANE };
}
// light-tunnel optics, per unit roof area and per unit outside irradiance (before the outer membrane):
//  • water-filtered share: open roof + perforations of the funnel sheet (pipe cells hold no water)
//  • mouth: light falling straight into the Ø1.6 m pipe mouth
//  • funnel sheet: captured share (1 − open) × FUNNEL_RHO, but limited by étendue: a static concentrator with
//    area ratio C = A_funnel/A_mouth only accepts directions within θa = asin(1/√C) (ideal CPC bound);
//    redirected light leaves the funnel at steep angles -> diffuse-like pipe transmission.
//  naive = no étendue limit (every captured ray reaches the pipe).
function tunnelModel(L, elev, naive=false){
  const fF = state.stats.fF||0, fP = state.stats.fP||0, fM = state.stats.fM||0, open = params.perfOpen/100, len = state.stats.pipeLen || (L*G.layerH + 0.1);
  if (!fM) return { keep:1, kDir:0, kDif:0, fF, fM, C:1, thA:Math.PI/2, len, tpDir:1, tpDif:1, open };
  const C = fF/fM, thA = Math.asin(Math.min(1, 1/Math.sqrt(C))), zen = Math.PI/2 - Math.max(elev, 0.01);
  const tpDir = pipeT(len, zen), tpDif = pipeTdiffuse(len), cap = (1-open)*FUNNEL_RHO, sheet = fF - fM;
  const acc = naive ? 1 : 1 - THREE.MathUtils.smoothstep(zen, thA - 0.035, thA + 0.035);
  const kDir = fM*tpDir + sheet*cap*acc*tpDif;
  const kDif = naive ? (fM + sheet*cap)*tpDif : fM*tpDif*(fM/fF + (1 - fM/fF)*cap);   // diffuse: ideal concentrator still ≤ mouth area × sky
  const k = DIFFUSER_T*T_MEMBRANE;
  return { keep: 1 - fF + (fF - fP)*open, kDir: kDir*k, kDif: kDif*k, fF, fM, C, thA, len, tpDir, tpDif, open, acc };
}
function dli(L, outside, naive=false){
  let s=0; const steps=96;
  for (let k=0;k<steps;k++){ const h=(k+0.5)/steps*24, sv=sunVector(h, params.lat, params.decl), mu=sv.y;
    const I = irradiance(mu, params.tau); if (I.glob<=0) continue;
    let par = I.glob*PAR_PER_W;
    if (!outside){ const el = Math.asin(Math.max(mu,0)), {w,bag}=interiorTransmission(L, el), tm = tunnelModel(L, el, naive);
      par = (tm.keep*(I.dir*w.direct.par + I.dif*w.diffuse.par)*bag + tm.kDir*I.dir + tm.kDif*I.dif)*PAR_PER_W; }
    s += par * (88775/steps); }
  return s/1e6;
}

export { dli, interiorTransmission, tunnelModel };
