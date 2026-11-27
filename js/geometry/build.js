// MARSOUPILAMI · geometry/build.js
// rebuild(): places pillows, tunnels, tethers, footings and uplights for the current layers / cut,
// computes the derived stats, rebuilds the platform and updates the light.
import * as THREE from 'three';
import { M4, Q, setCyl } from '../util.js';
import { G, PH, PW, baseHeight } from './dome-shape.js';
import { PILLOW, PIPE_D, THROAT_H } from '../physics/optics.js';
import { params, state } from '../state.js';
import { CUT_Z, clipList, currentClipPlanes, inCut, inEighth, isCut } from '../render/cutaway.js';
import { membraneGroup } from './membrane.js';
import { COLLAR_R, FOOT_H, MAX_UPLIGHTS, TETHER_R, anchors, collars, footings, tetherCount, tetherGeoHi, tetherGeoLo, tetherLines, tethers, upLenses, upLights } from './tethers.js';
import { cells, pillowFilter, pillowGeoHi, pillowGeoLo, pillows, straps } from './pillows.js';
import { buildFunnelMesh, diffusers, pipes, throats, tunnelLayout } from './tunnels.js';
import { labelGroup, lblWater } from '../render/labels.js';
import { rebuildPlatform } from './platform.js';
import { updateLight } from '../render/lighting.js';

