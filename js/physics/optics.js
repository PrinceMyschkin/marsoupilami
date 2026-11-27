// MARSOUPILAMI · physics/optics.js
// Water optics: Pope & Fry absorption, CIE CMFs, 5778 K sun weights, band transmittance,
// pillow shape integrals (PILLOW) and the layered pillow-stack transmittance; light-tunnel pipe transmission.
import { G, PH, PW } from '../geometry/dome-shape.js';

// ============================================================================
//  OPTICS: Pope & Fry (1997) pure-water absorption a(λ) [1/m], 400–700 nm
// ============================================================================
const WL = [];  for (let l=400; l<=700; l+=10) WL.push(l);
const A_WATER = [0.00663,0.00473,0.00454,0.00495,0.00635,0.00922,0.00979,0.01060,0.01270,0.01500,
                 0.02040,0.03250,0.04090,0.04340,0.04740,0.05650,0.06190,0.06950,0.08960,0.13510,
                 0.22240,0.26440,0.27550,0.29160,0.31080,0.34000,0.41000,0.43900,0.46500,0.51600,0.62400];
const N_WATER = 1.333;
const T_MEMBRANE = 0.92;   // ETFE-type laminate, visible transmittance ~90–95 %
const T_BAG = 0.97;        // per pillow: 2 thin film walls (water/film interfaces have ~no Fresnel loss)
// ---- light tunnels (optional): one large perforated Al funnel per tunnel (thin gap membrane → pillows)
//      -> specular aluminium pipe through the pillow stack -> diffuser
const PIPE_RHO = 0.98;     // specular reflectance per bounce (enhanced Al, e.g. Alanod MIRO-SILVER ≈98 %; Solatube Spectralight Infinity claims 99.7 %)
const PIPE_D = 1.6, DIFFUSER_T = 0.95;
const FUNNEL_RHO = 0.93;   // effective funnel reflectance: polished Al ≈0.95 per bounce × ~1.5 bounces
const FUNNEL_SLOPE = 15*Math.PI/180;   // shallow walls so the funnel fits a thin gap; pillows below hang lower by the local funnel depth
const THROAT_H = 0.3;      // square-to-round throat from the funnel mouth (2×2 m cell) into the Ø1.6 m pipe
function pipeT(len, zen){ if (len <= 0) return 1; return Math.pow(PIPE_RHO, len*Math.tan(Math.min(zen, 1.55))/PIPE_D); }
function pipeTdiffuse(len){ // cosine-weighted isotropic sky
  if (len <= 0) return 1; let s=0, w=0; const N=60;
  for (let k=0;k<N;k++){ const th=(k+0.5)/N*Math.PI/2, ww=Math.cos(th)*Math.sin(th); s+=ww*pipeT(len, th); w+=ww; } return s/w; }
// CIE 1931 CMF analytic fit (Wyman, Sloan & Shirley 2013)
const g3 = (x,m,s1,s2)=>{const t=(x-m)/(x<m?s1:s2);return Math.exp(-0.5*t*t);};
const cmf = l => [
  1.056*g3(l,599.8,37.9,31.0)+0.362*g3(l,442.0,16.0,26.7)-0.065*g3(l,501.1,20.4,26.2),
  0.821*g3(l,568.8,46.9,40.5)+0.286*g3(l,530.9,16.3,31.1),
  1.217*g3(l,437.0,11.8,36.0)+0.681*g3(l,459.0,26.0,13.8)];
