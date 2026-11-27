// MARSOUPILAMI · render/materials.js
// Interior material tint: shared uniforms for "light passed through water" and the shader patch.
import * as THREE from 'three';

// shared uniforms for "light passed through water" on interior materials
const TINT = { dir: { value: new THREE.Color(1,1,1) }, dif: { value: new THREE.Color(1,1,1) } };
function interior(mat){
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTintDir = TINT.dir; sh.uniforms.uTintDif = TINT.dif;
    const lfb = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );',
      'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= uTintDir;');
    sh.fragmentShader = 'uniform vec3 uTintDir;\nuniform vec3 uTintDif;\n' + sh.fragmentShader
      .replace('#include <lights_fragment_begin>', lfb)
      .replace('#include <aomap_fragment>',
      `#include <aomap_fragment>
       reflectedLight.indirectDiffuse *= uTintDif; reflectedLight.indirectSpecular *= uTintDif;`);
  };
  mat.customProgramCacheKey = () => 'interiorTint';
  return mat;
}

export { interior, TINT };
