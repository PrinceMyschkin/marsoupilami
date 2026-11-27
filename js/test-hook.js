// MARSOUPILAMI · test-hook.js
// Test hook for headless checks: window.__mars (window.__pt is set in pathtracer/pathtracer.js).
import { waterT } from './physics/optics.js';
import { irradiance, sunVector } from './physics/mars-environment.js';
import { params, state } from './state.js';
import { interiorTransmission } from './physics/light-transport.js';
import { computeLedAuto } from './physics/leds.js';
import { camera, controls, renderer } from './render/scene.js';
import { TINT } from './render/materials.js';
import { hemi, ledLight, rectFormFactor, sun } from './render/lights.js';
import { anchors, buildAnchors, tetherCount } from './geometry/tethers.js';
import { plateauClearHeight, platformDeckY, platformGroup } from './geometry/platform.js';
import { updateLight } from './render/lighting.js';
import { rebuild } from './geometry/build.js';
import { applyCamera } from './ui/camera-views.js';
import { rebuildHeight, rebuildStructure } from './ui/loading.js';
import { rebuildLayers } from './ui/gui.js';
import { flyKeys, tickFly } from './controls/fly.js';
import { setInfoMode } from './ui/info-controls.js';

window.__mars = { params, renderer, get rebuildHeight(){ return rebuildHeight; }, get rebuildLayers(){ return rebuildLayers; }, rebuild, rebuildStructure, plateauClearHeight, platformDeckY, platformGroup, camera, controls, applyCamera, get ledAutoState(){ return state.ledAutoState; }, computeLedAuto, updateLight, interiorTransmission, irradiance, sunVector, waterT, get infoMode(){ return state.infoMode; }, setInfoMode, get summary(){ return window.__summary; }, get anchors(){ return anchors; }, get stats(){ return state.stats; }, tetherCount, buildAnchors, lights: { sun, hemi, ledLight, TINT, rectFormFactor } };   // test hook
window.__mars.flyKeys = flyKeys; window.__mars.tickFly = tickFly;
