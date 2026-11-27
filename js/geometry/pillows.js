// MARSOUPILAMI · geometry/pillows.js
// Water pillow cells, cushion geometry, instanced pillows, spectral see-through filter, straps.
import * as THREE from 'three';
import { G, H0, H_MAX, baseHeight, roofHeight, setHeight } from './dome-shape.js';
import { A_WATER, PILLOW, T_BAG, bandT } from '../physics/optics.js';
import { scene } from '../render/scene.js';

// ---------------------------------------------------------------- water pillows
const cells = [];
function computeCells(arr){
  arr.length = 0; const n = Math.ceil(G.R/2)*2;
  for (let cx=-n; cx<=n; cx+=2) for (let cz=-n; cz<=n; cz+=2){
    let top = Infinity;
    for (const [ox,oz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) top = Math.min(top, baseHeight(Math.hypot(cx+ox, cz+oz)));
    top -= G.hookGap;
    if (top >= 1.3) arr.push({ x:cx, z:cz, top, apex: roofHeight(cx, cz) });
  }
  return arr;
}
setHeight(H_MAX); const MAX_CELLS = computeCells([]).length; setHeight(H0);
function pillowGeometry(ws=16, hs=10){  // cushion: sphere pushed towards a rounded box
  const g = new THREE.SphereGeometry(0.5, ws, hs), p = g.attributes.position, v = new THREE.Vector3();
  for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i).multiplyScalar(2);
    const f = (c,e)=>Math.sign(c)*Math.pow(Math.abs(c), e);
    p.setXYZ(i, f(v.x,0.28)*0.5, f(v.y,0.55)*0.5, f(v.z,0.28)*0.5); }
  g.computeVertexNormals(); return g;
}
const MAXL = 23;   // 23 m ≈ full pressure balance; stacks taller than the dome are clamped at the ground
const pillowMat = new THREE.MeshStandardMaterial({ color:0x9ad8e8, transparent:true, opacity:0.3, roughness:0.12, metalness:0.0,
  emissive:0x000000, depthWrite:false });
const pillowGeoHi = pillowGeometry(16, 10), pillowGeoLo = pillowGeometry(8, 6);   // low-poly LOD for very large pillow counts
const pillows = new THREE.InstancedMesh(pillowGeoHi, pillowMat, MAX_CELLS*MAXL);
pillows.renderOrder = 2; pillows.frustumCulled = false; scene.add(pillows);
// physically-based see-through: every pillow multiplies what is behind it by the spectral (Beer–Lambert)
// transmittance of 1 m of water + bag film -> looking through n pillows gives T^n, like the real stack
const pillowFilterMat = new THREE.MeshBasicMaterial({ color:0xffffff, blending:THREE.MultiplyBlending, transparent:true,
  depthWrite:false, toneMapped:false, side:THREE.FrontSide, premultipliedAlpha:false });
const pillowFilter = new THREE.InstancedMesh(pillows.geometry, pillowFilterMat, MAX_CELLS*MAXL);
pillowFilter.instanceMatrix = pillows.instanceMatrix; pillowFilter.renderOrder = 1; pillowFilter.frustumCulled = false;
scene.add(pillowFilter);
// per front-face hit: one pillow at its mean vertical chord (water volume / covered area) + its two film walls
{ const t1 = bandT(A_WATER.map(a=>Math.exp(-a*PILLOW.meanChord))); pillowFilterMat.color.setRGB(t1.r*T_BAG, t1.g*T_BAG, t1.b*T_BAG); }
const strapGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 5); strapGeo.translate(0, 0.5, 0);
const straps = new THREE.InstancedMesh(strapGeo, new THREE.MeshStandardMaterial({ color:0x9a9a9a, metalness:0.5, roughness:0.4 }), MAX_CELLS);
straps.frustumCulled = false; scene.add(straps);
// PW, PH (pillow outer dims) are defined with the geometry parameters in geometry/dome-shape.js.

export { cells, computeCells, MAX_CELLS, MAXL, pillowFilter, pillowGeoHi, pillowGeoLo, pillowMat, pillows, straps };
