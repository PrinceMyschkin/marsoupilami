// MARSOUPILAMI · geometry/dome-shape.js
// Dome dimensions (G) and the membrane profile: plateau height, edge arc, pillow cell size,
// tether attachment rule and the height slider range. Pure functions, no scene objects.
import * as THREE from 'three';

// ============================================================================
//  GEOMETRY PARAMETERS (metres)
// ============================================================================
const G = {
  H: 13.0,          // membrane height at tether attachment points (flat tethered plateau)
  bulge: 0.35,      // pillow bulge of membrane between attachment points
  cell: 2.0,        // attachment grid / water-pillow cell size
  anchor: 10.0,     // anchor (footing) spacing; each bundle serves a 10 x 10 m patch = 25 tethers
  Rp: 18.0,         // radius of tethered, flat plateau
  arcTop: 15*Math.PI/180,   // edge arc slope where it leaves the plateau
  arcGround: 60*Math.PI/180,// edge arc slope where it meets the ground (no vertical walls)
  layerH: 1.0,      // water per pillow layer
  hookGap: 0.15,    // gap membrane -> top of first pillow (hook strap)
};
const PW = G.cell - 0.14, PH = G.layerH - 0.05;   // pillow outer dims (1.86 x 0.95 x 1.86 m) -> 0.14 m gap for tether lines
function setHeight(H){   // edge arc keeps its angles, so the footprint grows with height
  G.H = H;
  G.rho = G.H / (Math.cos(G.arcTop) - Math.cos(G.arcGround));            // edge arc radius
  G.R = G.Rp + G.rho * (Math.sin(G.arcGround) - Math.sin(G.arcTop));     // footprint radius
}
setHeight(G.H);
const H0 = G.H, R0 = G.R;

function baseHeight(r){
  if (r <= G.Rp) return G.H;
  const d = r - G.Rp;
  const s = Math.sin(G.arcTop) + d / G.rho;
  if (s >= Math.sin(G.arcGround)) return 0;
  return Math.max(0, G.H - G.rho * (Math.cos(G.arcTop) - Math.sqrt(1 - s*s)));
}
function roofHeight(x, z){
  const r = Math.hypot(x, z);
  let y = baseHeight(r);
  const f = THREE.MathUtils.smoothstep(G.Rp + 1.0 - r, 0, 1.0); // bulges only on tethered plateau
  if (f > 0) y += f * G.bulge * Math.abs(Math.sin(Math.PI*(x-1)/2) * Math.sin(Math.PI*(z-1)/2));
  return y;
}

// tether attachment rule (shared by the membrane seams and the tether bundles)
const TETHER_MIN_TOP = 1.3;   // same clearance cutoff as computeCells
function tetherAt(x, z){ return baseHeight(Math.hypot(x, z)) - G.hookGap >= TETHER_MIN_TOP; }
// membrane height slider range (m)
const H_MIN = 6, H_MAX = 50;

export { baseHeight, G, H_MAX, H_MIN, H0, PH, PW, R0, roofHeight, setHeight, tetherAt };
