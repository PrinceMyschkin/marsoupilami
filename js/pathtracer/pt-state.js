// MARSOUPILAMI · pathtracer/pt-state.js
// Path tracer settings / runtime state (window.__pt) and the stats overlay element.
import { qs } from '../state.js';

// ---------------------------------------------------------------- path tracer (optional, three-gpu-pathtracer 0.0.23 + three-mesh-bvh 0.7.4, three r160)
// InstancedMesh is not supported by the path tracer, so visible instances are baked into static geometry
// when a trace starts. Custom shaders (sky, interior tint, multiply-blend pillow filters) are skipped or
// replaced: pillows/membrane use MeshPhysicalMaterial with transmission; the sky becomes a gradient env map.
const pt = {
  enabled: false, building: false, pathTracer: null, scene: null, env: null,
  stats: { triangles: 0, meshes: 0, instancesExpanded: 0, bvhMs: 0, lights: 0, error: '' },
  useTransmission: true, lastCam: '',
  tiles: Math.max(1, Math.min(16, Math.round(Number(qs.get('ptTiles')) || 12))),
  budgetMs: Number(qs.get('ptBudget')) > 0 ? Number(qs.get('ptBudget')) : 20,
  bounces: Number(qs.get('ptBounces')) > 0 ? Number(qs.get('ptBounces')) : 5,
  // transmissiveBounces are EXTRA crossings through transmissive surfaces (the
  // 0.0.23 shader rewinds the bounce index so they do not consume `bounces`).
  transmissiveBounces: (qs.has('ptTransBounces') && Number.isFinite(Number(qs.get('ptTransBounces'))) && Number(qs.get('ptTransBounces')) >= 0)
    ? Math.round(Number(qs.get('ptTransBounces'))) : 16,
  // auto: follow the layer count (2 interfaces per pillow) until the slider or ?ptTransBounces is used
  transAuto: !qs.has('ptTransBounces'),
  lightObjs: [], matPairs: [], lightSig: '',
  pauseUnfocused: true,
  unfocused: false,
  nextSubmitAt: 0,
  lastSubmitAt: 0,
  lastGpuMs: 0,
  lastCpuMs: 0,
  timerChecked: false,
  timerExt: null,
  gl: null,
  pendingQuery: null,
};
const ptStatsEl = document.getElementById('ptStats');

export { pt, ptStatsEl };