// ============================================================================
//  BUILD dynamic parts
// ============================================================================
let _vol = { H: -1, v: 0 };
function domeVolume(){ // ∫ 2πr·h(r) dr (bulges ignored)
  if (_vol.H === G.H) return _vol.v;
  let v = 0; const N = 2000, dr = G.R/N;
  for (let i=0;i<N;i++){ const r=(i+0.5)*dr; v += 2*Math.PI*r*baseHeight(r)*dr; }
  _vol = { H: G.H, v }; return v;
}
function rebuild(){
  const L = params.pillows ? params.layers : 0;
  const cut = isCut();
  // pillows
  let n = 0, nStrap = 0, pillowCount = 0, water = 0, nT = 0, pipeLenSum = 0;
  const TL = tunnelLayout(L);
  for (const [idx, c] of cells.entries()){
    const top = c.top - (TL.drop.get(idx) || 0);   // pillows under a funnel hang lower by the local funnel depth
    const nl = Math.min(L, Math.floor((top - 0.3)/G.layerH));
    if (TL.tunOf.has(idx)){   // light tunnel replaces this pillow column
      const mouthY = baseHeight(Math.hypot(c.x, c.z)) - 0.08 - TL.dep, pipeTop = mouthY - THROAT_H;
      const nlN = Math.min(L, Math.floor((c.top - TL.dep - 0.3)/G.layerH));
      const bottom = Math.max(0.3, Math.min(pipeTop - 0.3, c.top - TL.dep - Math.max(nlN,1)*G.layerH - 0.05));
      pipeLenSum += mouthY - bottom;
      if (!cut || inCut(c.x, c.z)){
        M4.compose(new THREE.Vector3(c.x, bottom, c.z), Q.identity(), new THREE.Vector3(1, pipeTop - bottom, 1)); pipes.setMatrixAt(nT, M4);
        M4.makeTranslation(c.x, pipeTop, c.z); throats.setMatrixAt(nT, M4);
        M4.makeTranslation(c.x, bottom - 0.005, c.z); diffusers.setMatrixAt(nT, M4); nT++;
      }
      continue;
    }
    pillowCount += Math.max(0,nl); water += Math.max(0,nl) * PILLOW.V;   // m³ = t
    if (cut && !inCut(c.x, c.z)) continue;
    if (nl > 0){
      setCyl(straps, nStrap++, new THREE.Vector3(c.x, top - 0.02, c.z), new THREE.Vector3(c.x, c.apex, c.z), 1);
      for (let l=0; l<nl; l++){
        M4.compose(new THREE.Vector3(c.x, top - (l+0.5)*G.layerH, c.z), Q.identity(), new THREE.Vector3(PW, PH, PW));
        pillows.setMatrixAt(n++, M4);
      }
    }
  }
  pillows.count = n; pillowFilter.count = n; straps.count = nStrap;
  pipes.count = throats.count = diffusers.count = nT;
  pipes.instanceMatrix.needsUpdate = throats.instanceMatrix.needsUpdate = diffusers.instanceMatrix.needsUpdate = true;
  buildFunnelMesh(TL);
  pillows.geometry = pillowFilter.geometry = n > 30000 ? pillowGeoLo : pillowGeoHi;
  pillows.instanceMatrix.needsUpdate = true; straps.instanceMatrix.needsUpdate = true;
  // tethers: attachment -> vertical through the water layer (between pillows) -> straight to collar on footing
  // Attachment Y follows the local membrane (G.H on the plateau, lower on the edge arc).
  let t = 0, nf = 0; const lp = tetherLines.geometry.attributes.position.array; let li = 0;
  const waterBottom = G.H - G.hookGap - L*G.layerH;
  const nTeth = tetherCount();
  tethers.geometry = nTeth > 2000 ? tetherGeoLo : tetherGeoHi;
  tethers.castShadow = nTeth <= 800;
  for (const sl of upLights) sl.visible = false;
  const lit = anchors.map((a,i)=>({a,r:Math.hypot(a.x,a.z)})).sort((p,q)=>p.r-q.r);
  let uLit = 0;
  for (const a of anchors){
    // In a cut, keep a tether when its attachment point is on the kept side (same rule as the pillow
    // cells it sits between); a footing is shown when it is on the kept side or carries a kept tether.
    const pts = cut ? a.pts.filter(([x,z]) => params.cutEighth ? inEighth(x, z) : z < CUT_Z) : a.pts;   // half cut: the z = 1 row lies on the section plane and belongs to the far bundles
    if (cut && !inCut(a.x, a.z) && !(params.tethers && pts.length)) continue;
    M4.makeTranslation(a.x, 0, a.z); footings.setMatrixAt(nf, M4); collars.setMatrixAt(nf, M4); upLenses.setMatrixAt(nf, M4); nf++;
    if (!params.tethers) continue;
    for (const [x,z] of pts){
      const attY = baseHeight(Math.hypot(x,z));
      const localTop = attY - G.hookGap;
      const nlLoc = Math.min(L, Math.max(0, Math.floor((localTop - 0.3)/G.layerH)));
      const nodeY = nlLoc>0 ? Math.max(localTop - nlLoc*G.layerH - 0.05, FOOT_H + 0.6) : attY;
      const top = new THREE.Vector3(x, attY, z);
      const node = new THREE.Vector3(x, nodeY, z);
      const dir = new THREE.Vector2(x-a.x, z-a.z); if (dir.lengthSq()>0) dir.normalize();
      const foot = new THREE.Vector3(a.x + dir.x*COLLAR_R, FOOT_H+0.24, a.z + dir.y*COLLAR_R);
      setCyl(tethers, t++, node, top, TETHER_R);
      setCyl(tethers, t++, foot, node, TETHER_R);
      for (const p of [node, top, foot, node]) { lp[li++]=p.x; lp[li++]=p.y; lp[li++]=p.z; }
    }
  }
  for (const {a} of lit){
    if (uLit >= MAX_UPLIGHTS) break;
    if (cut && !inCut(a.x, a.z)) continue;
    const sl = upLights[uLit++];
    sl.position.set(a.x, FOOT_H+0.05, a.z); sl.target.position.set(a.x, Math.max(10, G.H), a.z);
    sl.target.updateMatrixWorld(); sl.visible = true;
  }
  tethers.count = t; footings.count = nf; collars.count = nf; upLenses.count = nf; upLenses.instanceMatrix.needsUpdate = true;
  tethers.instanceMatrix.needsUpdate = footings.instanceMatrix.needsUpdate = collars.instanceMatrix.needsUpdate = true;
  tetherLines.geometry.setDrawRange(0, li/3); tetherLines.geometry.attributes.position.needsUpdate = true;
  tetherLines.visible = params.tethers;
  for (const m of clipList) m.clippingPlanes = currentClipPlanes(), m.needsUpdate = true;
  membraneGroup.visible = params.membrane;
  labelGroup.visible = params.labels && cut;
  labelGroup.children.forEach(o => { if (o.isCSS2DObject) o.visible = labelGroup.visible; });
  lblWater.position.set(-8, Math.max(0.3, waterBottom) + (G.H - G.hookGap - Math.max(0.3, waterBottom))/2, 1.3);
  lblWater.element.textContent = L>0 ? `water pillows: ${L} layer${L>1?'s':''} × 1 m` : 'no water pillows';
  lblWater.visible = L>0 && labelGroup.visible;
  const nTun = TL.list.length, Aroof = cells.length*G.cell*G.cell;
  const canopyR = cells.reduce((m,c)=>Math.max(m, Math.hypot(c.x,c.z)+G.cell/2), 0);
  state.stats = { L, tunnels: nTun, S: TL.S, w: TL.w, dep: TL.dep, fF: TL.funnelCells*G.cell*G.cell/Aroof, fP: nTun*G.cell*G.cell/Aroof,
    fM: nTun*Math.PI*(PIPE_D/2)**2/Aroof, pipeLen: nTun ? pipeLenSum/nTun : 0, pillowCount, water, waterBottom, maxFit: Math.floor((G.H - G.hookGap - 0.3)/G.layerH), volume: domeVolume(),
    nAnchors: anchors.length, nTethers: nTeth, canopyA: Aroof, canopyR };
  rebuildPlatform(waterBottom, cut);
  if (typeof state.ptOnRebuild === 'function') state.ptOnRebuild();
  updateLight();
}

export { rebuild };
