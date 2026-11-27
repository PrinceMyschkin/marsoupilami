// MARSOUPILAMI · geometry/platform.js
// Suspended platform (clear height > 25 m): deck, rail, wells, planter tree, hanging pool, lights.
import * as THREE from 'three';
import { M4, fmtH, setCyl } from '../util.js';
import { G } from './dome-shape.js';
import { A_WATER, N_WATER, T_BAG, bandT } from '../physics/optics.js';
import { params } from '../state.js';
import { scene } from '../render/scene.js';
import { interior } from '../render/materials.js';
import { clipList, clippable, inCut } from '../render/cutaway.js';
import { COLLAR_R, FOOT_H, TETHER_R, anchors, tetherGeoHi, tetherMat } from './tethers.js';
import { human, makeTree } from './scale-objects.js';
import { labelGroup, lblPlatform } from '../render/labels.js';

// ---------------------------------------------------------------- suspended platform (shown when clear height under the pillows > 25 m)
// Clear height = G.H − hookGap − layers·layerH, i.e. the model's "Clear height under water (plateau)"
// (= underside of the lowest pillow at the tethered plateau / dome centre; funnel drop, if any, is not included).
const PLATFORM_R = 6.0;          // 12 m circular deck over the central lawn (origin), clear of house/tree/pond
const PLATFORM_T = 0.30;         // deck thickness
const PLATFORM_RAIL = 1.10;
const PLATFORM_TREE_S = 0.78;    // ~5.3 m tree, slightly smaller than the ground tree
const PLATFORM_MIN_CLEAR = 25;   // clear interior height threshold
const PLATFORM_MIN_BELOW = 8;    // headroom under the deck
const PLATFORM_MIN_ABOVE = 7;    // headroom above the walking surface to the pillows (tree + clearance)
const PLATFORM_CX = 0, PLATFORM_CZ = 0;
// Rectangular hanging pool at 12 o'clock (toward −Z), between the centre
// planter and the rail. 4 m runs tangentially (along X), 2 m radially (along Z).
// Inset so the outer corners and the planter share ~1.22 m of clearance; a
// through-deck well sits off to each side, not in this sector.
const PLATFORM_POOL_W = 4.00;      // outer width (x, tangential), m
const PLATFORM_POOL_L = 2.00;      // outer length (z, radial), m
const PLATFORM_POOL_D = 1.10;      // water depth, m
const PLATFORM_POOL_WALL = 0.025;  // acrylic wall / bottom, m
const PLATFORM_POOL_FREE = 0.05;   // water surface below the deck top, m
const PLATFORM_POOL_X = 0;
const PLATFORM_POOL_Z = -3.265;
const PLATFORM_HANG = [          // 8 stays to nearby tether attachment nodes, just under the pillow stack
  [7,1],[7,-1],[-7,1],[-7,-1],[1,7],[1,-7],[-1,7],[-1,-7]
];
function plateauClearHeight(){
  const L = params.pillows ? params.layers : 0;
  return G.H - G.hookGap - L*G.layerH;
}
function platformDeckY(clear){
  return THREE.MathUtils.clamp(clear*0.35, PLATFORM_MIN_BELOW, Math.max(PLATFORM_MIN_BELOW, clear - PLATFORM_MIN_ABOVE - PLATFORM_T));
}
const platMat = (color, extra={}) => clippable(interior(new THREE.MeshStandardMaterial({ color, roughness: extra.rough ?? 0.85, metalness: extra.metal ?? 0, flatShading: !!extra.flat })));
const platMats = {
  deck:   platMat(0xcfc6b8, { rough:0.88 }),
  fascia: platMat(0xb4aa9a, { rough:0.8 }),
  planter:platMat(0x8a7d6e, { rough:0.8 }),
  soil:   platMat(0x4a3a28, { rough:1 }),
  rail:   platMat(0x3e3c3a, { rough:0.4, metal:0.65 }),
  hand:   platMat(0x6b5340, { rough:0.7 }),
  well:   platMat(0x6a6660, { rough:0.45, metal:0.5 }),
  lamp:   new THREE.MeshStandardMaterial({ color:0x222222, emissive:0xffb46b, emissiveIntensity:0, roughness:0.5 }),
};
{ // hanging glass pool: clear acrylic basin + water (same IOR / absorption idea as the pillows)
  const Tw = bandT(A_WATER.map(a => Math.exp(-a)));
  const att = new THREE.Color(Math.max(Tw.r*T_BAG, 1e-4), Math.max(Tw.g*T_BAG, 1e-4), Math.max(Tw.b*T_BAG, 1e-4));
  platMats.poolWater = clippable(interior(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.03, metalness: 0, transmission: 0.97,
    thickness: PLATFORM_POOL_D, ior: N_WATER, transparent: false, opacity: 1,
    attenuationColor: att, attenuationDistance: 1,
  })));
  platMats.poolGlass = clippable(interior(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.04, metalness: 0, transmission: 0.92,
    thickness: PLATFORM_POOL_WALL, ior: 1.49, transparent: false, opacity: 1,
  })));
}
const platTreeMats = [
  platMat(0x6b4a2f), platMat(0x3f6e2a, { flat:true }), platMat(0x4c7d31, { flat:true }), platMat(0x46772d, { flat:true }),
];
clipList.push(platMats.lamp);   // lamp heads should clip in section too (no interior tint needed)
const platformGroup = new THREE.Group(); scene.add(platformGroup);
const platCables = new THREE.InstancedMesh(tetherGeoHi, clippable(tetherMat.clone()), PLATFORM_HANG.length);
platCables.castShadow = true; platCables.frustumCulled = false; platformGroup.add(platCables);
const platPostGeo = new THREE.CylinderGeometry(0.032, 0.036, PLATFORM_RAIL, 8); platPostGeo.translate(0, PLATFORM_RAIL/2, 0);
const platPosts = new THREE.InstancedMesh(platPostGeo, platMats.rail, 32);
platPosts.castShadow = true; platPosts.frustumCulled = false; platformGroup.add(platPosts);
const platBalGeo = new THREE.CylinderGeometry(0.011, 0.011, PLATFORM_RAIL - 0.12, 5); platBalGeo.translate(0, (PLATFORM_RAIL - 0.12)/2 + 0.05, 0);
const platBals = new THREE.InstancedMesh(platBalGeo, platMats.rail, 128);
platBals.castShadow = true; platBals.frustumCulled = false; platformGroup.add(platBals);
const platWellGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 16); platWellGeo.translate(0, 0.06, 0);
const platWells = new THREE.InstancedMesh(platWellGeo, platMats.well, 24);
platWells.frustumCulled = false; platformGroup.add(platWells);
const platformLights = [];
const platformLampMeshes = [];
{ // 4 rail lights + 4 under-deck downlights (created once, shown with the platform)
  for (let i=0;i<4;i++){
    const a = i*Math.PI/2 + Math.PI/4, x = Math.cos(a)*(PLATFORM_R-0.22), z = Math.sin(a)*(PLATFORM_R-0.22);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), platMats.lamp);
    platformGroup.add(head); platformLampMeshes.push(head);
    const L = new THREE.PointLight(0xffb46b, 0, 8, 2); platformGroup.add(L); platformLights.push(L);
    L.userData.kind = 'rail'; L.userData.rx = x; L.userData.rz = z; head.userData.rx = x; head.userData.rz = z;
  }
  for (let i=0;i<4;i++){
    const a = i*Math.PI/2, x = Math.cos(a)*3.2, z = Math.sin(a)*3.2;
    const L = new THREE.PointLight(0xffb46b, 0, 10, 2); platformGroup.add(L); platformLights.push(L);
    L.userData.kind = 'down'; L.userData.rx = x; L.userData.rz = z;
  }
}
function clearPlatformDynamic(){
  for (const o of [...platformGroup.children]){
    if (o.isInstancedMesh || o.isLight || platformLampMeshes.includes(o)) continue;
    platformGroup.remove(o);
    // cloned scale-human shares geometry with the ground figure — do not dispose it
    if (o.name === 'platHuman') continue;
    o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  }
}