const planck = l => { const lm=l*1e-9; return 1/(lm**5*(Math.exp(1.4388e-2/(lm*5778))-1)); };
const W = WL.map(l => {               // per-wavelength weights for R,G,B (linear sRGB), Y and PAR photons
  const S = planck(l), [x,y,z] = cmf(l);
  return { r:S*( 3.2406*x-1.5372*y-0.4986*z), g:S*(-0.9689*x+1.8758*y+0.0415*z),
           b:S*( 0.0557*x-0.2040*y+1.0570*z), Y:S*y, par:S*l };
});
const SUMW = W.reduce((a,w)=>({r:a.r+w.r,g:a.g+w.g,b:a.b+w.b,Y:a.Y+w.Y,par:a.par+w.par}),{r:0,g:0,b:0,Y:0,par:0});
function bandT(Tl){ // Tl: array of spectral transmittance -> weighted channel transmittances
  const o={r:0,g:0,b:0,Y:0,par:0};
  W.forEach((w,i)=>{o.r+=w.r*Tl[i];o.g+=w.g*Tl[i];o.b+=w.b*Tl[i];o.Y+=w.Y*Tl[i];o.par+=w.par*Tl[i];});
  for (const k in o) o[k]=Math.max(0,o[k]/SUMW[k]);
  return o;
}
// path factor in water for incidence zenith angle θa (refraction at the film/water interface)
const pathFactor = th => 1/Math.sqrt(1 - (Math.sin(th)/N_WATER)**2);
// ---- pillow shape -> water per cell and open (gap) area, used by mass, pressure, shielding and optics.
// The drawn cushion (pillowGeometry) is a sphere pushed towards a rounded box, PW × PH × PW on a
// G.cell × G.cell grid. The smooth shape it approximates has the vertical chord
//   d(x,z) = PH · (1 − |2x/PW|^(2/0.28) − |2z/PW|^(2/0.28))^(0.55/2)
// Integrated over one 2 × 2 m cell: water volume per pillow, covered (projected) area, open fraction
// (14 cm streets between the columns + rounded corners), and a chord histogram for Beer–Lambert.
const PILLOW = (() => {
  const N = 400, A = G.cell*G.cell, dA = A/(N*N), NB = 24, w = new Array(NB).fill(0), wd = new Array(NB).fill(0);
  let V = 0, Ap = 0;
  for (let i=0;i<N;i++) for (let j=0;j<N;j++){
    const x = -G.cell/2 + (i+0.5)*G.cell/N, z = -G.cell/2 + (j+0.5)*G.cell/N;
    const s = Math.pow(Math.abs(2*x/PW), 2/0.28) + Math.pow(Math.abs(2*z/PW), 2/0.28);
    if (s >= 1) continue;
    const d = PH*Math.pow(1 - s, 0.55/2), b = Math.min(NB-1, Math.floor(d/PH*NB));
    V += d*dA; Ap += dA; w[b] += dA; wd[b] += d*dA;
  }
  const chords = []; for (let b=0;b<NB;b++) if (w[b] > 0) chords.push({ d: wd[b]/w[b], w: w[b]/A });
  return { V, Ap, A, open: 1 - Ap/A, depth: V/A, meanChord: V/Ap, chords };
})();
// One pillow layer as a screen: a ray either passes a gap (no water, no film) or crosses one pillow
// (two film walls T_BAG + water chord d·pathFactor). Layers are treated as independent screens: an
// oblique ray drifts L·tanθ sideways, so it does not stay inside the 14 cm streets; only an exactly
// vertical ray would see the aligned gaps all the way down. Mean water path = PILLOW.depth per layer.
function layerTl(pf){
  return A_WATER.map(a => { let t = PILLOW.open; for (const c of PILLOW.chords) t += c.w*T_BAG*Math.exp(-a*c.d*pf); return t; });
}
const _difT = new Map();
function waterT(L, sunElev){   // L pillow layers (films included, membrane not); band-integrated R,G,B,Y,PAR
  const direct = bandT(layerTl(pathFactor(Math.PI/2 - Math.max(sunElev, 0.01))).map(t => Math.pow(t, L)));
  let diffuse = _difT.get(L);   // isotropic sky: cosine-weighted hemisphere; depends on L only
  if (!diffuse){
    const N=24, dif=new Array(WL.length).fill(0); let ws=0;
    for (let k=0;k<N;k++){ const th=(k+0.5)/N*Math.PI/2, wt=Math.cos(th)*Math.sin(th); ws+=wt;
      layerTl(pathFactor(th)).forEach((t,i)=>dif[i]+=wt*Math.pow(t, L)); }
    diffuse = bandT(dif.map(v=>v/ws)); _difT.set(L, diffuse);
  }
  return { direct, diffuse };
}

export { A_WATER, bandT, cmf, DIFFUSER_T, FUNNEL_RHO, FUNNEL_SLOPE, N_WATER, pathFactor, PILLOW, PIPE_D, PIPE_RHO, pipeT, pipeTdiffuse, SUMW, T_BAG, T_MEMBRANE, THROAT_H, waterT };
