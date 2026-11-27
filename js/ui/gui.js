// MARSOUPILAMI · ui/gui.js
// lil-gui control panel and the camera preset switch.
import GUI from 'lil-gui';
import { debounce } from '../util.js';
import { H_MAX, H_MIN } from '../geometry/dome-shape.js';
import { params, state } from '../state.js';
import { MAXL } from '../geometry/pillows.js';
import { updateLight } from '../render/lighting.js';
import { rebuild } from '../geometry/build.js';
import { VIEWS, applyCamera } from './camera-views.js';
import { rebuildHeight, withLoading } from './loading.js';

function setView(name){
  const v = applyCamera(name); if (!v) return;
  if (!params.cutEighth) params.cutaway = v.cut;
  gui?.controllersRecursive().forEach(c=>c.updateDisplay());
  rebuild();
}
const rebuildLayers = debounce(() => withLoading('rebuild', [['Hanging water pillows', 0.5, rebuild]]), 250);
const gui = new GUI({ title: 'MARSOUPILAMI controls' });
gui.add(params, 'height', H_MIN, H_MAX, 0.5).name('membrane height (m)').onChange(rebuildHeight);
gui.add(params, 'layers', 0, MAXL, 1).name('water pillow layers').onChange(rebuildLayers);
gui.add(params, 'pillows').name('show water pillows').onChange(rebuild);
gui.add(params, 'platform').name('Hanging platform (auto >25 m)').onChange(rebuild);
const fL = gui.addFolder('Red LEDs (620 + 660 nm)');
state.cLedW = fL.add(params, 'ledW', 0, 100, 1).name('Red LEDs (W/m²)').onChange(() => { if (!params.ledAuto) updateLight(); });
fL.add(params, 'ledMix620', 0, 1, 0.01).name('620/660 mix (fraction 620 nm)').onChange(updateLight);
fL.add(params, 'ledAuto').name('Auto-balance (white, Duv = 0)').onChange(() => { if (params.ledAuto) state.cLedW.disable(); else state.cLedW.enable(); updateLight(); });
fL.add(params, 'ledHours', 0, 24, 0.5).name('LED hours / sol').onChange(updateLight);
if (params.ledAuto) state.cLedW.disable();
const fT = gui.addFolder('Light tunnels (skylights)');
fT.add(params, 'tunnels').name('light tunnels on').onChange(() => rebuildLayers());
fT.add(params, 'tunnelSpacing', 6, 18, 4).name('tunnel spacing (m)').onChange(() => rebuildLayers());
fT.add(params, 'funnelCover', 10, 100, 1).name('funnel coverage % (of cell)').onChange(() => rebuildLayers());
fT.add(params, 'perfOpen', 0, 60, 1).name('perforation open %').onChange(updateLight);
fT.hide();   // tunnels stay available via ?tunnels=1, but the folder is hidden from the control panel
gui.add(params, 'membrane').name('show membrane').onChange(rebuild);
gui.add(params, 'tethers').name('show tethers').onChange(rebuild);
gui.add(params, 'cutaway').name('cutaway section').onChange(() => {
  if (!params.cutaway) params.cutEighth = false;
  gui.controllersRecursive().forEach(c=>c.updateDisplay());
  rebuild();
});
gui.add(params, 'cutEighth').name('1/8 sector cutaway').onChange(() => {
  if (params.cutEighth) params.cutaway = true;
  gui.controllersRecursive().forEach(c=>c.updateDisplay());
  rebuild();
});
gui.add(params, 'labels').name('labels').onChange(rebuild);
const fS = gui.addFolder('Sun / Mars time');
fS.add(params, 'time', 0, 24, 0.05).name('local solar time (h)').onChange(updateLight);
fS.add(params, 'pathLights', ['auto','on','off']).name('night lights (path + uplights)').onChange(updateLight);
fS.add(params, 'lat', -60, 60, 0.01).name('latitude °N').onChange(updateLight);
fS.add(params, 'decl', -25.2, 25.2, 0.1).name('solar declination °').onChange(updateLight);
fS.add(params, 'tau', 0.2, 11, 0.05).name('dust optical depth τ').onChange(updateLight);
fS.add(params, 'exposure', 0.2, 4, 0.05).name('camera exposure').onChange(updateLight);
gui.add(params, 'view', Object.keys(VIEWS).filter(k => k !== 'funnel')).name('camera preset').onChange(setView);
let animT = null;
gui.add({ play(){ if (animT){ clearInterval(animT); animT=null; } else animT=setInterval(()=>{ params.time=(params.time+0.05)%24; fS.controllers[0].updateDisplay(); updateLight(); }, 50); } }, 'play').name('▶ animate sol');

export { gui, rebuildLayers };
