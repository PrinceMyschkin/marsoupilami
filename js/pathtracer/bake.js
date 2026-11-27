// MARSOUPILAMI · pathtracer/bake.js
// Path-trace scene bake: instanced meshes expanded to static geometry, cut slicing,
// physically based copies of the raster materials, light cloning.
import * as THREE from 'three';
import { GradientEquirectTexture } from 'three-gpu-pathtracer';
import { G, PH } from '../geometry/dome-shape.js';
import { A_WATER, N_WATER, T_BAG, T_MEMBRANE, bandT } from '../physics/optics.js';
import { params, state } from '../state.js';
import { scene } from '../render/scene.js';
import { CUT_Z, EIGHTH_HALF, isCut } from '../render/cutaway.js';
import { PT_SKY } from '../render/sky.js';
import { groundGeo } from '../geometry/terrain.js';
import { membraneMat } from '../geometry/membrane.js';
import { pillowFilter, pillowGeoLo, pillowMat, pillows } from '../geometry/pillows.js';
import { PLATFORM_POOL_D, PLATFORM_POOL_WALL, platMats, poolWaterBoxGeometry } from '../geometry/platform.js';
import { pt } from './pt-state.js';

function ptWaterAttColor(){
  // 1 m of pure water, same band-integrated T as the solver's bandT (Pope & Fry). The pillow bag films
  // are a surface factor (√T_BAG per interface, see ptMaterial), so the pool gets plain water.
  const T = bandT(A_WATER.map(a => Math.exp(-a)));
  return new THREE.Color(Math.max(T.r, 1e-4), Math.max(T.g, 1e-4), Math.max(T.b, 1e-4));
}
function ptMaterial(src){
  if (!src) return new THREE.MeshStandardMaterial({ color:0x888888, roughness:0.8 });
  const isPillow = src === pillowMat;
  const isMembrane = src === membraneMat;
  const isPoolWater = src === platMats.poolWater;
  const isPoolGlass = src === platMats.poolGlass;
  const wantGlass = pt.useTransmission && (isPillow || isMembrane || isPoolWater || isPoolGlass || src.isMeshPhysicalMaterial);
  const m = wantGlass ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
  // Raster interior() tints lighting via a shader uniform, not material.color, so the
  // copied albedo is already the untinted base. Do not pre-multiply Beer–Lambert here:
  // the tracer already sends rays through the water volumes.
  if (src.color) m.color.copy(src.color);
  m.roughness = src.roughness ?? 0.8;
  m.metalness = src.metalness ?? 0;
  if (src.emissive && m.emissive) m.emissive.copy(src.emissive);
  if (src.emissiveIntensity != null) m.emissiveIntensity = src.emissiveIntensity;
  m.side = src.side ?? THREE.FrontSide;
  m.vertexColors = !!src.vertexColors;
  if (src.map) m.map = src.map;
  if (src.alphaMap) m.alphaMap = src.alphaMap;   // perforated funnels: holes are alpha cut-outs
  m.alphaTest = src.alphaTest || 0;
  if (wantGlass){
    if (isPillow){
      // 0.0.23 multiplies path throughput by (transmission * color) at every interface.
      // The old cyan preview colour (0xb7e2ee) × transmission 0.92, raised to 16
      // interfaces (8 layers in and out), left only ~0.14 % of red — the stack went
      // black before volume absorption. Color must be white; absorption is only
      // Beer–Lambert: T = exp(ln(attenuationColor) * dist / attenuationDistance),
      // with dist the world-space path length through the closed pillow volume (m).
      // The two bag films (T_BAG per pillow) are a surface factor: √T_BAG at each of the 2 interfaces.
      m.color.setScalar(Math.sqrt(T_BAG));
      m.roughness = 0.02;
      m.metalness = 0;
      m.transmission = 1;
      m.thickness = PH;            // non-zero so the material is a volume, not a thin film
      m.ior = N_WATER;
      m.attenuationColor.copy(ptWaterAttColor());
      m.attenuationDistance = 1;   // metres; attColor is the transmittance of 1 m
      m.transparent = false;
      m.opacity = 1;
      m.emissive.set(0x000000);
      m.emissiveIntensity = 0;
    } else if (isMembrane){
      // Thin film: the mesh is a single shell, not a closed 2 cm solid. A non-zero
      // thickness (or finite attenuationDistance) would make the tracer treat the
      // whole interior as IOR 1.4 until a back-face hit. Color is white so the
      // membrane's T_MEMBRANE is the only surface attenuation.
      m.color.set(0xffffff);
      m.roughness = 0.08;
      m.metalness = 0;
      m.transmission = T_MEMBRANE;
      m.thickness = 0;
      m.ior = 1.4;
      m.attenuationColor.set(0xffffff);
      m.attenuationDistance = Infinity;
      m.side = THREE.DoubleSide;
      m.transparent = false;
      m.opacity = 1;
    } else if (isPoolWater){
      // Same volume water as the pillows: white, T=1, Beer–Lambert via attColor / 1 m.
      m.color.set(0xffffff);
      m.roughness = 0.02;
      m.metalness = 0;
      m.transmission = 1;
      m.thickness = PLATFORM_POOL_D;
      m.ior = N_WATER;
      m.attenuationColor.copy(ptWaterAttColor());
      m.attenuationDistance = 1;
      m.transparent = false;
      m.opacity = 1;
      m.emissive.set(0x000000);
      m.emissiveIntensity = 0;
    } else if (isPoolGlass){
      // Closed 2.5 cm acrylic cup (real inner and outer surfaces), clear volume.
      m.color.set(0xffffff);
      m.roughness = 0.02;
      m.metalness = 0;
      m.transmission = 1;
      m.thickness = PLATFORM_POOL_WALL;
      m.ior = 1.49;
      m.attenuationColor.set(0xffffff);
      m.attenuationDistance = Infinity;
      m.transparent = false;
      m.opacity = 1;
    } else {
      m.transmission = src.transmission ?? 0.8;
      m.thickness = src.thickness ?? 0.05;
      m.ior = src.ior ?? 1.5;
    }
  }
  return m;
}
function mergeInstancedMesh(im){
  const src = im.geometry;
  const srcPos = src.getAttribute('position');
  const srcNrm = src.getAttribute('normal');
  const srcUv = src.getAttribute('uv');
  const srcIdx = src.index;
  const n = im.count, vPer = srcPos.count, iPer = srcIdx ? srcIdx.count : vPer;
  if (n <= 0 || vPer <= 0) return null;
  const pos = new Float32Array(n * vPer * 3);
  const nrm = srcNrm ? new Float32Array(n * vPer * 3) : null;
  const uv = srcUv ? new Float32Array(n * vPer * 2) : null;
  const idx = new Uint32Array(n * iPer);
  const M = new THREE.Matrix4(), N = new THREE.Matrix3(), p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i=0;i<n;i++){
    im.getMatrixAt(i, M);
    if (nrm) N.getNormalMatrix(M);
    const vo = i*vPer, io = i*iPer;
    for (let v=0;v<vPer;v++){
      p.fromBufferAttribute(srcPos, v).applyMatrix4(M);
      const o = (vo+v)*3; pos[o]=p.x; pos[o+1]=p.y; pos[o+2]=p.z;
      if (nrm){ q.fromBufferAttribute(srcNrm, v).applyNormalMatrix(N); nrm[o]=q.x; nrm[o+1]=q.y; nrm[o+2]=q.z; }   // applyNormalMatrix normalizes (r160)
      if (uv){ const u = (vo+v)*2; uv[u] = srcUv.getX(v); uv[u+1] = srcUv.getY(v); }
    }
    if (srcIdx){ for (let k=0;k<iPer;k++) idx[io+k] = srcIdx.getX(k) + vo; }
    else { for (let k=0;k<iPer;k++) idx[io+k] = vo + k; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (nrm) g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
function filterGeometry(geo, keepTri, matrixWorld){
  const src = geo.index ? geo.toNonIndexed() : geo.clone();
  const pos = src.getAttribute('position');
  const nrm = src.getAttribute('normal');
  const col = src.getAttribute('color');
  const uvA = src.getAttribute('uv');
  const keep = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const mw = matrixWorld || new THREE.Matrix4();
  for (let i=0;i<pos.count;i+=3){
    a.fromBufferAttribute(pos,i).applyMatrix4(mw);
    b.fromBufferAttribute(pos,i+1).applyMatrix4(mw);
    c.fromBufferAttribute(pos,i+2).applyMatrix4(mw);
    if (keepTri((a.x+b.x+c.x)/3, (a.y+b.y+c.y)/3, (a.z+b.z+c.z)/3)) keep.push(i,i+1,i+2);
  }
  if (!keep.length){ src.dispose(); return null; }
  const n = keep.length;
  const out = new THREE.BufferGeometry();
  const p2 = new Float32Array(n*3);
  const n2 = nrm ? new Float32Array(n*3) : null;
  const c2 = col ? new Float32Array(n*col.itemSize) : null;
  const u2 = uvA ? new Float32Array(n*2) : null;
  for (let i=0;i<n;i++){
    const v = keep[i];
    p2[i*3]=pos.getX(v); p2[i*3+1]=pos.getY(v); p2[i*3+2]=pos.getZ(v);
    if (n2){ n2[i*3]=nrm.getX(v); n2[i*3+1]=nrm.getY(v); n2[i*3+2]=nrm.getZ(v); }
    if (c2){ for (let k=0;k<col.itemSize;k++) c2[i*col.itemSize+k] = col.getComponent(v,k); }
    if (u2){ u2[i*2]=uvA.getX(v); u2[i*2+1]=uvA.getY(v); }
  }
  out.setAttribute('position', new THREE.BufferAttribute(p2,3));
  if (n2) out.setAttribute('normal', new THREE.BufferAttribute(n2,3));
  if (c2) out.setAttribute('color', new THREE.BufferAttribute(c2, col.itemSize));
  if (u2) out.setAttribute('uv', new THREE.BufferAttribute(u2, 2));
  if (src !== geo) src.dispose();
  return out;
}
function ptKeepTri(x,y,z){
  // drop far desert (keeps the dome + a short apron) and honour the active cut
  if (Math.hypot(x,z) > G.R + 40) return false;
  if (!isCut()) return true;
  if (params.cutEighth){
    const a = Math.atan2(x, -z);
    return Math.abs(a) <= EIGHTH_HALF + 0.04 || Math.hypot(x,z) < 1.2;
  }
  return z <= CUT_Z + 0.05;
}
function countTris(geo){
  if (!geo) return 0;
  return geo.index ? (geo.index.count/3) : (geo.attributes.position.count/3);
}
function bakePathTraceScene(){
  const out = new THREE.Scene();
  const stats = { triangles:0, meshes:0, instancesExpanded:0, lights:0 };
  const matCache = new Map();
  const ptMatOf = (src) => {
    if (!matCache.has(src)) matCache.set(src, ptMaterial(src));
    return matCache.get(src);
  };
  const addMesh = (geo, mat, matrix) => {
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, mat);
    if (matrix) mesh.applyMatrix4(matrix);
    mesh.updateMatrixWorld(true);
    out.add(mesh);
    stats.meshes++;
    stats.triangles += countTris(geo);
  };
  const skipName = new Set();
  scene.traverse(obj => {
    if (!obj.visible) return;
    if (obj.isCSS2DObject || obj.isLine || obj.isLineSegments || obj.isSprite || obj.isLight) return;
    if (obj.isSkinnedMesh) return;
    const mat0 = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    if (mat0 && mat0.isShaderMaterial) return;              // procedural sky
    if (mat0 && mat0.blending === THREE.MultiplyBlending) return; // pillow spectral filter (raster trick)
    if (obj.isInstancedMesh){
      if (obj.count <= 0) return;
      const savedGeo = obj.geometry;
      if (obj === pillows || obj === pillowFilter) obj.geometry = pillowGeoLo;
      const g = mergeInstancedMesh(obj);
      obj.geometry = savedGeo;
      if (!g) return;
      const sliced = isCut() ? filterGeometry(g, ptKeepTri) : g;
      if (sliced !== g) g.dispose();
      addMesh(sliced, ptMatOf(obj.material));
      stats.instancesExpanded += obj.count;
      return;
    }
    if (!obj.isMesh || !obj.geometry) return;
    obj.updateMatrixWorld(true);
    const needsSlice = isCut() || (obj.geometry === groundGeo);
    let geo = obj.geometry;
    if (obj.name === 'platPoolWater'){
      const u = obj.userData;
      geo = poolWaterBoxGeometry(u.poolWaterW, u.poolWaterL, u.poolWaterH, true);
    }
    if (needsSlice){
      const sliced = filterGeometry(geo, ptKeepTri, obj.matrixWorld);
      if (geo !== obj.geometry) geo.dispose();   // temporary wave geometry
      if (!sliced) return;
      addMesh(sliced, ptMatOf(obj.material)); // already in world space
      return;
    }
    addMesh(geo.clone(), ptMatOf(obj.material), obj.matrixWorld);
  });
  // lights: sun + LED canopy (area) + any visible spots. HemisphereLight is not supported; env map fills the sky.
  const lightObjs = ptAddLights(out);
  stats.lights = lightObjs.filter(o => o.isLight).length;
  if (!pt.env){
    pt.env = new GradientEquirectTexture(256);
    pt.env.topColor.setRGB(...PT_SKY.top);
    pt.env.bottomColor.setRGB(...PT_SKY.bottom);
    pt.env.exponent = PT_SKY.exponent;
    pt.env.update();
  }
  out.background = pt.env;
  out.environment = pt.env;
  out.environmentIntensity = out.backgroundIntensity = state.ptEnvK;   // read by the tracer (r163 fields)
  out.backgroundBlurriness = 0.15;
  return { scene: out, stats, lightObjs, matPairs: [...matCache.entries()] };
}
// Active raster lights (visible, non-zero), cloned into the path-trace scene in world space.
function ptActiveLights(){
  const list = [];
  scene.traverseVisible(obj => {
    if (!obj.isLight) return;
    if (obj.isHemisphereLight || obj.isAmbientLight) return;
    if (!obj.intensity || obj.intensity <= 0) return;
    list.push(obj);
  });
  return list;
}
function ptAddLights(out){
  const added = [];
  for (const obj of ptActiveLights()){
    const L = obj.clone();
    obj.updateMatrixWorld(true);
    L.matrix.copy(obj.matrixWorld);
    L.matrix.decompose(L.position, L.quaternion, L.scale);
    if (obj.target){
      obj.target.updateMatrixWorld(true);
      L.target.position.setFromMatrixPosition(obj.target.matrixWorld);
      out.add(L.target); added.push(L.target);
    }
    out.add(L); added.push(L);
  }
  return added;
}
function disposePtScene(s){
  if (!s) return;
  const mats = new Set();
  s.traverse(o => {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m));
  });
  mats.forEach(m => m.dispose());   // per-bake MeshStandard/Physical copies (textures are shared, not disposed)
}

export { bakePathTraceScene, disposePtScene, ptActiveLights, ptAddLights };
