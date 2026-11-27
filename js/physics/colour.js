// MARSOUPILAMI · physics/colour.js
// Colorimetry: sun-equivalent RGB units, LED line colour, XYZ, CIE 1960 uv, CCT and Duv
// (distance to the Planckian locus) for the white balance.
import * as THREE from 'three';
import { SUMW, cmf } from './optics.js';
import { params } from '../state.js';

// UNITS. The solver works in "sun-equivalent watts" per colour channel: waterFilteredRGB() gives
// R,G,B = (band transmittance) × I.glob, so unfiltered sunlight is (I, I, I) and 1 unit of R (G, B) is
// the linear-sRGB red (green, blue) stimulus of 1 W/m² of BROADBAND 5778 K sunlight (all wavelengths;
// only ~38 % of it lies in 400–700 nm). An LED watt is optical power at one wavelength, so its channel
// weight is CMF→sRGB(λ) divided by the sun's stimulus per broadband watt (SUN_RGB_PER_W). Negative
// sRGB components (620/660 nm lie outside the sRGB gamut) are clipped to 0, the same in the solver and
// in the rendered light colour.
const SUN_RGB_PER_W = (() => {
  const T = 5778, c2 = 1.4388e-2, total = Math.pow(T/c2, 4)*Math.PI**4/15/1e-9;   // ∫ planck dλ (λ in nm), Stefan–Boltzmann
  return { r: SUMW.r*10/total, g: SUMW.g*10/total, b: SUMW.b*10/total };          // SUMW sums 10 nm steps
})();
function ledChannel(nm){
  const [x,y,z] = cmf(nm);
  const r = 3.2406*x-1.5372*y-0.4986*z, g = -0.9689*x+1.8758*y+0.0415*z, b = 0.0557*x-0.2040*y+1.0570*z;
  return { r: Math.max(0,r)/SUN_RGB_PER_W.r, g: Math.max(0,g)/SUN_RGB_PER_W.g, b: Math.max(0,b)/SUN_RGB_PER_W.b };
}
// ---- colorimetry for auto-balance: chromaticity, CCT and Duv (CIE 1960 uv distance to the Planckian locus)
const WHITE_DUV_TOL = 0.006;        // ≈ ANSI C78.377 tolerance for "white" light
function rgbToXYZ(r, g, b){ return [0.4124*r+0.3576*g+0.1805*b, 0.2126*r+0.7152*g+0.0722*b, 0.0193*r+0.1192*g+0.9505*b]; }
function solverXYZ(rgb){            // solver channels (sun-equivalent W) -> absolute XYZ (CMF-weighted W)
  return rgbToXYZ(rgb.r*SUN_RGB_PER_W.r, rgb.g*SUN_RGB_PER_W.g, rgb.b*SUN_RGB_PER_W.b); }
function ledXYZPerW(){              // true CMF values of the line mix per optical W (not gamut-clipped)
  const f = THREE.MathUtils.clamp(params.ledMix620 ?? 0.6, 0, 1), a = cmf(620), b = cmf(660);
  return [0, 1, 2].map(i => f*a[i] + (1-f)*b[i]); }
const uv60 = ([X,Y,Z]) => { const d = X + 15*Y + 3*Z; return d > 0 ? [4*X/d, 6*Y/d] : [0, 0]; };
const PLANCK_UV = (() => { const out = [];
  for (let T=1000; T<=40000; T*=1.004){ let X=0, Y=0, Z=0;
    for (let l=380; l<=780; l+=5){ const lm=l*1e-9, p=1/(lm**5*(Math.exp(1.4388e-2/(lm*T))-1)), c=cmf(l); X+=p*c[0]; Y+=p*c[1]; Z+=p*c[2]; }
    out.push([T, ...uv60([X,Y,Z])]); }
  return out; })();
function cctDuv(XYZ){               // nearest point on the Planckian locus; Duv > 0 above (green), < 0 below (pink)
  const [u, v] = uv60(XYZ); let best = 0, bd = Infinity;
  for (let i=0;i<PLANCK_UV.length;i++){ const d = (u-PLANCK_UV[i][1])**2 + (v-PLANCK_UV[i][2])**2; if (d < bd){ bd = d; best = i; } }
  const [T, lu, lv] = PLANCK_UV[best];
  return { CCT: T, Duv: Math.sign(v - lv || 1) * Math.sqrt(bd) };
}
function mixColour(rgb, W){         // filtered daylight + W optical W/m² of the current LED mix
  const s = solverXYZ(rgb), e = ledXYZPerW();
  return cctDuv([s[0] + W*e[0], s[1] + W*e[1], s[2] + W*e[2]]);
}

export { ledChannel, mixColour, WHITE_DUV_TOL };
