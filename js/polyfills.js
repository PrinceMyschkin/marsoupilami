// MARSOUPILAMI · polyfills.js
// Scene.backgroundRotation / environmentRotation polyfill for three r160 (needed by three-gpu-pathtracer 0.0.23).
import * as THREE from 'three';

// three-gpu-pathtracer 0.0.23 reads scene.backgroundRotation / environmentRotation (added in three r163).
// Polyfill them on r160 so we can keep the existing raster renderer unchanged.
(function polyfillSceneRotation(){
  const proto = THREE.Scene.prototype;
  if (!Object.getOwnPropertyDescriptor(proto, 'backgroundRotation')){
    Object.defineProperty(proto, 'backgroundRotation', {
      get(){ return this._ptBgRot || (this._ptBgRot = new THREE.Euler()); },
      set(v){ this._ptBgRot = v; },
    });
  }
  if (!Object.getOwnPropertyDescriptor(proto, 'environmentRotation')){
    Object.defineProperty(proto, 'environmentRotation', {
      get(){ return this._ptEnvRot || (this._ptEnvRot = new THREE.Euler()); },
      set(v){ this._ptEnvRot = v; },
    });
  }
})();