function poolOuterRect(gap=0){
  const hx = PLATFORM_POOL_W/2 + gap, hz = PLATFORM_POOL_L/2 + gap;
  return { x0: PLATFORM_POOL_X-hx, x1: PLATFORM_POOL_X+hx, z0: PLATFORM_POOL_Z-hz, z1: PLATFORM_POOL_Z+hz };
}
function pointHitsPool(x, z, margin=0){
  const r = poolOuterRect(margin);
  return x>=r.x0 && x<=r.x1 && z>=r.z0 && z<=r.z1;
}
function platformPoolWaterKg(){
  const tw = PLATFORM_POOL_WALL, w = PLATFORM_POOL_W-2*tw-0.008, l = PLATFORM_POOL_L-2*tw-0.008, h = PLATFORM_POOL_D-0.01;
  return w*l*h*1000;
}
function platformPoolBasinKg(){
  const tw=PLATFORM_POOL_WALL, Wo=PLATFORM_POOL_W, Lo=PLATFORM_POOL_L, Wi=Wo-2*tw, Li=Lo-2*tw;
  const innerH=PLATFORM_POOL_D+PLATFORM_POOL_FREE;
  const vol = Wo*Lo*tw + 2*tw*innerH*Lo + 2*tw*innerH*Wi;
  return vol*1180; // acrylic
}
// Closed water box. waves: subdivided top with 4–10 mm displacement (path-trace bake only).
function poolWaterBoxGeometry(w, d, h, waves){
  const nx = waves ? 24 : 1, nz = waves ? 24 : 1, y0 = -h/2, y1 = h/2;
  const wave = (x,z) => waves ? 0.008*(Math.sin(x*5.3+0.6)*Math.cos(z*4.1) + 0.45*Math.sin(x*8.8-z*6.4+1.2)) : 0;
  const pos = [], idx = [];
  const vert = (x,y,z) => { pos.push(x,y,z); return pos.length/3-1; };
  const top = [], bot = [];
  for (let k=0;k<=nz;k++){
    top[k]=[]; bot[k]=[];
    const z = -d/2 + d*k/nz;
    for (let i=0;i<=nx;i++){
      const x = -w/2 + w*i/nx;
      top[k][i] = vert(x, y1+wave(x,z), z);
      bot[k][i] = vert(x, y0, z);
    }
  }
  for (let k=0;k<nz;k++) for (let i=0;i<nx;i++){
    const a=top[k][i], b=top[k][i+1], c=top[k+1][i], e=top[k+1][i+1];
    idx.push(a,c,b, b,c,e);
    const a2=bot[k][i], b2=bot[k][i+1], c2=bot[k+1][i], e2=bot[k+1][i+1];
    idx.push(a2,b2,c2, b2,e2,c2);
  }
  // sides, CCW when viewed from outside
  for (let i=0;i<nx;i++){ // −Z
    const t0=top[0][i], t1=top[0][i+1], b0=bot[0][i], b1=bot[0][i+1];
    idx.push(b0,b1,t1, b0,t1,t0);
  }
  for (let i=0;i<nx;i++){ // +Z
    const k=nz, t0=top[k][i], t1=top[k][i+1], b0=bot[k][i], b1=bot[k][i+1];
    idx.push(b1,b0,t0, b1,t0,t1);
  }
  for (let k=0;k<nz;k++){ // −X
    const t0=top[k][0], t1=top[k+1][0], b0=bot[k][0], b1=bot[k+1][0];
    idx.push(b1,b0,t0, b1,t0,t1);
  }
  for (let k=0;k<nz;k++){ // +X
    const i=nx, t0=top[k][i], t1=top[k+1][i], b0=bot[k][i], b1=bot[k+1][i];
    idx.push(b0,b1,t1, b0,t1,t0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function addPlatformPool(deckY){
  const tw = PLATFORM_POOL_WALL, Wo = PLATFORM_POOL_W, Lo = PLATFORM_POOL_L;
  const Wi = Wo-2*tw, Li = Lo-2*tw, innerH = PLATFORM_POOL_D + PLATFORM_POOL_FREE;
  const cx = PLATFORM_CX+PLATFORM_POOL_X, cz = PLATFORM_CZ+PLATFORM_POOL_Z;
  const basin = new THREE.Group();
  basin.name = 'platPoolBasin';
  const addBox = (geo, x, y, z) => {
    const m = new THREE.Mesh(geo, platMats.poolGlass);
    m.position.set(x,y,z);
    m.castShadow = m.receiveShadow = true;
    basin.add(m);
  };
  // Five non-overlapping boxes: bottom plate + four walls sitting on it (no shared volume, no z-fight).
  addBox(new THREE.BoxGeometry(Wo, tw, Lo), cx, deckY - innerH - tw/2, cz);
  addBox(new THREE.BoxGeometry(tw, innerH, Lo), cx + (Wi/2 + tw/2), deckY - innerH/2, cz);
  addBox(new THREE.BoxGeometry(tw, innerH, Lo), cx - (Wi/2 + tw/2), deckY - innerH/2, cz);
  addBox(new THREE.BoxGeometry(Wi, innerH, tw), cx, deckY - innerH/2, cz + (Li/2 + tw/2));
  addBox(new THREE.BoxGeometry(Wi, innerH, tw), cx, deckY - innerH/2, cz - (Li/2 + tw/2));
  platformGroup.add(basin);
  const waterH = PLATFORM_POOL_D - 0.01, waterW = Wi - 0.008, waterL = Li - 0.008;
  const water = new THREE.Mesh(poolWaterBoxGeometry(waterW, waterL, waterH, false), platMats.poolWater);
  water.name = 'platPoolWater';
  water.userData.poolWaterW = waterW;
  water.userData.poolWaterL = waterL;
  water.userData.poolWaterH = waterH;
  water.position.set(cx, deckY - PLATFORM_POOL_FREE - waterH/2, cz);
  water.receiveShadow = true;
  platformGroup.add(water);
  platformGroup.userData.poolKg = platformPoolWaterKg();
  platformGroup.userData.poolBasinKg = platformPoolBasinKg();
}
function rebuildPlatform(waterBottom, cut){
  const clear = waterBottom;
  const show = params.platform && clear > PLATFORM_MIN_CLEAR;
  platformGroup.visible = show;
  platformGroup.userData = { clear, deckY: show ? platformDeckY(clear) : 0, show };
  platCables.count = platPosts.count = platBals.count = platWells.count = 0;
  if (!show){ lblPlatform.visible = false; return; }
  const deckY = platformGroup.userData.deckY;
  const L = params.pillows ? params.layers : 0;
  const nodeY = L>0 ? Math.max(waterBottom - 0.05, FOOT_H + 0.6) : G.H;  // same kink as the existing tethers
  clearPlatformDynamic();
  // wells: existing tethers that would pierce the deck at walking height (thin ropes get a kerb, not a pillow attachment)
  const holes = [];
  const y0 = FOOT_H + 0.24;
  for (const a of anchors) for (const [px,pz] of a.pts){
    const dir = new THREE.Vector2(px-a.x, pz-a.z); if (dir.lengthSq()>0) dir.normalize();
    const fx = a.x + dir.x*COLLAR_R, fz = a.z + dir.y*COLLAR_R;
    const t = (deckY - y0) / Math.max(1e-4, nodeY - y0);
    const x = fx + t*(px - fx), z = fz + t*(pz - fz);
    const r = Math.hypot(x - PLATFORM_CX, z - PLATFORM_CZ);
    if (r < PLATFORM_R - 0.28 && r > 1.35){
      if (!holes.some(([hx,hz]) => Math.hypot(hx-x, hz-z) < 0.3)) holes.push([x, z]);
    }
  }
  const shape = new THREE.Shape(); shape.absarc(0, 0, PLATFORM_R, 0, Math.PI*2, false);
  for (const [hx,hz] of holes){ const hole = new THREE.Path(); hole.absarc(hx, hz, 0.22, 0, Math.PI*2, true); shape.holes.push(hole); }
  // matching rectangular cutout for the hanging glass pool; tree, person and fence stay put
  { const r = poolOuterRect(0.003); // 3 mm gap so the slab does not z-fight the acrylic
    const hole = new THREE.Path();
    hole.moveTo(r.x0, r.z0); hole.lineTo(r.x1, r.z0); hole.lineTo(r.x1, r.z1); hole.lineTo(r.x0, r.z1); hole.closePath();
    shape.holes.push(hole);
  }
  const deckGeo = new THREE.ExtrudeGeometry(shape, { depth: PLATFORM_T, bevelEnabled:false, curveSegments: 48 });
  deckGeo.rotateX(Math.PI/2);   // shape (x,y) -> world (x,z); extrusion goes downward so the top sits at y=0
  const deck = new THREE.Mesh(deckGeo, platMats.deck);
  deck.position.set(PLATFORM_CX, deckY, PLATFORM_CZ); deck.castShadow = deck.receiveShadow = true; platformGroup.add(deck);
  const fascia = new THREE.Mesh(new THREE.CylinderGeometry(PLATFORM_R+0.03, PLATFORM_R+0.03, PLATFORM_T, 64, 1, true), platMats.fascia);
  fascia.position.set(PLATFORM_CX, deckY - PLATFORM_T/2, PLATFORM_CZ); fascia.castShadow = true; platformGroup.add(fascia);
  let nw = 0;
  for (const [hx,hz] of holes){
    if (nw >= 24) break;
    if (pointHitsPool(hx, hz, 0.25)) continue;
    M4.makeTranslation(PLATFORM_CX+hx, deckY, PLATFORM_CZ+hz); platWells.setMatrixAt(nw++, M4);
  }
  platWells.count = nw; platWells.instanceMatrix.needsUpdate = true;
  addPlatformPool(deckY);
  // planter + slightly smaller tree in the middle
  const plantH = 0.42, plantR = 1.05;
  const planter = new THREE.Mesh(new THREE.CylinderGeometry(plantR, plantR+0.05, plantH, 32), platMats.planter);
  planter.position.set(PLATFORM_CX, deckY + plantH/2, PLATFORM_CZ); planter.castShadow = planter.receiveShadow = true; platformGroup.add(planter);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(plantR-0.08, 32).rotateX(-Math.PI/2), platMats.soil);
  soil.position.set(PLATFORM_CX, deckY + plantH + 0.01, PLATFORM_CZ); platformGroup.add(soil);
  makeTree(platformGroup, PLATFORM_CX, deckY + plantH, PLATFORM_CZ, PLATFORM_TREE_S, platTreeMats);
  // railing / fence around the edge
  const railR = PLATFORM_R - 0.07, nPost = 24, nBal = 96;
  let np = 0, nb = 0;
  for (let i=0;i<nPost;i++){
    const a = i/nPost*Math.PI*2;
    M4.makeTranslation(PLATFORM_CX + Math.cos(a)*railR, deckY, PLATFORM_CZ + Math.sin(a)*railR);
    platPosts.setMatrixAt(np++, M4);
  }
  for (let i=0;i<nBal;i++){
    const a = (i+0.5)/nBal*Math.PI*2;
    M4.makeTranslation(PLATFORM_CX + Math.cos(a)*railR, deckY, PLATFORM_CZ + Math.sin(a)*railR);
    platBals.setMatrixAt(nb++, M4);
  }
  platPosts.count = np; platBals.count = nb;
  platPosts.instanceMatrix.needsUpdate = platBals.instanceMatrix.needsUpdate = true;
  const mkRail = (y, tube, mat) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(railR, tube, 8, 80), mat);
    m.rotation.x = Math.PI/2; m.position.set(PLATFORM_CX, y, PLATFORM_CZ); m.castShadow = true; platformGroup.add(m);
  };
  mkRail(deckY + PLATFORM_RAIL - 0.02, 0.030, platMats.hand);
  mkRail(deckY + PLATFORM_RAIL*0.52, 0.016, platMats.rail);
  mkRail(deckY + 0.08, 0.016, platMats.rail);
  // suspension cables: deck rim -> tether nodes just under the pillows (not attached to the water bags)
  let nc = 0;
  for (const [nx,nz] of PLATFORM_HANG){
    const a = Math.atan2(nz, nx);
    const a0 = new THREE.Vector3(PLATFORM_CX + Math.cos(a)*(PLATFORM_R-0.12), deckY - 0.04, PLATFORM_CZ + Math.sin(a)*(PLATFORM_R-0.12));
    const b  = new THREE.Vector3(nx, nodeY, nz);
    setCyl(platCables, nc++, a0, b, TETHER_R);
  }
  platCables.count = nc; platCables.instanceMatrix.needsUpdate = true;
  // person on the deck (visible side of the cut: z < CUT_Z) for scale next to the 1.1 m fence
  const platHuman = human.clone();
  platHuman.name = 'platHuman';
  platHuman.position.set(PLATFORM_CX + 4.15, deckY, PLATFORM_CZ - 3.15);
  platHuman.rotation.y = 2.4; platformGroup.add(platHuman);
  // its materials are not clippable (shared with the ground figure): hide it when the deck under it is cut away
  platHuman.visible = !cut || inCut(platHuman.position.x, platHuman.position.z);
  // lights + fixtures
  for (const head of platformLampMeshes) head.position.set(PLATFORM_CX + head.userData.rx, deckY + PLATFORM_RAIL + 0.04, PLATFORM_CZ + head.userData.rz);
  for (const L of platformLights){
    if (L.userData.kind === 'rail') L.position.set(PLATFORM_CX + L.userData.rx, deckY + PLATFORM_RAIL + 0.04, PLATFORM_CZ + L.userData.rz);
    else {
      let x = L.userData.rx, z = L.userData.rz;
      if (pointHitsPool(x, z, 0.35)){
        const r = poolOuterRect(0.35), cand = [[x,r.z0],[x,r.z1],[r.x0,z],[r.x1,z]];
        let best=null, bestScore=-1e9;
        for (const [px,pz] of cand){
          const pr = Math.hypot(px,pz);
          if (pr > PLATFORM_R-0.5 || pr < 1.35) continue;
          const score = Math.min(pr-1.05, (PLATFORM_R-0.07)-pr);
          if (score>bestScore){ bestScore=score; best=[px,pz]; }
        }
        if (best){ x=best[0]; z=best[1]; }
      }
      L.position.set(PLATFORM_CX + x, deckY - PLATFORM_T - 0.08, PLATFORM_CZ + z);
    }
    L.visible = !cut || inCut(L.position.x, L.position.z);
  }
  lblPlatform.position.set(PLATFORM_CX - 0.5, deckY + 2.0, 1.15);
  lblPlatform.element.textContent = `suspended platform 12 m Ø at ${fmtH(deckY)} m`;
  lblPlatform.visible = labelGroup.visible;
}

export { plateauClearHeight, PLATFORM_POOL_D, PLATFORM_POOL_L, PLATFORM_POOL_W, PLATFORM_POOL_WALL, PLATFORM_R, platformDeckY, platformGroup, platformLights, platMats, poolWaterBoxGeometry, rebuildPlatform };
