// MARSOUPILAMI · pathtracer/pathtracer.js
// Path tracer lifecycle (start / stop / re-bake / light sync), cooperative GPU scheduling and its GUI folder.
import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { params, qs, state } from '../state.js';
import { camera, controls, renderer } from '../render/scene.js';
import { gui } from '../ui/gui.js';
import { pt, ptStatsEl } from './pt-state.js';
import { bakePathTraceScene, disposePtScene, ptActiveLights, ptAddLights } from './bake.js';

function ptCamKey(){
  const p = camera.position, t = controls.target;
  return [p.x,p.y,p.z,t.x,t.y,t.z,camera.fov,camera.aspect].map(v=>v.toFixed(4)).join(',');
}
function ptLightSig(){
  const f = v => (+v).toPrecision(5);
  const parts = ptActiveLights().map(o => {
    o.updateMatrixWorld(true);
    const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    const t = o.target ? (o.target.updateMatrixWorld(true), new THREE.Vector3().setFromMatrixPosition(o.target.matrixWorld)) : null;
    return [o.type, o.uuid, f(o.intensity), o.color.getHexString(), f(p.x), f(p.y), f(p.z),
      t ? [f(t.x), f(t.y), f(t.z)].join(',') : '', o.width ?? '', o.height ?? ''].join(':');
  });
  const em = (pt.matPairs || []).map(([s]) => s.emissiveIntensity ?? '').join(',');
  return parts.join('|') + '#' + f(state.ptEnvK) + '#' + em;
}
// Re-sync lights, sky intensity and emissive lamp materials after updateLight() (time, τ, LEDs, lamps).
function ptSyncLighting(){
  if (!pt.enabled || pt.building || !pt.scene || !pt.pathTracer) return;
  const sig = ptLightSig();
  if (sig === pt.lightSig) return;
  pt.lightSig = sig;
  for (const o of pt.lightObjs) if (o.parent) o.parent.remove(o);
  pt.lightObjs = ptAddLights(pt.scene);
  pt.stats.lights = pt.lightObjs.filter(o => o.isLight).length;
  pt.scene.environmentIntensity = pt.scene.backgroundIntensity = state.ptEnvK;
  let matChanged = false;
  for (const [src, dst] of pt.matPairs){
    if (dst.transmission > 0 || src.emissiveIntensity == null || !dst.emissive) continue;
    if (dst.emissiveIntensity !== src.emissiveIntensity){ dst.emissiveIntensity = src.emissiveIntensity; matChanged = true; }
  }
  pt.pathTracer.updateLights();
  pt.pathTracer.updateEnvironment();
  if (matChanged) pt.pathTracer.updateMaterials();
  pt.pathTracer.reset();
}
function setPtStats(text){
  if (!ptStatsEl) return;
  ptStatsEl.style.display = pt.enabled || pt.building ? 'block' : 'none';
  if (text) ptStatsEl.textContent = text;
}
function startPathTrace(){
  if (pt.building) return;
  pt.building = true;
  pt.stats.error = '';
  setPtStats('Path trace · building BVH…');
  const t0 = performance.now();
  let baked;
  try { baked = bakePathTraceScene(); }
  catch (e){
    pt.building = false; pt.enabled = false; pt.stats.error = String(e && e.message || e);
    setPtStats('Path trace · bake failed: ' + pt.stats.error);
    console.error(e);
    return;
  }
  const bakeMs = performance.now() - t0;
  disposePtScene(pt.scene);
  pt.scene = baked.scene;
  pt.lightObjs = baked.lightObjs;
  pt.matPairs = baked.matPairs;
  Object.assign(pt.stats, baked.stats, { bakeMs: +bakeMs.toFixed(1) });
  if (!pt.pathTracer){
    const ptr = new WebGLPathTracer(renderer);
    ptr.filterGlossyFactor = 0.5;
    ptr.bounces = pt.bounces;
    ptr.transmissiveBounces = pt.useTransmission ? pt.transmissiveBounces : 0;
    ptr.renderScale = Number(qs.get('ptScale')) > 0 ? Number(qs.get('ptScale')) : 1;
    ptr.tiles.set(pt.tiles, pt.tiles);
    ptr.multipleImportanceSampling = true;
    ptr.renderToCanvas = true;
    ptr.rasterizeScene = false;
    pt.pathTracer = ptr;
  }
  const t1 = performance.now();
  try {
    pt.pathTracer.setScene(pt.scene, camera);
  } catch (e){
    pt.building = false; pt.enabled = false; pt.stats.error = String(e && e.message || e);
    setPtStats('Path trace · setScene failed: ' + pt.stats.error);
    console.error(e);
    return;
  }
  const bvhMs = performance.now() - t1;
  pt.stats.bvhMs = +bvhMs.toFixed(1);
  pt.stats.bakeMs = +bakeMs.toFixed(1);
  pt.enabled = true;
  pt.building = false;
  pt.lightSig = ptLightSig();
  pt.lastCam = ptCamKey();
  pt.nextSubmitAt = 0;
  applyPtTiles(false);
  applyPtBounces(false);
  applyPtTransBounces(false);
  setPtStats(`Path trace · 0 samples · ${Math.round(pt.stats.triangles).toLocaleString()} tris · BVH ${pt.stats.bvhMs} ms`);
  console.log('path trace scene', pt.stats);
}
function stopPathTrace(){
  pt.enabled = false;
  pt.building = false;
  if (pt.pendingQuery && pt.gl){ try { pt.gl.deleteQuery(pt.pendingQuery); } catch(e){} }
  pt.pendingQuery = null;
  if (pt.pathTracer){ try { pt.pathTracer.reset(); } catch(e){} }
  setPtStats('');
  if (ptStatsEl) ptStatsEl.style.display = 'none';
  if (ptCtl) { ptCtl.enabled = false; gui?.controllersRecursive().forEach(c=>c.updateDisplay()); }
}
function ptOnRebuild(){
  if (pt.enabled || pt.building) startPathTrace();
}
window.__pt = pt;
state.ptHook = ptSyncLighting;
state.ptOnRebuild = ptOnRebuild;
pt.start = startPathTrace;
pt.stop = stopPathTrace;

