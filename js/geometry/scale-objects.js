// MARSOUPILAMI · geometry/scale-objects.js
// Scale objects: house with tail sculpture, tree, human.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { renderer, scene } from '../render/scene.js';
import { interior } from '../render/materials.js';

// ---------------------------------------------------------------- scale objects: 1 house, 1 tree, 1 human
const objs = new THREE.Group(); scene.add(objs);
const sculptMat = interior(new THREE.MeshStandardMaterial({ color:0xdfe3e8, metalness:0.95, roughness:0.16 }));
function addMesh(geo, color, x, y, z, opts={}){
  const m = new THREE.Mesh(geo, interior(new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.85, flatShading: !!opts.flat })));
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; objs.add(m); return m;
}
{ // house 6 x 4.5 m, flat roof at 3.0 m (no wind or rain inside the dome) with a 0.35 m parapet
  const hx=-10, hz=-10;
  addMesh(new THREE.BoxGeometry(6, 3, 4.5), 0xe9e2d4, hx, 1.5, hz);
  addMesh(new THREE.BoxGeometry(6.2, 0.16, 4.7), 0xcfc8ba, hx, 3.08, hz);                 // roof slab
  for (const [w,d,x,z] of [[6.2,0.1,0,2.3],[6.2,0.1,0,-2.3],[0.1,4.7,3.05,0],[0.1,4.7,-3.05,0]])
    addMesh(new THREE.BoxGeometry(w, 0.35, d), 0xd9d2c4, hx+x, 3.33, hz+z);                // parapet
  addMesh(new THREE.BoxGeometry(1.0, 2.1, 0.06), 0x5b3a22, hx+1.2, 1.05, hz+2.27);
  for (const dx of [-1.6]) addMesh(new THREE.BoxGeometry(1.2, 1.0, 0.06), 0x2c3e50, hx+dx, 1.7, hz+2.27, { rough:0.2 });
  // rooftop sculpture: polished-steel spiral tail (homage to the Marsupilami), ~1.9 m incl. plinth
  const plinth = addMesh(new THREE.CylinderGeometry(0.32, 0.38, 0.3, 24), 0x8d8a85, hx, 3.31, hz);
  const pts = [];
  for (let i=0;i<=40;i++){ const u=i/40; pts.push(new THREE.Vector3(0.28*Math.sin(u*Math.PI*0.9), 1.3*u, 0.08*Math.sin(u*Math.PI))); }
  const top = pts[pts.length-1], cx = top.x - 0.45, cy = top.y;          // curl centre
  for (let i=1;i<=70;i++){ const th = i/70*Math.PI*2.4, r = 0.45*(1 - 0.72*th/(Math.PI*2.4));
    pts.push(new THREE.Vector3(cx + r*Math.cos(th), cy + r*Math.sin(th), 0.08 + 0.14*th/(Math.PI*2.4))); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const TS = 160, RS = 14, tube = new THREE.TubeGeometry(curve, TS, 1, RS, false), tp = tube.attributes.position, c = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i=0;i<=TS;i++){ curve.getPointAt(i/TS, c); const rad = 0.11*(1 - 0.82*i/TS) + 0.015;
    for (let j=0;j<=RS;j++){ const k=i*(RS+1)+j; q.fromBufferAttribute(tp,k).sub(c).multiplyScalar(rad).add(c); tp.setXYZ(k,q.x,q.y,q.z); } }
  tube.computeVertexNormals();
  sculptMat.envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const sculpt = new THREE.Mesh(tube, sculptMat); sculpt.position.set(hx, 3.46, hz); sculpt.rotation.y = Math.PI/4;
  sculpt.castShadow = true; objs.add(sculpt);
}
function makeTree(parent, x, y, z, s, mats){
  const parts = [
    [new THREE.CylinderGeometry(0.16*s, 0.26*s, 3.2*s, 8), mats[0], x, y+1.6*s, z],
    [new THREE.IcosahedronGeometry(2.0*s, 1), mats[1], x, y+4.4*s, z],
    [new THREE.IcosahedronGeometry(1.4*s, 1), mats[2], x+0.9*s, y+5.4*s, z-0.4*s],
    [new THREE.IcosahedronGeometry(1.2*s, 1), mats[3], x-0.9*s, y+5.1*s, z+0.6*s],
  ];
  for (const [geo, mat, px, py, pz] of parts){
    const m = new THREE.Mesh(geo, mat); m.position.set(px,py,pz); m.castShadow = true; m.receiveShadow = true; parent.add(m);
  }
}
{ // tree ~6.5 m
  const tx=10, tz=-10;
  makeTree(objs, tx, 0, tz, 1, [
    interior(new THREE.MeshStandardMaterial({ color:0x6b4a2f, roughness:0.85 })),
    interior(new THREE.MeshStandardMaterial({ color:0x3f6e2a, roughness:0.85, flatShading:true })),
    interior(new THREE.MeshStandardMaterial({ color:0x4c7d31, roughness:0.85, flatShading:true })),
    interior(new THREE.MeshStandardMaterial({ color:0x46772d, roughness:0.85, flatShading:true })),
  ]);
}
const human = new THREE.Group(); objs.add(human);
{ // human 1.75 m
  const mk = (g,c,x,y,z)=>{ const m=new THREE.Mesh(g, interior(new THREE.MeshStandardMaterial({color:c, roughness:0.8}))); m.position.set(x,y,z); m.castShadow=true; human.add(m); return m; };
  mk(new THREE.CylinderGeometry(0.075,0.065,0.85,8), 0x2b3a55, -0.1, 0.425, 0);
  mk(new THREE.CylinderGeometry(0.075,0.065,0.85,8), 0x2b3a55,  0.1, 0.425, 0);
  mk(new THREE.CapsuleGeometry(0.19, 0.42, 4, 10), 0xc0462e, 0, 1.17, 0);
  mk(new THREE.CylinderGeometry(0.045,0.04,0.62,6), 0xc0462e, -0.26, 1.15, 0).rotation.z = 0.12;
  mk(new THREE.CylinderGeometry(0.045,0.04,0.62,6), 0xc0462e,  0.26, 1.15, 0).rotation.z = -0.12;
  mk(new THREE.SphereGeometry(0.11, 14, 10), 0xe0b090, 0, 1.64, 0);
  human.position.set(0.6, 0, -5.0); human.rotation.y = 0.15;
}

export { human, makeTree, sculptMat };
