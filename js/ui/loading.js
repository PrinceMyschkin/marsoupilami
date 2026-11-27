// MARSOUPILAMI · ui/loading.js
// Loading overlay and the stepwise structure rebuild (height changes).
import { debounce, fmtH } from '../util.js';
import { setHeight } from '../geometry/dome-shape.js';
import { params, qs } from '../state.js';
import { placeRocks, updateGround } from '../geometry/terrain.js';
import { buildMembrane } from '../geometry/membrane.js';
import { buildAnchors } from '../geometry/tethers.js';
import { cells, computeCells } from '../geometry/pillows.js';
import { buildScaleBar } from '../render/labels.js';
import { rebuild } from '../geometry/build.js';
import { applyCamera } from './camera-views.js';

// ---------------------------------------------------------------- loading overlay
const loadingEl = document.getElementById('loading'), loadBar = loadingEl.querySelector('.bar i'), loadMsg = loadingEl.querySelector('.msg');
const HOLD_LOADING = qs.get('loading') === 'hold';
const nextPaint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));   // let the overlay paint before sync work
async function step(msg, frac, fn){ loadMsg.textContent = msg; loadBar.style.width = Math.round(frac*100)+'%'; await nextPaint(); fn && fn(); }
let queue = Promise.resolve();
function withLoading(kind, steps){
  queue = queue.then(async () => {
    loadingEl.className = kind; loadingEl.style.display = 'flex';
    for (const [msg, frac, fn] of steps) await step(msg, frac, fn);
    await step('Done', 1, null);
    if (!HOLD_LOADING) loadingEl.style.display = 'none';
  }).catch(e => { console.error(e); loadingEl.style.display = 'none'; });
  return queue;
}
const structureSteps = () => [
  ['Shaping terrain', 0.1, () => { setHeight(params.height); updateGround(); placeRocks(); }],
  [`Building membrane & edge arc (${fmtH(params.height)} m)`, 0.35, buildMembrane],
  ['Laying out pillow grid', 0.6, () => { computeCells(cells); buildAnchors(); buildScaleBar(); }],
  ['Hanging water pillows & tethers', 0.85, rebuild],
];
const rebuildHeight = debounce(() => withLoading('rebuild', [...structureSteps(),
  ['Adjusting camera', 0.95, () => { if (['overview','exterior','section','platform'].includes(params.view)) applyCamera(params.view); }]]), 350);
function rebuildStructure(){
  setHeight(params.height); updateGround(); placeRocks();
  buildMembrane(); computeCells(cells); buildAnchors(); buildScaleBar();
  if (['overview','exterior','section','platform'].includes(params.view)) applyCamera(params.view);
  rebuild();
}

export { loadingEl, rebuildHeight, rebuildStructure, structureSteps, withLoading };
