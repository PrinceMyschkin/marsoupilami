// MARSOUPILAMI · geometry/membrane.js
// Membrane surface, seam / tether-attachment grid and perimeter footing ring.
import * as THREE from 'three';
import { G, baseHeight, roofHeight, tetherAt } from './dome-shape.js';
import { scene } from '../render/scene.js';
import { clippable } from '../render/cutaway.js';
import { sun } from '../render/lights.js';
import { lawn } from './terrain.js';

// ---------------------------------------------------------------- membrane
const membraneGroup = new THREE.Group(); scene.add(membraneGroup);
const membraneMat = clippable(new THREE.MeshPhysicalMaterial({ color:0xe8f0ff, transparent:true, opacity:0.2, roughness:0.08, metalness:0,
     side:THREE.DoubleSide, depthWrite:false, clearcoat:1, clearcoatRoughness:0.05, specularIntensity:1 }));
const membraneMesh = new THREE.Mesh(new THREE.BufferGeometry(), membraneMat); membraneMesh.renderOrder = 3; membraneGroup.add(membraneMesh);
const seamLines = new THREE.LineSegments(new THREE.BufferGeometry(), clippable(new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.35 })));
membraneGroup.add(seamLines);
const ring = new THREE.Mesh(new THREE.BufferGeometry(), clippable(new THREE.MeshStandardMaterial({ color:0x8a8580, roughness:0.9 })));
ring.position.y = 0.05; ring.castShadow = ring.receiveShadow = true; scene.add(ring);
function buildMembrane(){
  const NR = Math.ceil(G.R/0.24), NA = 320, verts = [], idx = [];
  for (let i=0;i<=NR;i++){ const r = G.R * i/NR;
    for (let j=0;j<NA;j++){ const a=j/NA*Math.PI*2, x=Math.cos(a)*r, z=Math.sin(a)*r; verts.push(x, roofHeight(x,z), z); } }
  for (let i=0;i<NR;i++) for (let j=0;j<NA;j++){ const a=i*NA+j, b=i*NA+(j+1)%NA, c=(i+1)*NA+j, d=(i+1)*NA+(j+1)%NA; idx.push(a,c,b, b,c,d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts,3));
  geo.setIndex(idx); geo.computeVertexNormals();
  membraneMesh.geometry.dispose(); membraneMesh.geometry = geo;
  // seam / tether-attachment grid, following the membrane (flat plateau + hangable edge arc)
  const seg = [];
  const omax = Math.ceil((G.R+2)/2)*2 - 1;
  for (let x=-omax; x<=omax; x+=2) for (let z=-omax; z<=omax; z+=2){
    if (!tetherAt(x,z)) continue;
    const y = baseHeight(Math.hypot(x,z));
    if (tetherAt(x+2,z)){ const y2=baseHeight(Math.hypot(x+2,z)); seg.push(x,y,z, x+2,y2,z); }
    if (tetherAt(x,z+2)){ const y2=baseHeight(Math.hypot(x,z+2)); seg.push(x,y,z, x,y2,z+2); }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg,3));
  seamLines.geometry.dispose(); seamLines.geometry = lg;
  // perimeter footing ring + lawn + shadow frustum follow the footprint
  ring.geometry.dispose(); ring.geometry = new THREE.TorusGeometry(G.R, 0.45, 10, Math.max(200, Math.round(G.R*6))).rotateX(Math.PI/2);
  lawn.scale.set(G.R - 0.3, 1, G.R - 0.3);
  const e = G.R + 6; Object.assign(sun.shadow.camera, { left:-e, right:e, top:e, bottom:-e, far: 300 + G.H*4 });
  sun.shadow.camera.updateProjectionMatrix();
}

export { buildMembrane, membraneGroup, membraneMat };
