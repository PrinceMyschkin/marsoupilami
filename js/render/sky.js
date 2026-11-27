// MARSOUPILAMI · render/sky.js
// Raster sky dome shader and the matching path-trace gradient sky (PT_SKY) with its irradiance.
import * as THREE from 'three';
import { scene } from './scene.js';

// Path-trace sky: butterscotch gradient (GradientEquirectTexture: lerp(bottom, top, (y/2+½)^exponent)),
// scaled every light update so its horizontal irradiance (luminance) equals the model's diffuse sky on
// the sun's scale (3.2 ≡ S0 W/m²). So it follows time and τ, and is dark at night.
const PT_SKY = { top: [0.62, 0.42, 0.28], bottom: [0.86, 0.62, 0.40], exponent: 0.6 };
const PT_SKY_EY = (() => { let e = 0; const N = 400;
  for (let k=0;k<N;k++){ const mu = (k+0.5)/N, t = Math.pow((mu+1)/2, PT_SKY.exponent);
    const c = [0,1,2].map(i => PT_SKY.bottom[i] + (PT_SKY.top[i]-PT_SKY.bottom[i])*t);
    e += (0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]) * mu / N; }
  return 2*Math.PI*e; })();

// ---------------------------------------------------------------- sky
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sunDir: { value: new THREE.Vector3(0,1,0) }, tau: { value: 0.5 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
  fragmentShader: `varying vec3 vDir; uniform vec3 sunDir; uniform float tau;
  void main(){
    vec3 v = normalize(vDir); float h = max(v.y, 0.0);
    float se = sunDir.y;
    float day = smoothstep(-0.18, 0.12, se);
    vec3 horizon = vec3(0.86,0.62,0.40);           // butterscotch
    vec3 zenith  = vec3(0.62,0.42,0.28);
    vec3 col = mix(horizon, zenith, pow(h, 0.6));
    float cg = max(dot(v, sunDir), 0.0);
    float low = 1.0 - smoothstep(0.0, 0.35, se);   // sunset factor
    vec3 blue = vec3(0.42, 0.62, 1.0);
    float aureole = pow(cg, 5.0);
    col = mix(col, blue, clamp(aureole * (0.25 + 0.75*low), 0.0, 0.9));
    col *= mix(0.015, 1.0, day) * (0.55 + 0.45*smoothstep(-0.05,0.4,se));
    col += vec3(1.0,0.97,0.92) * (pow(cg, 4000.0)*6.0 + pow(cg, 300.0)*0.6) * smoothstep(-0.02, 0.02, se);
    if (v.y < 0.0) col = mix(col, vec3(0.20,0.11,0.07)*mix(0.05,1.0,day), smoothstep(0.0, -0.05, v.y));
    gl_FragColor = vec4(col, 1.0);
  }`
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), skyMat));

export { PT_SKY, PT_SKY_EY, skyMat };
