// MARSOUPILAMI · ui/camera-views.js
// Camera presets scaled with the dome geometry.
import { G, H0, R0 } from '../geometry/dome-shape.js';
import { camera, controls } from '../render/scene.js';
import { plateauClearHeight, platformDeckY } from '../geometry/platform.js';

// ============================================================================
//  CAMERA PRESETS & GUI
// ============================================================================
// presets scale with the current geometry (k: footprint, h: height relative to the 13 m reference; H0/R0 stay at that framing, not the 22 m startup default)
const VIEWS = {
  overview: (k,h)=>({ pos:[30*k, 13*h, 38*k], tgt:[-3, 6*h, -6], cut:true }),
  section:  (k,h)=>({ pos:[0.5, 6.0*h, 13*Math.max(1,h*0.8)], tgt:[-7.5, G.H*0.72, -2], cut:true }),
  interior: (k,h)=>({ pos:[2.0, 1.65, 1.5], tgt:[-0.5, 5.2, -9], cut:false, fov:68 }),
  exterior: (k,h)=>({ pos:[46*k, 17*h, 50*k], tgt:[0, 4*h, 0], cut:false }),
  house:    (k,h)=>({ pos:[-8.2, 5.6, -3.6], tgt:[-10, 3.9, -10], cut:false }),
  funnel:   (k,h)=>({ pos:[7.5, G.H-4.2, 9.5], tgt:[0, G.H-1.6, 0], cut:true }),   // close-up of a tunnel funnel in section
  platform: (k,h)=>{ const y = platformDeckY(Math.max(plateauClearHeight(), 26));
    return { pos:[16.5, y+2.6, 12.5], tgt:[0.2, y+1.4, -0.6], cut:false, fov:50 }; },
};
function applyCamera(name){
  const f = VIEWS[name]; if (!f) return null; const v = f(G.R/R0, G.H/H0);
  camera.position.set(...v.pos); controls.target.set(...v.tgt); camera.fov = v.fov || 50; camera.updateProjectionMatrix(); controls.update();
  return v;
}

export { applyCamera, VIEWS };
