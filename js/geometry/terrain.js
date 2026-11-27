// MARSOUPILAMI · geometry/terrain.js
// Regolith ground, rocks, lawn, ring path, pond, garden paths and bollard lights.
import * as THREE from 'three';
import { G } from './dome-shape.js';
import { scene } from '../render/scene.js';
import { interior } from '../render/materials.js';

// ---------------------------------------------------------------- ground
// regolith with vertex-colour noise (flattened under the dome; re-shaped when the footprint changes)
const groundGeo = new THREE.PlaneGeometry(1600, 1600, 200, 200); groundGeo.rotateX(-Math.PI/2);
const groundNoise = [];
{ const pos = groundGeo.attributes.position, col = [];
  for (let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i);
    const n = Math.sin(x*0.13)*Math.cos(z*0.11)+Math.sin(x*0.031+z*0.05)*1.5+Math.sin(z*0.21-x*0.07)*0.5;
    groundNoise.push(n); const k = 0.9 + 0.08*n/3; col.push(0.62*k, 0.33*k, 0.19*k); }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.97 }));
  m.receiveShadow = true; scene.add(m); }
function updateGround(){
  const pos = groundGeo.attributes.position;
  for (let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i), r=Math.hypot(x,z), n=groundNoise[i];
    pos.setY(i, r > G.R+6 ? n*0.25*THREE.MathUtils.smoothstep(r, G.R+6, G.R+60) + Math.sin(x*0.004)*Math.cos(z*0.005)*6*THREE.MathUtils.smoothstep(r,200,700) : -0.02); }
  pos.needsUpdate = true; groundGeo.computeVertexNormals();
}
const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color:0x5a3020, roughness:1, flatShading:true }), 400);
rocks.castShadow = rocks.receiveShadow = true; rocks.frustumCulled = false; scene.add(rocks);   // instances move with the footprint; a cached bounding sphere would go stale
function placeRocks(){
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(); let n=0, seed=7;
  const rnd = ()=> (seed = (seed*16807)%2147483647)/2147483647;
  while (n<400){ const a=rnd()*Math.PI*2, r=G.R+4+Math.pow(rnd(),0.6)*150, s=0.15+Math.pow(rnd(),3)*1.2;
    q.setFromEuler(new THREE.Euler(rnd()*3,rnd()*3,rnd()*3));
    M.compose(new THREE.Vector3(Math.cos(a)*r, s*0.2, Math.sin(a)*r), q, new THREE.Vector3(s, s*0.6, s*0.9));
    rocks.setMatrixAt(n++, M); }
  rocks.instanceMatrix.needsUpdate = true;
}
let lawn;
{ // garden lawn inside, gravel path, tiny pond
  lawn = new THREE.Mesh(new THREE.CircleGeometry(1, 128).rotateX(-Math.PI/2),
     interior(new THREE.MeshStandardMaterial({ color:0x5d7f45, roughness:0.95 })));
  lawn.position.y = 0.01; lawn.receiveShadow = true; scene.add(lawn);
  const path = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.6, 96).rotateX(-Math.PI/2),
     interior(new THREE.MeshStandardMaterial({ color:0xb7ab98, roughness:1 })));
  path.position.set(0, 0.02, -8); path.receiveShadow = true; scene.add(path);
  const pond = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48).rotateX(-Math.PI/2),
     interior(new THREE.MeshStandardMaterial({ color:0x24414a, roughness:0.08, metalness:0.2 })));
  pond.position.set(0, 0.03, -8); scene.add(pond);
}

// ---------------------------------------------------------------- garden path house -> tree with bollard lights
const lampLights = [];
const lampHeadMat = new THREE.MeshStandardMaterial({ color:0x222222, emissive:0xffb46b, emissiveIntensity:0, roughness:0.5 });
{
  const pathMat = interior(new THREE.MeshStandardMaterial({ color:0xb7ab98, roughness:1 }));
  const segs = [[-8.8,-7.5, -4.4,-8.0], [4.4,-8.0, 8.6,-9.0]];   // door -> ring path, ring path -> tree
  for (const [x1,z1,x2,z2] of segs){
    const len = Math.hypot(x2-x1, z2-z1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 1.0), pathMat);
    m.position.set((x1+x2)/2, 0.02, (z1+z2)/2); m.rotation.y = -Math.atan2(z2-z1, x2-x1);
    m.receiveShadow = true; scene.add(m);
  }
  // 6 low bollards (0.6 m), warm white ~2700 K, ~25 lm-class garden lights
  const spots = [[-7.6,-6.7], [-5.4,-7.1], [-2.6,-3.6], [2.6,-3.6], [5.6,-7.3], [7.8,-8.0]];
  const postMat = interior(new THREE.MeshStandardMaterial({ color:0x2b2b2b, roughness:0.6, metalness:0.4 }));
  const postGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.5, 10); postGeo.translate(0, 0.25, 0);
  const headGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.1, 12); headGeo.translate(0, 0.55, 0);
  const capGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.03, 12); capGeo.translate(0, 0.615, 0);
  for (const [x,z] of spots){
    for (const [g,mat] of [[postGeo,postMat],[headGeo,lampHeadMat],[capGeo,postMat]]){
      const m = new THREE.Mesh(g, mat); m.position.set(x,0,z); m.castShadow = true; scene.add(m); }
    const L = new THREE.PointLight(0xffb46b, 0, 7, 2);   // 2700 K ≈ (255,180,107)
    L.position.set(x, 0.5, z); scene.add(L); lampLights.push(L);
  }
}

export { groundGeo, lampHeadMat, lampLights, lawn, placeRocks, updateGround };
