// MARSOUPILAMI · geometry/tethers.js
// Anchor grid, tether bundles, footings, collars and footing uplights.
import * as THREE from 'three';
import { G, H_MAX, setHeight, tetherAt } from './dome-shape.js';
import { scene } from '../render/scene.js';
import { interior } from '../render/materials.js';

// ---------------------------------------------------------------- anchors & tether bundles
// 10 m footing grid, each bundle fanning to a 2 m attachment grid. Rebuilt with
// membrane height so tethers cover the whole pillow canopy (flat plateau + the
// part of the edge arc that is still high enough to hang pillows), not a fixed 36 m disc.
const anchors = [];
function buildAnchors(){
  anchors.length = 0;
  const amax = Math.ceil((G.R + 4)/10)*10 - 5;
  for (let ax=-amax; ax<=amax; ax+=10) for (let az=-amax; az<=amax; az+=10){
    const pts = [];
    for (let dx=-4; dx<=4; dx+=2) for (let dz=-4; dz<=4; dz+=2){
      const x=ax+dx, z=az+dz; if (tetherAt(x, z)) pts.push([x,z]);
    }
    if (pts.length) anchors.push({ x:ax, z:az, pts });
  }
}
function tetherCount(){ return anchors.reduce((s,a)=>s+a.pts.length, 0); }
{ const _H = G.H; setHeight(H_MAX); buildAnchors();
  var MAX_ANCHORS = Math.max(16, anchors.length), MAX_TETHERS = Math.max(256, tetherCount());
  setHeight(_H); anchors.length = 0; }
const FOOT_H = 0.6, FOOT_R = 0.9, COLLAR_R = 0.22;
const footMat = interior(new THREE.MeshStandardMaterial({ color:0x9a948c, roughness:0.85 }));
const footGeo = new THREE.CylinderGeometry(FOOT_R*0.85, FOOT_R, FOOT_H, 24); footGeo.translate(0, FOOT_H/2, 0);
const footings = new THREE.InstancedMesh(footGeo, footMat, MAX_ANCHORS);
const collarGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.25, 16); collarGeo.translate(0, FOOT_H+0.12, 0);
const collars = new THREE.InstancedMesh(collarGeo, interior(new THREE.MeshStandardMaterial({ color:0x444444, metalness:0.7, roughness:0.4 })), MAX_ANCHORS);
footings.castShadow = footings.receiveShadow = collars.castShadow = true;
footings.frustumCulled = collars.frustumCulled = false;   // see tethers below (stale bounding sphere)
scene.add(footings, collars);
// discreet uplights in the tether footings (one step dimmer than the path lights), warm white 2700 K
// Real SpotLights are capped: every footing still gets an emissive lens, but dozens of lights would stall the frame at 50 m.
const MAX_UPLIGHTS = 24;
const upLensMat = new THREE.MeshStandardMaterial({ color:0x1a1a1a, emissive:0xffb46b, emissiveIntensity:0, roughness:0.4 });
const upLensGeo = new THREE.RingGeometry(0.36, 0.5, 24).rotateX(-Math.PI/2); upLensGeo.translate(0, FOOT_H+0.005, 0);
const upLenses = new THREE.InstancedMesh(upLensGeo, upLensMat, MAX_ANCHORS); upLenses.frustumCulled = false; scene.add(upLenses);
const upLights = [];
for (let i=0;i<MAX_UPLIGHTS;i++){
  const sl = new THREE.SpotLight(0xffb46b, 0, 14, 0.62, 0.6, 2);
  sl.visible = false; scene.add(sl, sl.target); upLights.push(sl);
}
const tetherGeoHi = new THREE.CylinderGeometry(1, 1, 1, 6, 1); tetherGeoHi.translate(0, 0.5, 0);
const tetherGeoLo = new THREE.CylinderGeometry(1, 1, 1, 4, 1); tetherGeoLo.translate(0, 0.5, 0);
const tetherMat = interior(new THREE.MeshStandardMaterial({ color:0xf2efe6, roughness:0.6 }));
const tethers = new THREE.InstancedMesh(tetherGeoHi, tetherMat, MAX_TETHERS*2);
// Instance matrices / line vertices are rewritten on every rebuild; three r160 caches the bounding sphere once
// and never invalidates it, so culling would pop tethers out at other heights. These meshes span the dome anyway.
tethers.castShadow = true; tethers.frustumCulled = false; scene.add(tethers);
const tetherLineGeo = new THREE.BufferGeometry();
tetherLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TETHERS*2*6), 3));
const tetherLines = new THREE.LineSegments(tetherLineGeo, new THREE.LineBasicMaterial({ color:0xfff6e8, transparent:true, opacity:0.55 }));
tetherLines.frustumCulled = false; scene.add(tetherLines);
const TETHER_R = 0.0125;  // 2.5 cm Dyneema/steel rope (≈223 kN working load)

export { anchors, buildAnchors, COLLAR_R, collars, FOOT_H, footings, MAX_UPLIGHTS, TETHER_R, tetherCount, tetherGeoHi, tetherGeoLo, tetherLines, tetherMat, tethers, upLenses, upLensMat, upLights };