// Cooperative scheduling (no gl.finish):
// PathTracingRenderer.update() already traces one scissored tile per call, then yields.
// We submit at most one tile per animation frame. A tile is still a single
// non-preemptible draw, so the budget only controls how often we submit, not
// mid-tile work. If EXT_disjoint_timer_query_webgl2 is present, the last tile's
// GPU time is read asynchronously (one frame late) and the next submit is delayed
// so average GPU load stays near budgetMs per 16.7 ms. Without the extension, we
// use a conservative heuristic: assume GPU time is at least max(cpuMs, 8 ms) × 2
// and skip frames the same way.
const PT_FRAME_MS = 1000 / 60;
let cPtTrans = null;
function applyPtTiles(reset=true){
  const n = Math.max(1, Math.min(16, Math.round(pt.tiles)));
  pt.tiles = n;
  if (pt.pathTracer){
    pt.pathTracer.tiles.set(n, n);
    if (reset) pt.pathTracer.reset();
  }
}
function applyPtBounces(reset=true){
  if (!pt.pathTracer) return;
  pt.pathTracer.bounces = pt.bounces;
  if (reset) pt.pathTracer.reset();
}
// In three-gpu-pathtracer 0.0.23, transmissiveBounces is an extra allowance of
// transmissive surface crossings (refraction / travel through a medium). The
// shader decrements the path-loop index so these steps do not consume the
// regular `bounces` budget. It is not a total path-length cap and not a subset
// of `bounces`. Two interfaces per water pillow, so 8 layers need ~16+.
function applyPtTransBounces(reset=true){
  if (pt.transAuto){
    const L = params.pillows ? params.layers : 0;
    pt.transmissiveBounces = Math.max(16, 2*L);
    cPtTrans?.updateDisplay();
  }
  if (!pt.pathTracer) return;
  pt.pathTracer.transmissiveBounces = pt.useTransmission ? pt.transmissiveBounces : 0;
  if (reset) pt.pathTracer.reset();
}
function ptIsPaused(){
  return document.hidden || (pt.pauseUnfocused && pt.unfocused);
}
function ptEnsureTimer(){
  if (pt.timerChecked) return;
  pt.timerChecked = true;
  const gl = renderer.getContext();
  pt.gl = gl;
  pt.timerExt = (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext)
    ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
}
function ptBeginGpuQuery(){
  if (!pt.timerExt || !pt.gl || pt.pendingQuery) return;
  const gl = pt.gl, ext = pt.timerExt;
  try {
    if (gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return;
    const q = gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    if (gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) !== q){
      try { gl.deleteQuery(q); } catch (e) {}
      return;
    }
    pt.pendingQuery = q;
  } catch (e) { pt.pendingQuery = null; }
}
function ptEndGpuQuery(){
  if (!pt.timerExt || !pt.gl || !pt.pendingQuery) return;
  const gl = pt.gl, ext = pt.timerExt;
  try {
    if (gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) === pt.pendingQuery){
      gl.endQuery(ext.TIME_ELAPSED_EXT);
    }
  } catch (e) { try { gl.deleteQuery(pt.pendingQuery); } catch (e2) {} pt.pendingQuery = null; }
}
function ptTrustGpuMs(ms){
  // Discard empty/broken timer results (some software GL reports ~0).
  return Number.isFinite(ms) && ms >= 0.1;
}
function ptPollGpuQuery(){
  if (!pt.timerExt || !pt.gl || !pt.pendingQuery) return;
  const gl = pt.gl, q = pt.pendingQuery;
  try {
    if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return;
    const disjoint = gl.getParameter(pt.timerExt.GPU_DISJOINT_EXT);
    if (!disjoint){
      const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
      if (ptTrustGpuMs(ms)){
        pt.lastGpuMs = ms;
        if (pt.lastSubmitAt){
          const period = pt.lastGpuMs * (PT_FRAME_MS / Math.max(pt.budgetMs, 1));
          pt.nextSubmitAt = pt.lastSubmitAt + period;
        }
      }
    }
    gl.deleteQuery(q);
  } catch (e) {
    try { gl.deleteQuery(q); } catch (e2) {}
  }
  pt.pendingQuery = null;
}
function ptPresentOnly(ptr){
  const prev = ptr.pausePathTracing;
  ptr.pausePathTracing = true;
  ptr.renderSample();
  ptr.pausePathTracing = prev;
}
function tickPathTrace(){
  const ptr = pt.pathTracer;
  if (!ptr || !pt.enabled || pt.building) return;
  const key = ptCamKey();
  if (key !== pt.lastCam){
    pt.lastCam = key;
    ptr.updateCamera();
    pt.nextSubmitAt = 0;
  }
  const paused = ptIsPaused();
  const now = performance.now();
  if (paused){
    ptPresentOnly(ptr);
  } else {
    ptPollGpuQuery();
    if (now >= pt.nextSubmitAt){
      ptEnsureTimer();
      const t0 = performance.now();
      ptBeginGpuQuery();
      ptr.pausePathTracing = false;
      try { ptr.renderSample(); } finally { ptEndGpuQuery(); }
      pt.lastCpuMs = performance.now() - t0;
      pt.lastSubmitAt = t0;
      // Ignore one-shot stalls (shader compile) so they do not schedule a long skip.
      if (ptr.isCompiling || pt.lastCpuMs > 80){
        pt.nextSubmitAt = 0;
      } else {
        const assumedMs = ptTrustGpuMs(pt.lastGpuMs) ? pt.lastGpuMs : Math.max(pt.lastCpuMs, 8) * (pt.timerExt ? 1 : 2);
        pt.nextSubmitAt = t0 + assumedMs * (PT_FRAME_MS / Math.max(pt.budgetMs, 1));
      }
    } else {
      ptPresentOnly(ptr);
    }
  }
  const samples = ptr.samples || 0;
  const compiling = ptr.isCompiling ? ' · compiling shaders' : '';
  const pauseLbl = paused ? ' · paused' : '';
  const spp = Number.isInteger(samples) ? samples : Math.round(samples * 100) / 100;
  setPtStats(`Path trace · ${spp} sample${samples===1?'':'s'}${pauseLbl}${compiling} · ${Math.round(pt.stats.triangles).toLocaleString()} tris`);
}

const ptCtl = { enabled: false };
const fPT = gui.addFolder('Path trace');
fPT.add(ptCtl, 'enabled').name('Path trace').onChange(v => {
  if (v) startPathTrace(); else stopPathTrace();
  ptCtl.enabled = pt.enabled;
});
fPT.add(pt, 'tiles', 1, 16, 1).name('tiles').onChange(() => applyPtTiles(true));
fPT.add(pt, 'budgetMs', 4, 48, 1).name('GPU budget (ms)');
fPT.add(pt, 'bounces', 1, 64, 1).name('bounces').onChange(() => applyPtBounces(true));
cPtTrans = fPT.add(pt, 'transmissiveBounces', 0, 64, 1).name('transmissive bounces').onChange(() => { pt.transAuto = false; applyPtTransBounces(true); });
fPT.add(pt, 'pauseUnfocused').name('pause when unfocused');

window.addEventListener('blur', () => { pt.unfocused = true; });
window.addEventListener('focus', () => { pt.unfocused = false; });

export { startPathTrace, tickPathTrace };
