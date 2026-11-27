// MARSOUPILAMI · geometry/tunnels.js
// Optional light tunnels: pipes, throats, diffusers, perforated funnels and their layout.
import * as THREE from 'three';
import { G, baseHeight } from './dome-shape.js';
import { FUNNEL_SLOPE, PIPE_D, THROAT_H } from '../physics/optics.js';
import { params } from '../state.js';
import { scene } from '../render/scene.js';
import { clippable } from '../render/cutaway.js';
import { MAX_CELLS, cells } from './pillows.js';
import { sculptMat } from './scale-objects.js';

// ---------------------------------------------------------------- light tunnels (instanced pipes/throats/diffusers + one funnel mesh)
// No interior() tint on tunnels and funnels: the funnels sit above the water stack (only the outer
// membrane above them) and the pipes run through the stack carrying unfiltered sunlight.
const tunnelMat = clippable(new THREE.MeshStandardMaterial({ color:0xdde1e6, metalness:0.92, roughness:0.2, side:THREE.DoubleSide }));
tunnelMat.envMap = sculptMat.envMap;
const pipeGeo = new THREE.CylinderGeometry(PIPE_D/2, PIPE_D/2, 1, 28, 1, true); pipeGeo.translate(0, 0.5, 0);
const pipes = new THREE.InstancedMesh(pipeGeo, tunnelMat, MAX_CELLS); pipes.frustumCulled = false; pipes.castShadow = true; scene.add(pipes);
const perfTex = (() => { // perforated sheet: hole pattern as alpha map (open fraction set at runtime via hole radius)
  const c = document.createElement('canvas'); c.width = c.height = 64; return new THREE.CanvasTexture(c); })();
perfTex.wrapS = perfTex.wrapT = THREE.RepeatWrapping; perfTex.repeat.set(2, 2);
function drawPerf(open){ const c = perfTex.image, g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,64,64);
  const r = Math.sqrt(Math.max(open,0.001)*64*64/(2*Math.PI)); g.fillStyle = '#000';
  for (const [x,y] of [[16,16],[48,48]]){ g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill(); }
  perfTex.needsUpdate = true; }
drawPerf(0.2);
// perforated, see-through polished aluminium (holes = alpha cut-outs, ≈ perforation open %)
const funnelMat = clippable(new THREE.MeshStandardMaterial({ color:0xe8ebee, metalness:0.85, roughness:0.28, alphaMap:perfTex,
  alphaTest:0.5, side:THREE.DoubleSide }));
funnelMat.envMap = sculptMat.envMap;
const funnel = new THREE.Mesh(new THREE.BufferGeometry(), funnelMat); funnel.frustumCulled = false; scene.add(funnel);
function throatGeometry(half, r, h){ // square (2·half) at the top -> circle (r) at the bottom
  const N = 48, pos = [], uv = [], idx = [];
  for (let i=0;i<=N;i++){ const a=i/N*2*Math.PI, c=Math.cos(a), sn=Math.sin(a), k=half/Math.max(Math.abs(c),Math.abs(sn));
    pos.push(c*k, h, sn*k, c*r, 0, sn*r); uv.push(i/N*6, 0.3, i/N*6, 0); }
  for (let i=0;i<N;i++){ const a=2*i; idx.push(a,a+1,a+2, a+1,a+3,a+2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
const throats = new THREE.InstancedMesh(throatGeometry(G.cell/2, PIPE_D/2, THROAT_H), funnelMat, MAX_CELLS); throats.frustumCulled = false; scene.add(throats);
const diffMat = new THREE.MeshStandardMaterial({ color:0xf4f4f0, emissive:0xfff6ea, emissiveIntensity:0, transparent:true, opacity:0.92,
  roughness:0.9, side:THREE.DoubleSide });
const diffGeo = new THREE.CircleGeometry(PIPE_D/2, 32).rotateX(Math.PI/2);
const diffusers = new THREE.InstancedMesh(diffGeo, diffMat, MAX_CELLS); diffusers.frustumCulled = false; scene.add(diffusers);
// tunnel lattice: one pipe every S m (S/2 odd so funnel rims fall on the 2 m cell boundaries); square funnel of width w ≤ S
function tunnelLayout(L){
  const T = { list: [], tunOf: new Map(), drop: new Map(), S: 0, w: 0, m: G.cell/2, dep: 0, funnelCells: 0 };
  if (!params.tunnels || L <= 0) return T;
  const S = 2*(2*Math.round((params.tunnelSpacing/2 - 1)/2) + 1);
  const w = Math.min(S, Math.max(2, 2*(2*Math.round((S*Math.sqrt(params.funnelCover/100)/2 - 1)/2) + 1)));
  Object.assign(T, { S, w, dep: Math.tan(FUNNEL_SLOPE)*Math.max(0, w/2 - T.m) });
  T.dropAt = d => d <= T.m ? T.dep : T.dep*Math.max(0, 1 - (d - T.m)/Math.max(1e-6, w/2 - T.m));
  const key = (x,z) => x+','+z, byKey = new Map(); cells.forEach((c,i) => byKey.set(key(c.x,c.z), i));
  const md = v => ((v % S) + S) % S;
  cells.forEach((c,i) => { if (md(c.x)===0 && md(c.z)===0){ const t = { x:c.x, z:c.z, idx:i }; T.list.push(t); T.tunOf.set(i, t); } });
  const tunAt = new Map(T.list.map(t => [key(t.x,t.z), t]));
  cells.forEach((c,i) => { const tx = Math.round(c.x/S)*S, tz = Math.round(c.z/S)*S, t = tunAt.get(key(tx,tz)); if (!t) return;
    const ch = Math.max(Math.abs(c.x-tx), Math.abs(c.z-tz)); if (ch + 1 > w/2) return;
    T.funnelCells++; if (ch > 0) T.drop.set(i, T.dropAt(ch - 1)); });
  T.byKey = byKey; T.key = key; return T;
}
function buildFunnelMesh(T){
  const pos = [], uv = [], idx = [];
  for (const t of T.list){
    const h = T.w/2, N = T.w, base = pos.length/3;
    for (let j=0;j<=N;j++) for (let i=0;i<=N;i++){ const dx=-h+i, dz=-h+j, X=t.x+dx, Z=t.z+dz;
      pos.push(X, baseHeight(Math.hypot(X,Z)) - 0.08 - T.dropAt(Math.max(Math.abs(dx),Math.abs(dz))), Z); uv.push(X, Z); }
    for (let j=0;j<N;j++) for (let i=0;i<N;i++){ const qx=-h+i+0.5, qz=-h+j+0.5;
      if (Math.max(Math.abs(qx),Math.abs(qz)) < T.m) continue;   // mouth hole -> throat
      const X=t.x+qx, Z=t.z+qz; if (!T.byKey.has(T.key(2*Math.round(X/2), 2*Math.round(Z/2)))) continue;   // only over existing pillow cells
      const a = base + j*(N+1) + i; idx.push(a, a+N+1, a+1, a+1, a+N+1, a+N+2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
  funnel.geometry.dispose(); funnel.geometry = g; funnel.visible = T.list.length > 0;
}

export { buildFunnelMesh, diffMat, diffusers, drawPerf, pipes, throats, tunnelLayout };
