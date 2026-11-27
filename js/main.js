// MARSOUPILAMI · main.js
// Bootstrap: loads the modules in their original evaluation order, wires the resize handler,
// builds the structure behind the loading overlay and starts the render loop.
// Third-party modules are evaluated first, like in the original single-file version.
import * as THREE from 'three';
import 'three/addons/controls/OrbitControls.js';
import 'three/addons/renderers/CSS2DRenderer.js';
import 'three/addons/environments/RoomEnvironment.js';
import 'three/addons/lights/RectAreaLightUniformsLib.js';
import 'lil-gui';
import 'three-gpu-pathtracer';
import './polyfills.js';
import './util.js';
import { H_MAX, H_MIN, setHeight } from './geometry/dome-shape.js';
import './physics/optics.js';
import './physics/mars-environment.js';
import { params, qs } from './state.js';
import './physics/light-transport.js';
import './physics/colour.js';
import './physics/leds.js';
import { camera, controls, labelRenderer, renderer, scene } from './render/scene.js';
import './render/materials.js';
import './render/cutaway.js';
import './render/lights.js';
import './render/sky.js';
import './geometry/terrain.js';
import './geometry/membrane.js';
import './geometry/tethers.js';
import { MAXL } from './geometry/pillows.js';
import './geometry/scale-objects.js';
import './geometry/tunnels.js';
import './render/labels.js';
import './geometry/platform.js';
import './physics/shielding.js';
import './ui/info-panel.js';
import './render/lighting.js';
import { rebuild } from './geometry/build.js';
import { applyCamera } from './ui/camera-views.js';
import { loadingEl, structureSteps, withLoading } from './ui/loading.js';
import { gui } from './ui/gui.js';
import { pt } from './pathtracer/pt-state.js';
import './pathtracer/bake.js';
import { startPathTrace, tickPathTrace } from './pathtracer/pathtracer.js';
import { tickFly } from './controls/fly.js';
import './ui/info-controls.js';
import './test-hook.js';

addEventListener('resize', () => { camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight);
  if (pt.enabled && pt.pathTracer) pt.pathTracer.updateCamera(); });

const cutOverride = qs.has('cutaway') ? params.cutaway : null;
const eighthFromUrl = qs.has('cutEighth') ? params.cutEighth : false;
params.height = THREE.MathUtils.clamp(params.height, H_MIN, H_MAX);
params.layers = THREE.MathUtils.clamp(Math.round(params.layers), 0, MAXL);
if (qs.get('gui')==='0') gui.hide();
if (qs.get('info')==='0') document.getElementById('info').style.display='none';
loadingEl.className = '';
withLoading('', [...structureSteps(), ['Placing camera', 0.95, () => {
    setHeight(params.height); const v = applyCamera(params.view) || applyCamera('overview');
    params.cutaway = cutOverride !== null ? cutOverride : v.cut;
    if (eighthFromUrl){ params.cutEighth = true; params.cutaway = true; }
    gui.controllersRecursive().forEach(c=>c.updateDisplay()); rebuild(); }]])
  .then(() => {
    let frames = 0;
    const autoPT = qs.get('pathTrace')==='1' || qs.get('pathTrace')==='true';
    renderer.setAnimationLoop(() => {
      tickFly(performance.now());
      controls.update();
      if (pt.enabled) tickPathTrace();
      else renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      if (++frames === 3){
        window.__ready = true;
        if (autoPT && !pt.enabled && !pt.building) startPathTrace();
      }
    });
  });
